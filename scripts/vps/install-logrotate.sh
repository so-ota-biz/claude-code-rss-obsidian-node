#!/bin/bash

# ログローテーション設定インストールスクリプト
# Usage: sudo ./scripts/vps/install-logrotate.sh
# 実行前に: chmod +x scripts/vps/install-logrotate.sh

set -e

LOGROTATE_CONF="/etc/logrotate.d/claude-code-digest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== ログローテーション設定のインストール ==="

# root権限チェック
if [ "$EUID" -ne 0 ]; then
    echo "このスクリプトはroot権限で実行してください: sudo $0"
    exit 1
fi

# 設定ファイルをコピー
cp "$SCRIPT_DIR/logrotate.conf" "$LOGROTATE_CONF"

echo "✅ ログローテーション設定が完了しました: $LOGROTATE_CONF"
echo ""
echo "設定内容:"
cat "$LOGROTATE_CONF"
echo ""
echo "テスト実行: logrotate -d $LOGROTATE_CONF"
echo "手動実行: logrotate -f $LOGROTATE_CONF"