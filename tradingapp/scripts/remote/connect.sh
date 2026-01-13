#!/bin/bash
# Simple remote connection helper for TradingApp servers
# Usage: ./connect.sh [tradingapp|timescaledb|ibkr-gateway]

case "$1" in
  tradingapp|app)
    echo "Connecting to TradingApp server (VM 100)..."
    ssh tradingapp@10.7.3.20
    ;;
  timescaledb|db)
    echo "Connecting to TimescaleDB (LXC 120)..."
    ssh root@10.7.3.21
    ;;
  ibkr-gateway|ibkr|ib)
    echo "Connecting to IBKR Gateway (VM 101)..."
    ssh root@10.7.3.22
    ;;
  status)
    echo "Checking server connectivity..."
    echo ""
    echo "TradingApp (10.7.3.20):"
    curl -s http://10.7.3.20:4000/api/health --max-time 5 | head -c 200 || echo "unreachable"
    echo ""
    echo ""
    echo "TimescaleDB (10.7.3.21:5432):"
    timeout 3 bash -c "echo > /dev/tcp/10.7.3.21/5432" 2>/dev/null && echo "port open" || echo "unreachable"
    echo ""
    echo "IBKR Gateway (10.7.3.22:4002):"
    timeout 3 bash -c "echo > /dev/tcp/10.7.3.22/4002" 2>/dev/null && echo "port open" || echo "unreachable"
    ;;
  *)
    echo "Usage: $0 [tradingapp|timescaledb|ibkr-gateway|status]"
    echo ""
    echo "Servers:"
    echo "  tradingapp  - VM 100 (10.7.3.20) - Docker host"
    echo "  timescaledb - LXC 120 (10.7.3.21) - Database"
    echo "  ibkr-gateway - VM 101 (10.7.3.22) - IB API"
    echo ""
    echo "  status - Check all server connectivity"
    ;;
esac
