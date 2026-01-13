# Backup Sync Scripts

These scripts are a **backup method** for when Cursor Remote-SSH isn't available.

**Primary method:** Use Cursor Remote-SSH (see [REMOTE_ACCESS.md](../../REMOTE_ACCESS.md))

## When to Use These Scripts

- Remote-SSH connection issues
- Working on a machine without Cursor
- Need to push changes from local development
- Batch operations or automation

## Available Scripts

### connect.sh
SSH directly to servers:
```bash
./connect.sh tradingapp    # SSH to VM 100
./connect.sh timescaledb   # SSH to LXC 120
./connect.sh ibkr-gateway  # SSH to VM 101
./connect.sh status        # Check all servers
```

### sync.sh
Push code changes from local to TradingApp server:
```bash
./sync.sh sync     # Copy files only
./sync.sh deploy   # Copy and rebuild containers
./sync.sh restart  # Restart containers
./sync.sh logs     # View container logs
```

### run-sql.sh
Execute SQL files on TimescaleDB:
```bash
export POSTGRES_PASSWORD=your_password
./run-sql.sh ../../backend/src/database/migration-keepalive.sql
```

## Configuration

Edit server details in `servers.json` if IPs change.
