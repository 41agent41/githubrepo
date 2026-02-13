#!/bin/bash

# TradingApp Deployment Script
# Supports: install, deploy, rebuild, ib-rebuild, status, test, logs, restart, stop, clean, env-setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configure Docker daemon for container compatibility
configure_docker_daemon() {
    log_info "Configuring Docker daemon for container compatibility..."
    
    DAEMON_JSON="/etc/docker/daemon.json"
    
    # Check if daemon.json exists
    if [ -f "$DAEMON_JSON" ]; then
        log_info "Docker daemon.json exists, checking configuration..."
        # Backup existing config
        sudo cp "$DAEMON_JSON" "${DAEMON_JSON}.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    # Create or update daemon.json with required settings
    sudo mkdir -p /etc/docker
    
    # Create daemon.json with settings to fix sysctl permission issues
    sudo tee "$DAEMON_JSON" > /dev/null << 'EOF'
{
    "no-new-privileges": false,
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF
    
    log_success "Docker daemon.json configured"
    
    # Set sysctl on host for unprivileged port binding
    log_info "Setting host sysctl for container compatibility..."
    sudo sysctl -w net.ipv4.ip_unprivileged_port_start=0 || true
    
    # Make sysctl permanent
    if ! grep -q "net.ipv4.ip_unprivileged_port_start" /etc/sysctl.conf 2>/dev/null; then
        echo "net.ipv4.ip_unprivileged_port_start=0" | sudo tee -a /etc/sysctl.conf > /dev/null
        log_info "Added sysctl setting to /etc/sysctl.conf"
    fi
    
    # Restart Docker to apply changes
    log_info "Restarting Docker daemon..."
    sudo systemctl restart docker
    
    # Wait for Docker to be ready
    sleep 3
    
    if sudo systemctl is-active --quiet docker; then
        log_success "Docker daemon restarted successfully"
    else
        log_error "Docker daemon failed to restart"
        return 1
    fi
}

# Install Docker and dependencies
install_docker() {
    log_info "Installing Docker and dependencies..."
    
    # Update system
    sudo apt update
    
    # Install prerequisites
    sudo apt install -y curl wget git ca-certificates gnupg lsb-release
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        log_info "Docker is already installed"
        docker --version
    else
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh
        log_success "Docker installed"
    fi
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        log_info "Docker Compose is already installed"
    else
        log_info "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        log_success "Docker Compose installed"
    fi
    
    # Configure Docker daemon for container compatibility
    configure_docker_daemon
    
    log_success "Installation complete!"
    log_warning "Please logout and login again for Docker group changes to take effect"
}

# Setup environment file
env_setup() {
    log_info "Setting up environment file..."
    
    if [ -f ".env" ]; then
        log_warning ".env file already exists. Creating backup..."
        cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    if [ -f "env.template" ]; then
        cp env.template .env
        log_success "Created .env from template"
        log_info "Please edit .env file with your settings: nano .env"
    else
        log_warning "No env.template found. Creating basic .env..."
        cat > .env << 'EOF'
# Server Configuration
SERVER_IP=localhost
ENVIRONMENT=production
NODE_ENV=production

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
FRONTEND_PORT=3000
FRONTEND_HOST=0.0.0.0

# Backend Configuration
BACKEND_PORT=4000
BACKEND_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000

# IB Service Configuration
IB_SERVICE_PORT=8000
IB_PORT=4002
IB_CLIENT_ID=1
IB_TIMEOUT=30

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=tradingapp
POSTGRES_PASSWORD=tradingapp123
POSTGRES_DB=tradingapp
POSTGRES_SSL=false

# Redis Configuration
REDIS_HOST=172.20.0.30
REDIS_PORT=6379
REDIS_PASSWORD=

# Security
JWT_SECRET=changeme_jwt_secret
SESSION_SECRET=changeme_session_secret
EOF
        log_success "Created basic .env file"
        log_info "Please edit .env file with your settings: nano .env"
    fi
}

# Deploy application
deploy() {
    log_info "Deploying TradingApp..."
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Running env-setup..."
        env_setup
    fi
    
    # Ensure Docker daemon is properly configured
    configure_docker_daemon
    
    # Navigate to tradingapp directory if we're in the parent
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    # Build and start services
    log_info "Building Docker images..."
    docker-compose build
    
    log_info "Starting services..."
    docker-compose up -d
    
    log_success "Deployment complete!"
    
    # Show status
    sleep 3
    status
}

# Rebuild all services
rebuild() {
    log_info "Rebuilding all services..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    
    log_success "Rebuild complete!"
    sleep 3
    status
}

# Rebuild IB service only
ib_rebuild() {
    log_info "Rebuilding IB service..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    docker-compose stop ib_service
    docker-compose rm -f ib_service
    docker-compose build --no-cache ib_service
    docker-compose up -d ib_service
    
    log_success "IB service rebuild complete!"
}

# Check service status
status() {
    log_info "Checking service status..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    echo ""
    echo "=== Docker Containers ==="
    docker-compose ps
    
    echo ""
    echo "=== Service Health ==="
    
    # Check frontend
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|304"; then
        echo -e "Frontend:   ${GREEN}✓ Running${NC}"
    else
        echo -e "Frontend:   ${RED}✗ Not responding${NC}"
    fi
    
    # Check backend
    if curl -s http://localhost:4000/health 2>/dev/null | grep -q "ok\|healthy"; then
        echo -e "Backend:    ${GREEN}✓ Running${NC}"
    else
        echo -e "Backend:    ${RED}✗ Not responding${NC}"
    fi
    
    # Check IB service
    if curl -s http://localhost:8000/health 2>/dev/null | grep -q "ok\|healthy\|status"; then
        echo -e "IB Service: ${GREEN}✓ Running${NC}"
    else
        echo -e "IB Service: ${RED}✗ Not responding${NC}"
    fi
    
    echo ""
}

# Test connections
test_connections() {
    log_info "Testing all connections..."
    
    echo ""
    echo "=== Connection Tests ==="
    
    # Test frontend
    echo -n "Frontend (localhost:3000): "
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|304"; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi
    
    # Test backend
    echo -n "Backend (localhost:4000): "
    BACKEND_RESPONSE=$(curl -s http://localhost:4000/health 2>/dev/null)
    if [ -n "$BACKEND_RESPONSE" ]; then
        echo -e "${GREEN}OK${NC}"
        echo "  Response: $BACKEND_RESPONSE"
    else
        echo -e "${RED}FAILED${NC}"
    fi
    
    # Test IB service
    echo -n "IB Service (localhost:8000): "
    IB_RESPONSE=$(curl -s http://localhost:8000/health 2>/dev/null)
    if [ -n "$IB_RESPONSE" ]; then
        echo -e "${GREEN}OK${NC}"
        echo "  Response: $IB_RESPONSE"
    else
        echo -e "${RED}FAILED${NC}"
    fi
    
    echo ""
}

# Show logs
show_logs() {
    log_info "Showing service logs..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    docker-compose logs --tail=100
}

# Restart services
restart() {
    log_info "Restarting services..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    docker-compose restart
    
    log_success "Services restarted!"
    sleep 3
    status
}

# Stop services
stop() {
    log_info "Stopping services..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    docker-compose down
    
    log_success "Services stopped!"
}

# Clean up containers and images
clean() {
    log_info "Cleaning up containers and images..."
    
    # Navigate to tradingapp directory if needed
    if [ -d "tradingapp" ] && [ -f "tradingapp/docker-compose.yml" ]; then
        cd tradingapp
    fi
    
    docker-compose down -v --rmi local
    docker system prune -f
    
    log_success "Cleanup complete!"
}

# Show help
show_help() {
    echo ""
    echo "TradingApp Deployment Script"
    echo ""
    echo "Usage: ./deploy-tradingapp.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install     Install Docker & dependencies (first time setup)"
    echo "  deploy      Deploy full application"
    echo "  rebuild     Rebuild all services"
    echo "  ib-rebuild  Rebuild IB service only"
    echo "  status      Check service health"
    echo "  test        Test all connections"
    echo "  logs        Show service logs"
    echo "  restart     Restart services"
    echo "  stop        Stop all services"
    echo "  clean       Clean up containers"
    echo "  env-setup   Setup environment file"
    echo "  help        Show this help message"
    echo ""
}

# Main command handler
case "${1:-help}" in
    install)
        install_docker
        ;;
    deploy)
        deploy
        ;;
    rebuild)
        rebuild
        ;;
    ib-rebuild)
        ib_rebuild
        ;;
    status)
        status
        ;;
    test)
        test_connections
        ;;
    logs)
        show_logs
        ;;
    restart)
        restart
        ;;
    stop)
        stop
        ;;
    clean)
        clean
        ;;
    env-setup)
        env_setup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
