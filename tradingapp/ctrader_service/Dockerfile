# cTrader Service Dockerfile
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y gcc python3-dev curl && rm -rf /var/lib/apt/lists/*

# Build context is tradingapp root (from docker-compose)
WORKDIR /app
COPY ctrader_service/requirements.txt ./
RUN pip install --upgrade pip setuptools wheel && pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim

ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apt-get update && apt-get install -y curl tzdata && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash --uid 1000 ctrader

WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
ENV PATH=/usr/local/bin:$PATH
ENV PYTHONPATH=/app

COPY ctrader_service/ ./  # context: tradingapp root
RUN chown -R ctrader:ctrader /app

USER ctrader

HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://0.0.0.0:8002/ || exit 1

EXPOSE 8002

ENV CTRADER_SERVICE_PORT=8002
ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
