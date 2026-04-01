# Use the official Playwright image — Chromium + all system deps pre-installed.
# This avoids a ~3-minute redundant dep install on every Railway build.
FROM mcr.microsoft.com/playwright/python:v1.52.0-noble

WORKDIR /app

# Install Python dependencies (cached layer — only re-runs if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy apply engine source
COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

CMD ["uvicorn", "apply_engine.main:app", "--host", "0.0.0.0", "--port", "$PORT"]
