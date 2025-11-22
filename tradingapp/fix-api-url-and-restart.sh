#!/bin/bash
# Fix API URL configuration and restart services
# Run this script on your remote server where Docker is running

echo "=========================================="
echo "TradingApp API URL Fix & Restart Script"
echo "=========================================="
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy env.template to .env and configure it first:"
    echo "  cp env.template .env"
    echo "  nano .env  # Edit with your server IP"
    exit 1
fi

# Show current API URL configuration
echo "Current NEXT_PUBLIC_API_URL configuration:"
grep "NEXT_PUBLIC_API_URL" .env || echo "  ⚠️  NEXT_PUBLIC_API_URL not found in .env"
echo ""

# Prompt for confirmation
echo "This script will:"
echo "  1. Pull latest code from git"
echo "  2. Rebuild the frontend container (to apply API URL and code fixes)"
echo "  3. Restart all services"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Pulling latest code..."
git pull

echo ""
echo "Step 2: Stopping services..."
docker-compose down

echo ""
echo "Step 3: Rebuilding frontend with updated API URL and code fixes..."
docker-compose build --no-cache frontend

echo ""
echo "Step 4: Starting all services..."
docker-compose up -d

echo ""
echo "Step 5: Waiting for services to start..."
sleep 10

echo ""
echo "Step 6: Checking service status..."
docker-compose ps

echo ""
echo "Step 7: Checking frontend logs for API URL..."
echo "----------------------------------------"
docker-compose logs frontend | grep -i "API URL\|NEXT_PUBLIC" | tail -5
echo "----------------------------------------"

echo ""
echo "✅ Done!"
echo ""
echo "The frontend has been rebuilt with:"
echo "  - Updated code (with X-Data-Query-Enabled headers)"
echo "  - Configured API URL from .env file"
echo ""
echo "Please verify:"
echo "  1. Check your .env file has: NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:4000"
echo "  2. Visit http://YOUR_SERVER_IP:3000/configure and test symbol search"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f frontend"
echo "  docker-compose logs -f backend"

