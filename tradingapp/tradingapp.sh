#!/bin/bash

# 🚀 TradingApp Unified Management Script
# Consolidates all deployment, configuration, and troubleshooting functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Configuration
DEFAULT_SERVER_IP="10.7.3.20"

show_usage() {
    echo "🚀 TradingApp Unified Management Script"
    echo "======================================"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Setup & Deployment:"
    echo "  setup       - Install Docker, setup environment, configure IB"
    echo "  deploy      - Deploy the complete application"
    echo "  redeploy    - Clean redeploy (recommended for changes)"
    echo ""
    echo "Configuration:"
    echo "  config      - Configure IB Gateway connection"
    echo "  env         - Setup/update environment variables"
    echo ""
    echo "Management:"
    echo "  start       - Start all services"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  status      - Check service status"
    echo "  logs        - View service logs"
    echo ""
    echo "Troubleshooting:"
echo "  test        - Test all connections"
echo "  diagnose    - Run comprehensive diagnostics"
echo "  fix         - Auto-fix common issues"
echo "  ib-help     - IB Gateway setup instructions"
echo "  clean       - Clean up and reset"
    echo ""
    echo "Examples:"
echo "  $0 setup     # First time setup"
echo "  $0 deploy    # Deploy application"
echo "  $0 test      # Test connections"
echo "  $0 fix       # Fix connection issues"
}

check_requirements() {
    print_info "Checking system requirements..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_error "Don't run this script as root. Use a user with sudo privileges."
        exit 1
    fi
    
    # Check for sudo
    if ! sudo -n true 2>/dev/null; then
        print_warning "This script requires sudo privileges. You may be prompted for password."
    fi
    
    print_status "System requirements check passed"
}

configure_docker_daemon() {
    print_info "Configuring Docker daemon for container compatibility..."
    
    DAEMON_JSON="/etc/docker/daemon.json"
    
    # Check if daemon.json exists and backup
    if [ -f "$DAEMON_JSON" ]; then
        print_info "Docker daemon.json exists, creating backup..."
        sudo cp "$DAEMON_JSON" "${DAEMON_JSON}.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    # Create or update daemon.json with required settings
    sudo mkdir -p /etc/docker
    
    # Create daemon.json with settings to fix sysctl permission issues on headless Linux
    sudo tee "$DAEMON_JSON" > /dev/null << 'DAEMON_EOF'
{
    "no-new-privileges": false,
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
DAEMON_EOF
    
    print_status "Docker daemon.json configured"
    
    # Set sysctl on host for container compatibility
    print_info "Setting host sysctl for container compatibility..."
    sudo sysctl -w net.ipv4.ip_unprivileged_port_start=0 2>/dev/null || true
    
    # Make sysctl permanent
    if ! grep -q "net.ipv4.ip_unprivileged_port_start" /etc/sysctl.conf 2>/dev/null; then
        echo "net.ipv4.ip_unprivileged_port_start=0" | sudo tee -a /etc/sysctl.conf > /dev/null
        print_info "Added sysctl setting to /etc/sysctl.conf"
    fi
    
    # Restart Docker to apply changes
    print_info "Restarting Docker daemon..."
    sudo systemctl restart docker
    
    # Wait for Docker to be ready
    sleep 3
    
    if sudo systemctl is-active --quiet docker; then
        print_status "Docker daemon configured and restarted successfully"
    else
        print_error "Docker daemon failed to restart"
        return 1
    fi
}

install_docker() {
    print_info "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        print_status "Docker already installed: $(docker --version)"
        # Still configure daemon for compatibility
        configure_docker_daemon
        return 0
    fi
    
    # Update system
    sudo apt update
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Configure Docker daemon for headless Linux compatibility
    configure_docker_daemon
    
    print_status "Docker installed successfully"
    print_warning "Please log out and log back in for docker group changes to take effect"
}

setup_environment() {
    print_info "Setting up environment configuration..."
    
    # Get server IP
    if [[ -z "$SERVER_IP" ]]; then
        SERVER_IP=$(hostname -I | awk '{print $1}' | head -1)
        if [[ -z "$SERVER_IP" ]]; then
            SERVER_IP="$DEFAULT_SERVER_IP"
        fi
    fi
    
    # Create streamlined .env file
    # Note: IB Gateway connections are now configured via browser UI at /connections
    cat > .env << EOF
# TradingApp Configuration
# IB Gateway connections are configured via browser at: http://$SERVER_IP:3000/connections
NODE_ENV=production
SERVER_IP=$SERVER_IP

# Frontend
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=http://$SERVER_IP:4000

# Backend
BACKEND_PORT=4000
CORS_ORIGINS=http://$SERVER_IP:3000

# IB Service
IB_SERVICE_PORT=8000

# Database
POSTGRES_USER=tradingapp
POSTGRES_PASSWORD=tradingapp123
POSTGRES_DB=tradingapp

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
EOF
    
    print_status "Environment configured:"
    print_info "  Server IP: $SERVER_IP"
    print_info "  Frontend: http://$SERVER_IP:3000"
    print_info "  Backend: http://$SERVER_IP:4000"
    print_info "  IB Connections: Configure via http://$SERVER_IP:3000/connections"
}

test_ib_connection() {
    print_info "Testing IB Gateway connection via Connection Manager..."
    
    # Get server IP from .env or default
    local server_ip="${SERVER_IP:-localhost}"
    if [[ -f .env ]]; then
        source .env
        server_ip="${SERVER_IP:-localhost}"
    fi
    
    # Query the backend API for IB connection status (Connection Manager)
    local status_response
    status_response=$(curl -s "http://${server_ip}:4000/api/ib-connections/status" 2>/dev/null)
    
    if [[ -z "$status_response" ]]; then
        print_warning "Could not query IB Connection Manager (backend may still be starting)"
        print_info "IB connections are managed via the web UI at: http://${server_ip}:3000/connections"
        return 0  # Non-blocking - connection can be configured via UI
    fi
    
    # Check if connected using the API response
    local is_connected
    is_connected=$(echo "$status_response" | grep -o '"connected":[^,}]*' | head -1 | cut -d':' -f2 | tr -d ' ')
    
    if [[ "$is_connected" == "true" ]]; then
        # Extract profile name if available
        local profile_name
        profile_name=$(echo "$status_response" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        print_status "IB Gateway connected via profile: ${profile_name:-unknown}"
        return 0
    else
        print_warning "IB Gateway not connected"
        print_info "Configure IB connections via the web UI at: http://${server_ip}:3000/connections"
        print_info "  1. Create or edit a connection profile"
        print_info "  2. Click 'Connect' to activate the profile"
        print_info "  3. Ensure IB Gateway/TWS is running on the target host"
        return 0  # Non-blocking - this is expected if IB Gateway isn't running
    fi
}

deploy_application() {
    print_info "Deploying TradingApp..."
    
    # Ensure Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Clean deployment for reliability
    print_info "Cleaning previous deployment..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build and start services
    print_info "Building and starting services..."
    docker-compose up --build -d
    
    # Wait for services to be ready
    print_info "Waiting for services to start..."
    sleep 10
    
    # Verify TWS API installation
    print_info "Verifying TWS API installation..."
    if docker-compose exec -T ib_service python -c "import ibapi; print('TWS API installed successfully')" 2>/dev/null; then
        print_status "TWS API (ibapi) is properly installed"
    else
        print_error "TWS API installation verification failed"
        print_info "This may indicate a Docker cache issue. Try: $0 clean && $0 deploy"
        return 1
    fi
    
    # Test deployment
    test_deployment
}

test_deployment() {
    print_info "Testing deployment..."
    
    local success=true
    
    # Test frontend
    if curl -s -f http://${SERVER_IP:-localhost}:3000 > /dev/null; then
        print_status "Frontend is responding"
    else
        print_error "Frontend is not responding"
        success=false
    fi
    
    # Test backend
    if curl -s -f http://${SERVER_IP:-localhost}:4000 > /dev/null; then
        print_status "Backend is responding"
    else
        print_error "Backend is not responding"
        success=false
    fi
    
    # Test IB service
    if curl -s -f http://${SERVER_IP:-localhost}:8000/health > /dev/null; then
        print_status "IB Service is responding"
    else
        print_error "IB Service is not responding"
        success=false
    fi
    
    # Test IB connection (non-blocking - managed via Connection Manager UI)
    test_ib_connection
    # Note: IB connection failures don't block deployment
    # Connections are now managed via the web UI at /connections
    
    if $success; then
        print_status "All tests passed!"
        show_access_info
    else
        print_error "Some tests failed. Check logs with: $0 logs"
        return 1
    fi
}

show_access_info() {
    local server_ip=$(grep SERVER_IP .env | cut -d'=' -f2)
    echo ""
    print_status "🚀 TradingApp is running!"
    echo ""
    echo "Access URLs:"
    echo "  Frontend:   http://$server_ip:3000"
    echo "  Backend:    http://$server_ip:4000"
    echo "  IB Service: http://$server_ip:8000"
    echo ""
    echo "Management:"
    echo "  Check status: $0 status"
    echo "  View logs:    $0 logs"
    echo "  Test system:  $0 test"
}

run_diagnostics() {
    print_info "Running comprehensive diagnostics..."
    
    echo ""
    echo "=== System Status ==="
    docker --version 2>/dev/null || echo "Docker not installed"
    docker-compose --version 2>/dev/null || echo "Docker Compose not installed"
    
    echo ""
    echo "=== Docker Status ==="
    if docker info &> /dev/null; then
        print_status "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        return 1
    fi
    
    echo ""
    echo "=== Container Status ==="
    docker-compose ps 2>/dev/null || echo "No containers running"
    
    echo ""
    echo "=== Environment ==="
    if [[ -f .env ]]; then
        print_status ".env file exists"
        echo "Configuration:"
        grep -E "^(SERVER_IP|FRONTEND_PORT|BACKEND_PORT|IB_SERVICE_PORT)=" .env | sed 's/^/  /'
    else
        print_error ".env file missing"
    fi
    
    echo ""
    echo "=== IB Connection Status ==="
    test_ib_connection
    
    echo ""
    echo "=== Service Tests ==="
    test_deployment
}

fix_issues() {
    print_info "Auto-fixing common issues..."
    
    # Fix 1: Ensure .env exists
    if [[ ! -f .env ]]; then
        print_info "Creating missing .env file..."
        setup_environment
    fi
    
    # Fix 2: Restart services
    print_info "Restarting services..."
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose up --build -d
    
    # Fix 3: Wait and test
    print_info "Waiting for services to stabilize..."
    sleep 15
    
    # Fix 4: Test everything
    test_deployment
    
    print_status "Auto-fix completed!"
}

show_logs() {
    print_info "Showing service logs..."
    
    if [[ "$1" == "follow" ]] || [[ "$1" == "-f" ]]; then
        docker-compose logs -f
    else
        echo "=== Recent logs (last 20 lines per service) ==="
        echo ""
        echo "--- Frontend ---"
        docker-compose logs --tail=20 frontend 2>/dev/null || echo "Frontend not running"
        echo ""
        echo "--- Backend ---"
        docker-compose logs --tail=20 backend 2>/dev/null || echo "Backend not running"
        echo ""
        echo "--- IB Service ---"
        docker-compose logs --tail=20 ib_service 2>/dev/null || echo "IB Service not running"
    fi
}

show_ib_help() {
    echo ""
    print_info "🔧 IB Gateway Setup Instructions"
    echo "=================================="
    echo ""
    
    local server_ip="${SERVER_IP:-localhost}"
    if [[ -f .env ]]; then
        source .env
        server_ip="${SERVER_IP:-localhost}"
    fi
    
    echo "📱 IB Connection Manager (Recommended):"
    echo "   IB connections are now managed via the web UI!"
    echo "   Visit: http://${server_ip}:3000/connections"
    echo ""
    echo "   Features:"
    echo "   - Create multiple connection profiles (Live/Paper)"
    echo "   - Switch connections with one click"
    echo "   - Automatic keep-alive (reconnects if disconnected)"
    echo "   - Connection history and statistics"
    echo ""
    
    echo "📋 IB Gateway Setup Checklist:"
    echo ""
    echo "1. 🖥️  Start IB Gateway or TWS:"
    echo "   - Launch IB Gateway or Trader Workstation"
    echo "   - Log in with your Interactive Brokers account"
    echo "   - Ensure it's connected (not offline mode)"
    echo ""
    
    echo "2. ⚙️  Configure API Settings in IB Gateway/TWS:"
    echo "   - Go to: File → Global Configuration → API → Settings"
    echo "   - ✅ Check 'Enable ActiveX and Socket Clients'"
    echo "   - ✅ Set Socket port to: 4002 (paper) or 4001 (live)"
    echo "   - ✅ Set Master API client ID to: 1"
    echo "   - ✅ Uncheck 'Read-Only API' (if you want to place orders)"
    echo ""
    
    echo "3. 🌐 Configure Trusted IPs in IB Gateway/TWS:"
    echo "   - In the same API Settings window"
    echo "   - Add trusted IP: ${server_ip}"
    echo "   - Add trusted IP: 127.0.0.1 (localhost)"
    echo "   - Format: one IP per line"
    echo ""
    
    echo "4. 💾 Apply and Restart:"
    echo "   - Click 'Apply' then 'OK'"
    echo "   - Close and restart IB Gateway/TWS"
    echo "   - Wait for it to fully connect to IB servers"
    echo ""
    
    echo "5. 🧪 Connect via Web UI:"
    echo "   - Go to: http://${server_ip}:3000/connections"
    echo "   - Create or edit a connection profile"
    echo "   - Set the host to your IB Gateway machine's IP"
    echo "   - Click 'Connect' to activate"
    echo ""
    
    echo "📞 Common Issues:"
    echo ""
    echo "❌ 'Connection refused' → IB Gateway not running or wrong port"
    echo "❌ 'Timeout' → Firewall blocking or wrong IP address"
    echo "❌ 'Host unreachable' → Network connectivity issue"
    echo "❌ 'Client ID conflict' → Try different client ID (1, 2, 3...)"
    echo ""
    
    print_status "Configure IB connections at: http://${server_ip}:3000/connections"
}

# Main command handling
case "${1:-}" in
    "setup")
        check_requirements
        install_docker
        setup_environment
        print_status "Setup complete! Run '$0 deploy' to start the application."
        ;;
    "deploy")
        deploy_application
        ;;
    "redeploy")
        print_info "Clean redeployment (recommended for changes)..."
        docker-compose down --remove-orphans
        
        # Remove project images to ensure fresh build
        docker rmi $(docker images -q tradingapp_ib_service) 2>/dev/null || echo "No ib_service images to remove"
        docker rmi $(docker images -q tradingapp_backend) 2>/dev/null || echo "No backend images to remove"
        docker rmi $(docker images -q tradingapp_frontend) 2>/dev/null || echo "No frontend images to remove"
        
        # Clear build cache
        docker system prune -f
        docker builder prune -f
        
        deploy_application
        ;;
    "config")
        setup_environment
        print_status "Configuration updated. Run '$0 redeploy' to apply changes."
        ;;
    "env")
        setup_environment
        ;;
    "start")
        docker-compose up -d
        print_status "Services started"
        ;;
    "stop")
        docker-compose down --remove-orphans
        print_status "Services stopped"
        ;;
    "restart")
        docker-compose restart
        print_status "Services restarted"
        ;;
    "status")
        docker-compose ps
        ;;
    "logs")
        show_logs "$2"
        ;;
    "test")
        test_deployment
        ;;
    "diagnose")
        run_diagnostics
        ;;
    "fix")
        fix_issues
        ;;
    "ib-help")
        show_ib_help
        ;;
    "clean")
        print_warning "This will remove all containers, images, and data. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            print_info "Performing complete cleanup..."
            
            # Stop and remove containers
            docker-compose down --remove-orphans
            
            # Remove all project images
            docker rmi $(docker images -q tradingapp_ib_service) 2>/dev/null || echo "No ib_service images to remove"
            docker rmi $(docker images -q tradingapp_backend) 2>/dev/null || echo "No backend images to remove"
            docker rmi $(docker images -q tradingapp_frontend) 2>/dev/null || echo "No frontend images to remove"
            
            # Clear all Docker cache and unused resources
            docker system prune -af
            docker volume prune -f
            docker builder prune -f
            
            print_status "Complete cleanup finished. Run '$0 deploy' to rebuild from scratch."
        fi
        ;;

    "help"|"--help"|"-h")
        show_usage
        ;;
    *)
        if [[ -z "${1:-}" ]]; then
            show_usage
        else
            print_error "Unknown command: $1"
            show_usage
            exit 1
        fi
        ;;
esac 