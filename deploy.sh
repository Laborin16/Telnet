#!/bin/bash
# deploy.sh — primera vez o actualizaciones posteriores
set -e
cd "$(dirname "$0")"

echo "=== 1. Backend: crear entorno virtual e instalar dependencias ==="
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r backend/requirements.txt

echo "=== 2. Frontend: instalar dependencias y compilar ==="
cd frontend
npm ci
npm run build
cd ..

echo "=== 3. Crear directorio de datos si no existe ==="
mkdir -p backend/data/comprobantes

echo "=== 4. Instalar servicio systemd ==="
sudo cp wisp-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wisp-backend
sudo systemctl restart wisp-backend

echo "=== 5. Copiar config de nginx ==="
sudo cp nginx.conf /etc/nginx/sites-available/telnet-hillo.com
sudo ln -sf /etc/nginx/sites-available/telnet-hillo.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✓ Deploy completado"
echo "  Backend: systemctl status wisp-backend"
echo "  Logs:    journalctl -u wisp-backend -f"
