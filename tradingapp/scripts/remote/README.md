# Remote Scripts — Backup for Cursor Remote-SSH

Use these scripts when Cursor Remote-SSH is unavailable (connection issues, machine without Cursor, batch operations).

**Primary method:** [2-REMOTE_ACCESS.md](../../2-REMOTE_ACCESS.md)

## Servers

| Server | IP | Description |
|--------|-----|-------------|
| tradingapp | 10.7.3.20 | VM 100 — TradingApp (Docker) |
| timescaledb | 10.7.3.21 | LXC 120 — PostgreSQL/TimescaleDB |
| ibkr-gateway | 10.7.3.22 | VM 101 — IBKR Gateway |

## connect.sh

SSH to servers:

```bash
./connect.sh tradingapp    # SSH to VM 100
./connect.sh timescaledb   # SSH to LXC 120
./connect.sh ibkr-gateway  # SSH to VM 101
./connect.sh status        # Check all server connectivity
```

## sync.sh

Push code and manage deployment:

```bash
./sync.sh sync     # Copy files only
./sync.sh deploy   # Copy and rebuild containers
./sync.sh restart  # Restart containers
./sync.sh logs     # View container logs
```

## run-sql.sh

Run SQL files on remote TimescaleDB. Run from `scripts/remote/`:

```bash
export POSTGRES_PASSWORD=your_password
./run-sql.sh ../../backend/src/database/migration-keepalive.sql
```

## SSH Setup (if needed)

```bash
ssh-keygen -t ed25519
ssh-copy-id tradingapp@10.7.3.20
ssh-copy-id root@10.7.3.21
```

## Configuration

Server IPs are in the scripts. Edit `sync.sh`, `connect.sh`, and `run-sql.sh` directly if your infrastructure IPs differ.
