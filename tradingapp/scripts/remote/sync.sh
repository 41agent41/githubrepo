#!/bin/bash
# Sync local changes to TradingApp server and optionally rebuild
# Usage: ./sync.sh [sync|deploy|restart]

REMOTE_USER="tradingapp"
REMOTE_HOST="10.7.3.20"
REMOTE_PATH="/home/tradingapp/tradingapp"
LOCAL_PATH="$(dirname "$0")/../.."

case "$1" in
  sync)
    echo "Syncing files to $REMOTE_HOST..."
    rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '__pycache__' \
      "$LOCAL_PATH/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
    echo "Files synced. Run './sync.sh deploy' to rebuild containers."
    ;;
  deploy)
    echo "Syncing and deploying to $REMOTE_HOST..."
    rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '__pycache__' \
      "$LOCAL_PATH/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH/tradingapp && docker-compose up -d --build"
    ;;
  restart)
    echo "Restarting services on $REMOTE_HOST..."
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH/tradingapp && docker-compose restart"
    ;;
  logs)
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH/tradingapp && docker-compose logs --tail=50"
    ;;
  *)
    echo "Usage: $0 [sync|deploy|restart|logs]"
    echo ""
    echo "  sync    - Copy files to server (no rebuild)"
    echo "  deploy  - Copy files and rebuild containers"
    echo "  restart - Restart containers (no rebuild)"
    echo "  logs    - View recent container logs"
    ;;
esac
