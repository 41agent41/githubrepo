# TradingApp Operations Guide

**Reading order:** 2 of 4 — Read after [0-README.md](0-README.md). Next: [2-REMOTE_ACCESS.md](2-REMOTE_ACCESS.md)

Deployment and troubleshooting guide for TradingApp. All management uses the unified script `tradingapp.sh`.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start Deployment](#quick-start-deployment)
3. [Available Commands](#available-commands)
4. [Manual Deployment](#manual-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Service Verification](#service-verification)
7. [Troubleshooting](#troubleshooting)
8. [Production Setup](#production-setup)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Emergency Recovery](#emergency-recovery)

## Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **RAM**: Minimum 2GB, recommended 4GB+
- **Storage**: 10GB+ free space
- **Network**: Stable internet connection
- **Ports**: 3000, 4000, 8000 available

### Software Requirements
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: For repository cloning

### Interactive Brokers Requirements
- **IB Gateway** or **TWS** running
- **API access enabled** in IB Gateway/TWS settings
- **Market data subscriptions** for assets you want to trade
- **Paper trading account** (recommended for testing)

## Quick Start Deployment

### As root (first-time server setup)
```bash
sudo adduser <username>
sudo usermod -aG sudo <username>
apt install git
```

### As tradingapp user (with sudo privileges)
```bash
# 1. Clone repository
git clone https://github.com/41agent41/githubrepo.git tradingapp
cd tradingapp

# 2. Make script executable
chmod +x tradingapp.sh

# 3. First-time setup (installs Docker, configures environment)
./tradingapp.sh setup

# 4. Configure IB Gateway connection (prompts for IB host, port, etc.)
./tradingapp.sh config

# 5. Deploy application
./tradingapp.sh deploy

# 6. Verify deployment
./tradingapp.sh status
./tradingapp.sh test
```

## Available Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `./tradingapp.sh setup` | Install Docker, setup environment, configure IB | First time server setup |
| `./tradingapp.sh deploy` | Deploy the complete application | Initial deployment |
| `./tradingapp.sh redeploy` | Clean redeploy (recommended for code changes) | After updates |
| `./tradingapp.sh config` | Configure IB Gateway connection | Change IB settings |
| `./tradingapp.sh env` | Setup/update environment variables | Configuration |
| `./tradingapp.sh start` | Start all services | After stop |
| `./tradingapp.sh stop` | Stop all services | Maintenance |
| `./tradingapp.sh restart` | Restart all services | Quick restart |
| `./tradingapp.sh status` | Check service health | Monitoring |
| `./tradingapp.sh test` | Test all connections | Troubleshooting |
| `./tradingapp.sh logs` | View service logs | Debugging |
| `./tradingapp.sh diagnose` | Run comprehensive diagnostics | Debug issues |
| `./tradingapp.sh fix` | Auto-fix common issues | Connection problems |
| `./tradingapp.sh fix-api-url` | Fix API URL, pull code, rebuild frontend | Frontend API URL issues |
| `./tradingapp.sh verify-timestamps` | Verify IB API timestamp format | Timestamp debugging |
| `./tradingapp.sh ib-help` | IB Gateway setup instructions | IB configuration |
| `./tradingapp.sh clean` | Clean up and reset | Start fresh |

## Manual Deployment

### Step 1: System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes to take effect
```

### Step 2: Repository Setup

```bash
# Clone repository
git clone https://github.com/41agent41/githubrepo.git tradingapp
cd tradingapp

# Make script executable
chmod +x tradingapp.sh
```

### Step 3: Environment Configuration

```bash
# Create environment file from template
cp env.template .env

# Edit environment file with your settings
nano .env
```

### Step 4: Build and Deploy

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root (copy from `env.template`):

```bash
# Database Configuration (required - external PostgreSQL)
POSTGRES_HOST=10.7.3.21
POSTGRES_PORT=5432
POSTGRES_USER=tradingapp
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=tradingapp
POSTGRES_SSL=false

# Server Configuration
SERVER_IP=your.server.ip.address

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://your.server.ip.address:4000
FRONTEND_PORT=3000

# Backend Configuration
BACKEND_PORT=4000
CORS_ORIGINS=http://your.server.ip.address:3000

# IB Service Configuration
IB_SERVICE_PORT=8000
IB_HOST=your.ib.gateway.ip
IB_PORT=4002
IB_CLIENT_ID=1
IB_TIMEOUT=30

# Redis Configuration (if using)
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

**Note:** System Settings stored in the database also drive runtime (IB URL, frontend URL, ports). The backend loads these at startup via `systemSettingsService`.

### Database Setup (External PostgreSQL)

The backend requires an external PostgreSQL database. Run the schema setup **before** deploying:

```bash
# Set database connection (use your actual host and password)
export DB_HOST=10.7.3.21
export DB_USER=tradingapp
export DB_NAME=tradingapp
export POSTGRES_PASSWORD=your_password

# Run complete schema setup (creates tables, indexes, views)
./scripts/setup-database.sh
```

For migrations (e.g. after pulling updates), run SQL files manually:

```bash
# From project root, with POSTGRES_PASSWORD set
PGPASSWORD=$POSTGRES_PASSWORD psql -h 10.7.3.21 -U tradingapp -d tradingapp \
  -f backend/src/database/migration-keepalive.sql
```

Or use the remote script: `scripts/remote/run-sql.sh ../../backend/src/database/migration-keepalive.sql`

### IB Gateway Configuration

1. **Enable API Access**: File → Global Configuration → API → Settings → Check "Enable ActiveX and Socket Clients" → Set port to 4002
2. **Set Trusted IPs**: Add your server IP to trusted IP addresses
3. **Paper Trading**: Recommended for initial testing

## Service Verification

### Check Service Status

```bash
./tradingapp.sh status

# Or using Docker directly
docker-compose ps
docker-compose logs
```

### Test Service Endpoints

```bash
# Frontend
curl -I http://your-server-ip:3000

# Backend API
curl http://your-server-ip:4000/api/health

# IB Service
curl http://your-server-ip:8000/health

# Test market data search
curl -X POST http://your-server-ip:4000/api/market-data/search \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","secType":"STK","exchange":"NASDAQ"}'
```

### Access Application

- **Frontend**: `http://your-server-ip:3000`
- **Backend**: `http://your-server-ip:4000`
- **IB Service**: `http://your-server-ip:8000`

## Troubleshooting

### Quick Fix Commands

```bash
# Run comprehensive diagnostics
./tradingapp.sh diagnose

# Auto-fix common issues (creates .env, rebuilds IB service, tests connections)
./tradingapp.sh fix

# View logs
./tradingapp.sh logs
```

### Issue 1: Services Won't Start

**Symptoms:** Docker containers exit immediately, port binding errors

**Solutions:**
```bash
# Check port conflicts
sudo netstat -tlnp | grep -E ':(3000|4000|8000)'

# Stop conflicting services (if applicable)
sudo systemctl stop apache2
sudo systemctl stop nginx

# Clean restart
./tradingapp.sh stop
./tradingapp.sh clean
./tradingapp.sh deploy
```

### Issue 2: Backend cannot reach database (ECONNREFUSED 127.0.0.1:5432)

**Symptoms:** Backend logs show `Error: connect ECONNREFUSED 127.0.0.1:5432` or `::1:5432`. Connection Manager shows "Failed to fetch connection profiles". Backend API root may load but database-dependent endpoints fail.

**Cause:** The backend tries to connect to PostgreSQL on `localhost:5432`, but no database is there. Docker Compose does not include PostgreSQL; you must use an external database.

**Solutions:**

1. **Use an external database** (PostgreSQL or TimescaleDB on another host):
   ```bash
   # In .env, set:
   POSTGRES_HOST=10.7.3.21
   POSTGRES_PORT=5432
   POSTGRES_USER=tradingapp
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=tradingapp
   ```
   Then restart: `docker-compose restart backend`

2. **Ensure PostgreSQL is running** and reachable:
   ```bash
   nc -zv 10.7.3.21 5432
   ```

3. **Run migrations** (see `backend/src/database/` and SETUP_GUIDE.md). At minimum: `migration-ib-connections.sql`, `migration-keepalive.sql`.

### Issue 3: Frontend Can't Connect to Backend

**Symptoms:** Network errors in browser, API calls failing, CORS errors

**Solutions:**
```bash
# Check environment variables
cat .env | grep -E '(API_URL|CORS_ORIGINS)'

# Verify backend is running
curl http://localhost:4000/api/health

# Fix CORS in .env
CORS_ORIGINS=http://your-server-ip:3000,http://localhost:3000

# Restart frontend after env changes
docker-compose restart frontend
```

### Issue 4: IB Service Connection Issues

**Symptoms:** IB service can't connect to IB Gateway

**Solutions:**
```bash
# Configure IB connection
./tradingapp.sh config

# Run auto-fix
./tradingapp.sh fix

# Test connection
./tradingapp.sh test

# Restart IB service
docker-compose restart ib_service
```

### Issue 5: Charts Not Loading

**Solutions:**
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend

# Or full redeploy
./tradingapp.sh redeploy
```

### Issue 6: Market Data Search Not Working

**Solutions:**
```bash
# Test IB service directly
curl -X POST http://localhost:8000/contract/search \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","secType":"STK","exchange":"SMART"}'

# Check IB Gateway
curl http://localhost:8000/health

# Restart IB service
docker-compose restart ib_service
```

### Issue 7: Docker Build Failures

**Solutions:**
```bash
# Clean rebuild
./tradingapp.sh clean
./tradingapp.sh redeploy

# Or manually
docker system prune -a -f
docker-compose build --no-cache
```

### Issue 8: Port Conflicts

**Solutions:**
```bash
sudo netstat -tlnp | grep -E ':(3000|4000|8000)'
# Modify ports in .env and docker-compose.yml if needed
```

### Issue 9: Permission Errors

**Solutions:**
```bash
sudo chown -R $USER:$USER .
chmod +x tradingapp.sh
sudo usermod -aG docker $USER
# Logout and login again
```

### Common Error Messages

| Error | Likely Cause |
|-------|--------------|
| "Connection refused" | Service not running, port not accessible, firewall |
| "No such file or directory" | Missing files, incorrect paths |
| "Permission denied" | File/Docker permissions |
| "Port already in use" | Another service using the port |
| "Module not found" | Missing dependencies, package install failed |
| "CORS error" | CORS origins not configured, URL mismatch |

### Getting Help

1. Run `./tradingapp.sh diagnose` for detailed diagnostics
2. Run `./tradingapp.sh logs` for recent errors
3. Try `./tradingapp.sh fix` for auto-resolution
4. Check [0-README.md](0-README.md), [1-OPERATIONS.md](1-OPERATIONS.md), [2-REMOTE_ACCESS.md](2-REMOTE_ACCESS.md)

## Production Setup

### Domain and SSL (nginx)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# Configure nginx reverse proxy for ports 3000, 4000, 8000
sudo certbot --nginx -d your-domain.com
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000
sudo ufw allow 4000
sudo ufw allow 8000
sudo ufw enable
```

### Database Backup (external PostgreSQL)

```bash
# From database host
pg_dump -U tradingapp tradingapp > backup_$(date +%Y%m%d).sql
```

## Monitoring & Maintenance

```bash
# Check service health
./tradingapp.sh status

# Monitor resource usage
docker stats

# View logs
./tradingapp.sh logs
docker-compose logs -f backend
```

### Update Process

```bash
cd /path/to/tradingapp
git pull origin master
./tradingapp.sh redeploy
```

## Emergency Recovery

### Complete System Reset

```bash
./tradingapp.sh stop
./tradingapp.sh clean
docker system prune -a -f
docker volume prune -f
./tradingapp.sh deploy
```

### Configuration Recovery

```bash
cp env.template .env
nano .env
./tradingapp.sh test
```

## Deployment Checklist

- [ ] Server meets minimum requirements
- [ ] Docker and Docker Compose installed
- [ ] Repository cloned, `tradingapp.sh` executable
- [ ] Environment variables set in `.env` (especially `POSTGRES_*`)
- [ ] External PostgreSQL running and reachable
- [ ] Migrations run on database
- [ ] IB Gateway/TWS running and API enabled
- [ ] `./tradingapp.sh deploy` completed
- [ ] `./tradingapp.sh status` and `./tradingapp.sh test` pass
- [ ] Frontend accessible, charts loading
