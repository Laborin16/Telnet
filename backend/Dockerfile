FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias primero (capa cacheable)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Directorio para DB y comprobantes (se sobreescribe con volumen en producción)
RUN mkdir -p data/comprobantes

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
