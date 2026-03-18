#!/bin/bash

# バックアップスクリプト
# Usage: ./scripts/vps/backup.sh
# 実行前に: chmod +x scripts/vps/backup.sh

set -e

BACKUP_DIR="/home/deploy/backups"
APP_DIR="/home/deploy/claude-code-rss"
DATE=$(date '+%Y%m%d_%H%M%S')
LOG_FILE="/home/deploy/logs/backup.log"

echo "[$DATE] Backup started" >> $LOG_FILE

# バックアップディレクトリ作成
mkdir -p $BACKUP_DIR

cd $APP_DIR

# 設定ファイル
if [ -f .env ]; then
    cp .env $BACKUP_DIR/env-$DATE
    echo "[$DATE] .env file backed up" >> $LOG_FILE
fi

# 状態ファイル
if [ -d .state ]; then
    tar -czf $BACKUP_DIR/state-$DATE.tar.gz .state/
    echo "[$DATE] .state directory backed up" >> $LOG_FILE
fi

# Redis データ
if docker ps | grep -q rsshub-redis; then
    echo "[$DATE] Creating Redis backup..." >> $LOG_FILE
    docker exec rsshub-redis redis-cli BGSAVE
    sleep 5
    docker cp rsshub-redis:/data/dump.rdb $BACKUP_DIR/redis-$DATE.rdb
    echo "[$DATE] Redis data backed up" >> $LOG_FILE
else
    echo "[$DATE] Warning: Redis container not running, skipping Redis backup" >> $LOG_FILE
fi

# アプリケーションログ（直近7日分）
if [ -d logs ]; then
    find logs -name "*.log" -mtime -7 -print0 | tar -czf $BACKUP_DIR/app-logs-$DATE.tar.gz --null -T -
    echo "[$DATE] Application logs backed up" >> $LOG_FILE
fi

# システムログ（直近3日分）
find /home/deploy/logs -name "*.log" -mtime -3 -print0 | tar -czf $BACKUP_DIR/system-logs-$DATE.tar.gz --null -T -
echo "[$DATE] System logs backed up" >> $LOG_FILE

# 古いバックアップファイルを削除（30日以上前）
find $BACKUP_DIR -name "*" -mtime +30 -delete
echo "[$DATE] Old backup files cleaned up" >> $LOG_FILE

# バックアップサイズ確認
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo "[$DATE] Backup completed. Total size: $BACKUP_SIZE" >> $LOG_FILE

# 利用可能ディスク容量が少ない場合の警告
AVAILABLE_SPACE=$(df /home/deploy | tail -1 | awk '{print $4}')
if [ $AVAILABLE_SPACE -lt 1048576 ]; then  # 1GB = 1048576 KB
    echo "[$DATE] WARNING: Low disk space. Available: ${AVAILABLE_SPACE}KB" >> $LOG_FILE
fi