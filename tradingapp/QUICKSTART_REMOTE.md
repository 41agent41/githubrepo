# Quick Start - Remote Development

Get Cursor connected to your TradingApp servers in 3 steps.

## Step 1: Setup SSH Config (One-time)

Create or edit: `C:\Users\seana\.ssh\config`

```bash
# Copy from ../ssh-config-template or paste this:

Host tradingapp
    HostName 10.7.3.20
    User tradingapp
    ForwardAgent yes

Host timescaledb
    HostName 10.7.3.21
    User root
    ForwardAgent yes

Host ibkr-gateway
    HostName 10.7.3.22
    User root
    ForwardAgent yes
```

## Step 2: Test SSH Connection

Open PowerShell and test:
```powershell
ssh tradingapp
```

If it asks for password, setup SSH key:
```powershell
# Generate key (if needed)
ssh-keygen -t ed25519

# Copy to server
ssh-copy-id tradingapp@10.7.3.20
```

## Step 3: Connect Cursor

1. **F1** or **Ctrl+Shift+P**
2. Type: **Remote-SSH: Connect to Host**
3. Select: **tradingapp**
4. When connected, open folder: `/home/tradingapp/tradingapp`

## You're Ready! 🎉

Now you can:
- Edit any file directly on the server
- Changes save automatically (no sync needed)
- Use terminal: **Ctrl+`** to run commands
- Restart services: `docker-compose restart backend`
- View logs: `docker-compose logs -f backend`

## Common Tasks

### Edit Backend Code
```
File → Open Folder → /home/tradingapp/tradingapp
Navigate to: backend/src/routes/
Edit files → Auto-saved
Terminal: docker-compose restart backend
```

### Run Database Migration
```
Terminal on tradingapp server:
cd ~/tradingapp
PGPASSWORD=$POSTGRES_PASSWORD psql -h 10.7.3.21 \
  -U tradingapp -d tradingapp \
  -f backend/src/database/migration-keepalive.sql
```

### Check Service Health
```
curl localhost:4000/api/health
docker-compose ps
docker-compose logs --tail=20 backend
```

## Need Help?

See detailed guide: [REMOTE_ACCESS.md](REMOTE_ACCESS.md)

Use backup scripts: `scripts/remote/` (if SSH issues)
