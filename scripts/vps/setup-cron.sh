#!/bin/bash

# cron 設定スクリプト
# Usage: ./scripts/vps/setup-cron.sh
# 実行前に: chmod +x scripts/vps/setup-cron.sh

set -e

APP_DIR="/home/deploy/claude-code-rss"
LOG_DIR="/home/deploy/logs"

echo "=== cron ジョブ設定開始 ==="

# 現在の crontab を取得（存在しない場合は空）
crontab -l > /tmp/crontab.current 2>/dev/null || touch /tmp/crontab.current

# このスクリプトが追加するジョブ（重複登録防止のため既存エントリを削除してから追加）
sed -i '/claude-code-rss/d;/health-check\.sh/d;/backup\.sh/d;/rsshub:down.*rsshub:up/d;/DEBIAN_FRONTEND.*apt upgrade/d' /tmp/crontab.current

# 新しいジョブを追記
cat >> /tmp/crontab.current << EOF

# RSS収集バッチ実行（毎日 8:00 JST = 23:00 UTC）
0 23 * * * cd $APP_DIR && /usr/bin/npm run run >> $LOG_DIR/claude-code-digest.log 2>&1

# ヘルスチェック（30分間隔）
*/30 * * * * $APP_DIR/scripts/vps/health-check.sh

# バックアップ（毎日 2:00 JST = 17:00 UTC）
0 17 * * * $APP_DIR/scripts/vps/backup.sh >> $LOG_DIR/backup.log 2>&1

# RSSHubサービス再起動（毎週日曜 2:00 JST = 17:00 UTC）
0 17 * * 0 cd $APP_DIR && npm run rsshub:down && sleep 10 && npm run rsshub:up

# システム更新（毎週日曜 3:00 JST = 18:00 UTC）
0 18 * * 0 sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y >> $LOG_DIR/system-update.log 2>&1

EOF

# crontab を設定
crontab /tmp/crontab.current

echo "✅ cron ジョブが設定されました"
echo ""
echo "設定された cron ジョブ:"
crontab -l
echo ""
echo "ログファイルの場所:"
echo "  - RSS実行ログ: $LOG_DIR/claude-code-digest.log"
echo "  - ヘルスチェック: $LOG_DIR/health-check.log"
echo "  - バックアップ: $LOG_DIR/backup.log"
echo "  - システム更新: $LOG_DIR/system-update.log"