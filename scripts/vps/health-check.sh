#!/bin/bash

# ヘルスチェックスクリプト
# Usage: ./scripts/vps/health-check.sh
# 実行前に: chmod +x scripts/vps/health-check.sh

LOG_FILE="/home/deploy/logs/health-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
APP_DIR="/home/deploy/claude-code-rss"

echo "[$DATE] Health check started" >> $LOG_FILE

# RSSHub チェック
if curl -f -s http://localhost:1200/ > /dev/null; then
    echo "[$DATE] RSSHub: OK" >> $LOG_FILE
else
    echo "[$DATE] RSSHub: ERROR - attempting restart" >> $LOG_FILE
    cd $APP_DIR
    npm run rsshub:down
    sleep 5
    npm run rsshub:up
    sleep 10
    
    # 再チェック
    if curl -f -s http://localhost:1200/ > /dev/null; then
        echo "[$DATE] RSSHub: RECOVERED after restart" >> $LOG_FILE
    else
        echo "[$DATE] RSSHub: FAILED to recover" >> $LOG_FILE
    fi
fi

# Redis チェック
if docker exec rsshub-redis redis-cli ping > /dev/null 2>&1; then
    echo "[$DATE] Redis: OK" >> $LOG_FILE
else
    echo "[$DATE] Redis: ERROR" >> $LOG_FILE
fi

# ディスク使用量チェック（警告閾値: 80%）
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "[$DATE] Disk usage: WARNING ${DISK_USAGE}%" >> $LOG_FILE
    # 古いログファイルを削除
    find /home/deploy/logs -name "*.log" -mtime +7 -exec rm {} \;
    echo "[$DATE] Old log files cleaned" >> $LOG_FILE
else
    echo "[$DATE] Disk usage: OK (${DISK_USAGE}%)" >> $LOG_FILE
fi

# メモリ使用量チェック（警告閾値: 90%）
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "[$DATE] Memory usage: WARNING ${MEM_USAGE}%" >> $LOG_FILE
else
    echo "[$DATE] Memory usage: OK (${MEM_USAGE}%)" >> $LOG_FILE
fi

# Docker コンテナ状態チェック
if ! docker ps | grep -q rsshub; then
    echo "[$DATE] Docker: RSSHub container not running" >> $LOG_FILE
fi

if ! docker ps | grep -q rsshub-redis; then
    echo "[$DATE] Docker: Redis container not running" >> $LOG_FILE
fi

echo "[$DATE] Health check completed" >> $LOG_FILE