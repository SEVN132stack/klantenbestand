FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY create_admin.py .

RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "python create_admin.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
