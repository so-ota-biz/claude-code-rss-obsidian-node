#!/bin/bash

# VPSアプリケーションデプロイスクリプト
# Usage: ./scripts/vps/deploy.sh [repo_url]
# 実行前に: chmod +x scripts/vps/deploy.sh

set -e

REPO_URL=${1:-"https://github.com/so-ota-biz/claude-code-rss-obsidian-node.git"}
APP_DIR="/home/deploy/claude-code-rss"

echo "=== アプリケーションデプロイ開始 ==="

# リポジトリクローン（存在する場合は更新）
if [ -d "$APP_DIR" ]; then
    echo "既存のアプリケーションを更新中..."
    cd "$APP_DIR"
    git pull
else
    echo "リポジトリをクローン中..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 環境変数ファイル確認
if [ ! -f .env ]; then
    echo ".env ファイルを作成中..."
    cp .env.example .env
    echo ""
    echo "⚠️  重要: .env ファイルを編集してください"
    echo "   - GEMINI_API_KEY"
    echo "   - Dropbox関連の設定（STORAGE_TYPE=dropbox使用時）"
    echo "   - TARGET_ACCOUNTS"
    echo ""
    echo "編集後に再度このスクリプトを実行してください。"
    exit 1
fi

# 依存関係インストール
echo "Node.js 依存関係をインストール中..."
npm install

# TypeScript コンパイル確認
echo "TypeScript コンパイルをチェック中..."
npm run check

# 必要なディレクトリ作成
mkdir -p .state logs

# RSSHub + Redis 起動
echo "RSSHub + Redis を起動中..."
npm run rsshub:up

# 起動確認（最大60秒リトライ）
echo "サービス起動状況を確認中..."
ok=0
for _ in $(seq 1 30); do
    if curl -f -s --max-time 5 http://localhost:1200/ > /dev/null 2>&1; then
        ok=1
        break
    fi
    sleep 2
done

if [ "$ok" -eq 1 ]; then
    echo "✅ RSSHub が正常に起動しました"
else
    echo "❌ RSSHub の起動に失敗しました"
    docker logs rsshub --tail=50
    exit 1
fi

# テスト実行
echo "動作テストを実行中..."
if ! timeout 60 npm run run; then
    echo "❌ 初回実行でタイムアウトまたはエラーが発生しました"
    echo "   ログを確認して問題を解決してください"
    exit 1
fi

echo "=== デプロイ完了 ==="
echo ""
echo "次のステップ:"
echo "1. './scripts/vps/setup-cron.sh' で自動実行を設定"
echo "2. ログファイルでエラーがないことを確認"
echo "3. 必要に応じて Dropbox 設定を確認"