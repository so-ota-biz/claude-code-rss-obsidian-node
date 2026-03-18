#!/bin/bash

# VPS初期設定スクリプト
# Usage: ./scripts/vps/setup.sh
# 実行前に: chmod +x scripts/vps/setup.sh

set -e

echo "=== VPS初期設定開始 ==="

# システム更新
echo "システム更新中..."
apt update && apt upgrade -y

# 基本ツールインストール
echo "基本ツールのインストール中..."
apt install -y curl wget git vim ufw htop

# Docker インストール
echo "Docker のインストール中..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Docker Compose インストール
echo "Docker Compose のインストール中..."
apt install -y docker-compose-plugin

# ファイアウォール設定
echo "ファイアウォール設定中..."
ufw allow ssh
ufw allow 1200/tcp  # RSSHub
ufw --force enable

# 作業ユーザー作成
echo "作業ユーザー 'deploy' を作成中..."
if ! id "deploy" &>/dev/null; then
    adduser --disabled-password --gecos "" deploy
    usermod -aG docker deploy
    
    # SSH キー設定
    mkdir -p /home/deploy/.ssh
    if [ -f ~/.ssh/authorized_keys ]; then
        cp ~/.ssh/authorized_keys /home/deploy/.ssh/
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
    fi
fi

# ログディレクトリ作成
mkdir -p /home/deploy/logs
chown deploy:deploy /home/deploy/logs

echo "=== VPS初期設定完了 ==="
echo "次のステップ:"
echo "1. 'su - deploy' でユーザーを切り替え"
echo "2. './scripts/vps/deploy.sh' でアプリケーションをデプロイ"