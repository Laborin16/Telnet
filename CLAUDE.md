# SIT — Sistema Integrado Telnet (wisp-manager)

Panel de control full-stack para la gestión operativa de un ISP. Integra WispHub (fuente de verdad de clientes), WhatsApp Business API y Web Push para notificaciones.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI, SQLAlchemy 2.0 async, PostgreSQL, JWT + bcrypt, APScheduler |
| Frontend | React 18, TypeScript, TanStack Query, Axios, Recharts, Vite |
| Externos | WispHub REST API, WhatsApp Graph API v20.0 (Facebook), Web Push (VAPID/pywebpush) |
| Reportes | openpyxl (Excel), reportlab (PDF) |
| Timezone | `America/Hermosillo` (UTC-7, sin cambio de horario) |

---

## Estructura del proyecto

```
wisp-manager/
├── backend/
│   ├── main.py                  # Punto de entrada, lifespan, routers, CORS
│   ├── core/
│   │   ├── config.py            # Settings via pydantic-settings (.env + .env.local)
│   │   ├── dependencies.py      # get_usuario (nunca falla), requerir_autenticado, requerir_admin
│   │   └── wisphub/client.py    # Cliente HTTP async con retry (3 intentos, exponential backoff)
│   ├── db/
│   │   ├── base.py              # DeclarativeBase de SQLAlchemy
│   │   └── session.py           # Engine async + get_db() dependency
│   └── modules/
│       ├── auth/                # Usuarios locales, JWT, roles
│       ├── clients/             # Gateway puro a WispHub (sin tabla local)
│       ├── finanzas/            # Cobranza, pagos, verificaciones, recolección, reportes
│       ├── reportes/            # Tareas/tickets de técnicos + Web Push + fotos
│       ├── whatsapp/            # Recordatorios automáticos vía plantillas
│       └── auditlog/            # Log de todas las acciones del sistema
├── frontend/
│   └── src/
│       ├── App.tsx              # Shell principal: sidebar, routing por tab, filtros de clientes
│       ├── core/api/apiClient.ts  # Axios con Bearer token + interceptor 401 → logout
│       └── modules/
│           ├── auth/            # Login, gestión de usuarios, cambio forzado de password
│           ├── clients/         # Tabla + modal detalle, filtros client-side
│           ├── finanzas/        # Tabs semana/día/cobranza/recolección/historial
│           ├── reportes/        # Tareas con timeline, fotos, SLA
│           ├── auditlog/        # Tabla de logs expandible
│           └── dashboard/       # KPIs + gráficas de planes/zonas/métodos de pago
└── .env / .env.local            # Variables de entorno (.env.local sobreescribe .env)
```

---

## Módulos del backend

### `auth` — Usuarios locales

- Tabla `usuarios` con 3 roles (valores en minúscula): `administrador`, `tecnico`, `cobranza`
- JWT HS256 con 8 horas de expiración
- `password_hash` nullable — permite crear usuarios sin password inicial
- Flujo de primera vez: usuario creado con contraseña temporal + `debe_cambiar_password=True`
- El frontend intercepta este flag y muestra pantalla obligatoria antes de entrar a la app

### `clients` — Gateway a WispHub (sin DB local)

- **No existe tabla de clientes local.** Cada request va directo a WispHub.
- `list_clients()` hace dos llamadas en paralelo: `/api/clientes/` y `/api/facturas/`
- Construye un mapa `id_servicio → fecha_pago` de facturas pendientes para calcular `dias_para_corte`
- Fecha de referencia: usa `fecha_pago` de la factura; cae a `fecha_vencimiento` si no existe
- Valores posibles de `alerta_corte`:
  - `suspendido` — estado == "Suspendido" (prioridad sobre todo)
  - `critico` — facturas pendientes Y dias_para_corte <= 0
  - `pendiente` — facturas pendientes Y dias_para_corte <= 3
  - `normal` — resto
- El endpoint de detalle de WispHub no devuelve nombre/teléfono/dirección; se enriquece con una 3ª llamada al listado

### `finanzas` — Módulo principal de cobranza (~1500 líneas)

Capas de datos:

| Tabla local | Propósito |
|-------------|-----------|
| `verificaciones_pago` | Marcar facturas de WispHub como revisadas (checkbox) |
| `pagos_registrados` | Registro manual de pagos (paralelo a WispHub) |
| `log_recordatorios` | Historial de mensajes WhatsApp enviados |
| `observaciones` | Notas libres por entidad (cliente, factura, etc.) — unique(entity_type, entity_id) |
| `recoleccion_registros` | Estado del equipo físico al recuperarlo |

Flujos clave:
- **Cobranza semanal**: facturas emitidas en la semana actual (lunes-domingo)
- **Cobranza diaria**: facturas del día enriquecidas con estado de verificación local
- **Alertas de cobranza**: clientes agrupados por días vencidos (hoy, 1-3, >3)
- **Recolección**: clientes suspendidos con 7+ días vencidos que requieren recuperar equipo
- **Reportes**: genera Excel con gráficas (openpyxl) y PDF con gráficas (reportlab)

### `whatsapp` — Recordatorios automáticos

Lógica de escalado por días vencidos (usa `fecha_pago` o `fecha_vencimiento` como referencia):

| Días | Plantilla | Acción adicional |
|------|-----------|-----------------|
| 0 | `telnet_recordatorio_pago` | — |
| 1-3 | `telnet_aviso_vencido` | — |
| 4-6 | `telnet_servicio_cortado` | Suspende en WispHub (`SUSPENSION_HABILITADA = True`) |
| 7+ | `telnet_recoleccion_equipo` | — |

- El teléfono se normaliza: añade prefijo `52`, convierte móviles a `521` (13 dígitos)
- Las plantillas tienen parámetros `nombre` y `monto` en el body
- Envío en paralelo con `asyncio.gather`

### `reportes` — Sistema de tareas/tickets

**Tipos de tarea:** INSTALACION, SERVICIO, RECOLECCION, RECONEXION, CAMBIO_DOMICILIO, TRABAJO_GENERAL, FALLA_RED, SOPORTE_TECNICO, MANTENIMIENTO, CAMBIO_PLAN, REUBICACION

**Máquina de estados** (validada en `state_machine.py`):
```
PENDIENTE ──→ ASIGNADO ──→ EN_RUTA ──→ EN_EJECUCION ──→ COMPLETADO*
    ↑              ↓           ↓              ↓
    └── CANCELADO ←┴───── BLOQUEADO* ←────────┘
         ↓
      PENDIENTE
```
- `*BLOQUEADO` y `*COMPLETADO` requieren comentario obligatorio
- Al asignar técnico: envía Web Push al técnico
- En BLOQUEADO / COMPLETADO / CANCELADO: envía Web Push al supervisor

**Tipo INSTALACION es especial:**
1. Crea el cliente en WispHub async
2. La tarea queda sin `id_servicio` hasta que se vincula manualmente
3. Endpoint `PATCH /tareas/{id}/vincular-servicio` asigna el `id_servicio` obtenido

**Control de acceso:**
- TECNICO: solo ve sus propias tareas y no las PENDIENTE sin asignar
- ADMINISTRADOR: ve y gestiona todo

**Trazabilidad:** Cada cambio de estado genera un `TareaEvento` con timestamp, usuario, lat/lng y comentario.

### `auditlog` — Auditoría

- Prefijo: `/api/v1/audit` (no `/auditlog`)
- Registro de cualquier acción: usuario, módulo, entidad, entidad_id, descripción, datos_extra JSON
- `log_accion()` nunca lanza excepción — fallo silencioso
- Solo accesible para administradores

---

## Rutas de la API

```
/api/v1/auth/
  POST   /login
  GET    /me
  POST   /cambiar-password
  GET    /usuarios              (admin)
  POST   /usuarios              (admin)
  PATCH  /usuarios/{id}         (admin)
  POST   /reset-password/{id}   (admin)

/api/v1/clients/
  GET    /                      # lista con paginación y filtros
  GET    /{id}                  # detalle enriquecido
  POST   /{id}/suspend          # + audit log
  POST   /{id}/activate         # + audit log

/api/v1/finanzas/
  GET    /cobros-semana
  GET    /cobros-dia
  GET    /alertas-cobranza
  GET    /log-cobranza
  GET    /pagos
  GET    /observaciones/{entity_type}
  GET    /formas-pago
  GET    /tecnicos
  GET    /recoleccion
  GET    /reporte-semanal
  GET    /reporte-semanal/excel
  GET    /reporte-semanal/pdf
  GET    /historial
  PATCH  /cobros-dia/{id_factura}/verificar  # + audit log
  POST   /pagos                              # + audit log
  POST   /registrar-pago/{id_factura}        # paga en WispHub + audit log
  PUT    /observaciones/{entity_type}/{id}   # + audit log
  POST   /pagos/{id}/comprobante             # + audit log
  POST   /recoleccion/{id}/estado-equipo     # + audit log

/api/v1/whatsapp/
  POST   /test
  POST   /enviar-individual
  GET    /resumen
  POST   /ejecutar-recordatorios             # + audit log

/api/v1/reportes/
  POST   /tareas                             (admin)
  GET    /tareas
  GET    /tareas/{id}
  PATCH  /tareas/{id}                        (admin)
  PATCH  /tareas/{id}/asignar               (admin)
  POST   /tareas/{id}/transicion
  GET    /tareas/{id}/transiciones
  GET    /tareas/{id}/eventos
  POST   /tareas/{id}/fotos
  GET    /tareas/{id}/fotos
  GET    /zonas
  GET    /planes
  GET    /routers
  GET    /ips-disponibles
  PATCH  /tareas/{id}/vincular-servicio
  POST   /push/suscribir
  DELETE /push/suscribir

/api/v1/audit/
  GET    /logs      (admin)
  GET    /modulos   (admin)
  GET    /usuarios  (admin)

/api/v1/health
```

---

## Frontend — patrones clave

- **TanStack Query** para todo el estado remoto. Refetch automático de clientes cada 60s.
- **Filtrado 100% client-side** en el módulo de clientes: el backend devuelve todos (`page_size=9999`), el browser filtra y pagina (PAGE_SIZE=25).
- **Orden de clientes**: `critico → pendiente → suspendido → normal`, luego por `dias_para_corte` asc.
- **Axios interceptor**: cualquier 401 limpia el token de localStorage y recarga la página.
- **Toast Context** propio (sin librería), auto-dismiss 3.5s, renderiza en bottom-right.
- **Estilos**: 100% inline CSS, sin framework de estilos.
- **Sidebar responsive**: oculto en móvil (<768px), se abre con botón hamburguesa.
- **Tabs por rol**:
  - `administrador`: clientes, dashboard, finanzas, auditoría, tareas, usuarios
  - `tecnico`: solo tareas (tab por defecto)
  - `cobranza`: clientes, dashboard, finanzas
- **Badge de alertas**: número rojo en tab "Tareas" contando tareas BLOQUEADAS o con SLA vencido.
- **Web Push**: se registra automáticamente al montar `MainApp` vía `usePushSubscription()`.

---

## Variables de entorno requeridas

```env
# WispHub
WISPHUB_API_BASE_URL=
WISPHUB_API_KEY=

# Base de datos
DATABASE_URL=postgresql+asyncpg://...

# App
APP_SECRET_KEY=
ALLOWED_ORIGINS=http://localhost:5173

# WhatsApp (opcional para desarrollo)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# VAPID Web Push (opcional)
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_SUBJECT=mailto:admin@telnet-hillo.com
```

---

## Archivos vacíos / pendientes

- `backend/core/wisphub/cache.py` — caché Redis configurada en settings pero sin implementar
- `backend/core/exceptions.py` — sin contenido
- `backend/modules/clients/models.py` — sin tabla local de clientes (diseño intencional)
- `backend/modules/clients/repository.py` — sin implementar

---

## Convenciones del proyecto

- Los routers se registran en `main.py` con prefijo `/api/v1/<modulo>`
- Las acciones críticas siempre llaman a `auditlog.service.log_accion()` al final del endpoint
- Los módulos siguen la estructura: `models.py → schemas.py → service.py → router.py`
- Los enums de roles se almacenan en minúscula en DB (`administrador`, no `ADMINISTRADOR`)
- Las fechas de WispHub vienen en formato `%d/%m/%Y` (fecha_corte) y `%d/%m/%Y %H:%M:%S` (datetimes)
- El scheduler usa timezone `America/Hermosillo`
