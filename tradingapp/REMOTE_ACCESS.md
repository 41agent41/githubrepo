# Remote Server Access Guide

Primary method: **Cursor Remote SSH** (direct editing on servers)  
Backup method: **Sync scripts** (push changes from local)

## Quick Setup - Cursor Remote SSH

### Step 1: Configure SSH Hosts

Add to your SSH config file (`~/.ssh/config` on Windows: `C:\Users\seana\.ssh\config`):

```ssh-config
# TradingApp Server (VM 100)
Host tradingapp
    HostName 10.7.3.20
    User tradingapp
    ForwardAgent yes

# TimescaleDB (LXC 120)
Host timescaledb
    HostName 10.7.3.21
    User root
    ForwardAgent yes

# IBKR Gateway (VM 101)
Host ibkr-gateway
    HostName 10.7.3.22
    User root
    ForwardAgent yes
```

### Step 2: Connect via Cursor

1. Press `Ctrl+Shift+P` (or `F1`)
2. Type: **"Remote-SSH: Connect to Host"**
3. Select: **`tradingapp`**
4. Open folder: `/home/tradingapp/tradingapp`

### Step 3: Work Directly on Server

Once connected:
- Edit any file directly (changes are saved on server immediately)
- Use integrated terminal: `Ctrl+` ` (backtick)
- Run commands directly:
  ```bash
  cd tradingapp
  docker-compose restart backend
  docker-compose logs -f backend
  ```

## Common Workflows

### Making Code Changes

```
1. Connect to server via Remote-SSH
2. Edit files in Cursor (auto-saved to server)
3. In terminal: docker-compose restart [service]
4. View logs: docker-compose logs -f [service]
```

### Running Database Migrations

**Option A - Via Remote SSH:**
```bash
# Connect to timescaledb via Remote-SSH
# Then run:
psql -U tradingapp -d tradingapp -f /path/to/migration.sql
```

**Option B - From TradingApp server:**
```bash
# Connect to tradingapp via Remote-SSH
# Run migration from there:
PGPASSWORD=$POSTGRES_PASSWORD psql -h 10.7.3.21 -U tradingapp -d tradingapp \
  -f backend/src/database/migration-keepalive.sql
```

### Checking Service Health

From TradingApp server terminal:
```bash
# Check containers
docker-compose ps

# Check service health
curl http://localhost:4000/api/health
curl http://localhost:8000/health

# View logs
docker-compose logs --tail=50 backend
```

## Server Quick Reference

| Server | Host Alias | IP | Path | Services |
|--------|-----------|-----|------|----------|
| **TradingApp** | `tradingapp` | 10.7.3.20 | `/home/tradingapp/tradingapp` | Frontend, Backend, IB Service |
| **TimescaleDB** | `timescaledb` | 10.7.3.21 | - | PostgreSQL:5432 |
| **IBKR Gateway** | `ibkr-gateway` | 10.7.3.22 | - | IB API:4002 |

## Backup Method: Sync Scripts

If Remote-SSH isn't working, use the sync scripts:

```bash
cd tradingapp/scripts/remote

# Push changes from local to server
./sync.sh deploy

# Run SQL migration
export POSTGRES_PASSWORD=your_password
./run-sql.sh ../../backend/src/database/migration-keepalive.sql

# Check server status
./connect.sh status
```

## Troubleshooting

### SSH Connection Issues

```bash
# Test connection
ssh tradingapp@10.7.3.20

# Check SSH key
ssh-add -l

# Generate new key if needed
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519

# Copy key to server
ssh-copy-id tradingapp@10.7.3.20
```

### Cursor Remote Extension Not Found

1. Install: `Ctrl+Shift+X` → Search "Remote - SSH"
2. Install by Microsoft (should be built-in)

### Permission Issues on Server

```bash
# Fix ownership
ssh tradingapp@10.7.3.20
sudo chown -R tradingapp:tradingapp /home/tradingapp/tradingapp
```

## Tips

- **Multiple terminals**: Each terminal in Cursor can connect to different servers
- **Port forwarding**: Right-click port in terminal output → "Forward Port"
- **File search**: Works across all files on remote server
- **Git**: Commit/push from remote server terminal
- **Extensions**: Install on remote server via Extensions panel (may prompt)

## Security Notes

- Remote-SSH uses your existing SSH keys
- All traffic is encrypted over SSH
- No files stored locally (editing happens on server)
- Changes are immediate (no sync delay)
