#!/bin/bash
# Arranca el backend y frontend para desarrollo local

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ── Backend ──────────────────────────────────────────────────────────────────
echo "==> Configurando backend..."

if [ ! -d "$BACKEND/.venv" ]; then
    echo "    Creando entorno virtual Python..."
    python3 -m venv "$BACKEND/.venv"
fi

source "$BACKEND/.venv/bin/activate"

echo "    Instalando dependencias Python..."
pip install -q -r "$BACKEND/requirements.txt"

mkdir -p "$BACKEND/data/comprobantes"

echo "    Iniciando backend en http://localhost:8000"
cd "$BACKEND"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "==> Configurando frontend..."

cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
    echo "    Instalando dependencias npm..."
    npm install
fi

echo "    Iniciando frontend en http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

# ── Esperar ───────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo "========================================"
echo "  Ctrl+C para detener todo"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
