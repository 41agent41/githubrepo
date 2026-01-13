# Remote Server Access

Simple scripts to connect to and manage the TradingApp infrastructure.

## Servers

| Server | IP | Description |
|--------|-----|-------------|
| VM 100 | 10.7.3.20 | TradingApp (Docker) |
| LXC 120 | 10.7.3.21 | TimescaleDB (PostgreSQL) |
| VM 101 | 10.7.3.22 | IBKR Gateway |

## Quick Commands

```bash
# Check all server connectivity
./connect.sh status

# SSH to TradingApp server
./connect.sh tradingapp

# SSH to database server
./connect.sh timescaledb

# SSH to IBKR gateway
./connect.sh ibkr-gateway
```

## Deploying Changes

```bash
# Sync files only (no rebuild)
./sync.sh sync

# Sync and rebuild containers
./sync.sh deploy

# Restart containers
./sync.sh restart

# View logs
./sync.sh logs
```

## Running SQL Migrations

```bash
# Set password
export POSTGRES_PASSWORD=your_password

# Run a migration
./run-sql.sh ../backend/src/database/migration-keepalive.sql
```

## SSH Setup (if needed)

Generate and copy SSH key to servers:

```bash
# Generate key (if you don't have one)
ssh-keygen -t ed25519

# Copy to TradingApp server
ssh-copy-id tradingapp@10.7.3.20

# Copy to database server
ssh-copy-id root@10.7.3.21
```
