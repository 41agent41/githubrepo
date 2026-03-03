# TradingApp Scripts

## setup-database.sh

Runs the complete database schema setup. Use before first deployment.

```bash
export DB_HOST=10.7.3.21
export DB_USER=tradingapp
export POSTGRES_PASSWORD=your_password

./scripts/setup-database.sh
```

See [1-OPERATIONS.md](../1-OPERATIONS.md) for full database setup instructions.

## remote/ — Backup when Cursor Remote-SSH unavailable

Scripts for pushing code and running SQL when Remote-SSH is not available.

| Script | Purpose |
|--------|---------|
| **sync.sh** | Rsync to server, deploy, restart, view logs |
| **connect.sh** | SSH to tradingapp, timescaledb, or ibkr-gateway |
| **run-sql.sh** | Run SQL files on remote TimescaleDB |

**Primary method:** Use [2-REMOTE_ACCESS.md](../2-REMOTE_ACCESS.md) (Cursor Remote-SSH) for direct server access.
