#!/bin/bash

# VPS初期設定スクリプト
# Usage: ./scripts/vps/setup.sh
# 実行前に: chmod +x scripts/vps/setup.sh

set -e

if [ "$EUID" -ne 0 ]; then
    echo "このスクリプトは root 権限で実行してください (sudo bash setup.sh)"
    exit 1
fi

echo "=== VPS初期設定開始 ==="

# システム更新
echo "システム更新中..."
apt update && apt upgrade -y

# 基本ツールインストール
echo "基本ツールのインストール中..."
apt install -y curl wget git vim ufw htop ca-certificates gnupg

# Docker インストール（公式 APT リポジトリ経由）
echo "Docker のインストール中..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# ファイアウォール設定
echo "ファイアウォール設定中..."
ufw allow ssh
# RSSHub は原則内部利用。外部公開が必要な場合のみ開放
# ufw allow 1200/tcp
ufw --force enable

# 作業ユーザー作成
echo "作業ユーザー 'deploy' を作成中..."
if ! id "deploy" &>/dev/null; then
    adduser --disabled-password --gecos "" deploy

    # SSH キー設定
    mkdir -p /home/deploy/.ssh
    if [ -f ~/.ssh/authorized_keys ]; then
        cp ~/.ssh/authorized_keys /home/deploy/.ssh/
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
    fi
fi

# docker グループ追加（冪等: ユーザー作成の有無に関わらず実行）
usermod -aG docker deploy

# ログディレクトリ作成
mkdir -p /home/deploy/logs
chown deploy:deploy /home/deploy/logs

echo "=== VPS初期設定完了 ==="
echo "次のステップ:"
echo "1. 'su - deploy' でユーザーを切り替え"
echo "2. './scripts/vps/deploy.sh' でアプリケーションをデプロイ"