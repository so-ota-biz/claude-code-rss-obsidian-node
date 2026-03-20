# VPS 移行案と手順ドキュメント

> **Issue**: https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/33  
> **作成日**: 2026-03-18

## 概要

Claude Code RSS Obsidian Node システム（RSSHub + Redis + Node.js バッチ）を VPS に移行し、24時間稼働による安定した運用を実現する。

## VPS 選択肢と推奨案

### 推奨ランキング

| 順位 | サービス | 月額コスト | 推奨理由 |
|------|----------|------------|----------|
| **1位** | **Hetzner** | **$7/月** | **コストパフォーマンス最高、Docker 最適** |
| 2位 | DigitalOcean | $12/月 | 使いやすさ、サポート充実 |
| 3位 | Vultr | $10/月 | データセンター多数、高機能 |
| 4位 | Amazon Lightsail | $12/月 | AWS エコシステム |

### 詳細比較

#### 1位推奨: Hetzner Cloud (ドイツ)

**推奨プラン**: CPX21 (2 vCPU, 4GB RAM, 80GB SSD)
- **月額**: €6.90 ≈ $7/月
- **特徴**: 
  - 同スペック他社の1/3価格
  - AMD EPYC プロセッサで高性能
  - 欧州品質のインフラ
  - Docker に最適化されたLinux環境
  - 無制限トラフィック
- **注意点**: 
  - データセンターが欧州（ドイツ・フィンランド）のみ
  - 日本からの ping 約200ms（API通信に影響小）

#### 2位: DigitalOcean

**推奨プラン**: Basic Droplet (2 vCPU, 2GB RAM, 50GB SSD)
- **月額**: $12/月
- **特徴**:
  - 2026年より秒課金対応
  - Docker 1-click アプリ提供
  - 優秀な管理画面
  - 豊富なチュートリアル
  - アジア圏データセンター有り

#### 3位: Vultr

**推奨プラン**: Regular Performance (2 vCPU, 4GB RAM, 80GB SSD)
- **月額**: $10/月  
- **特徴**:
  - 32+データセンター（日本含む）
  - ベアメタルオプション有り
  - 高度なネットワーク機能
  - コンテナレジストリ提供

#### 4位: Amazon Lightsail

**推奨プラン**: $12プラン (2 vCPU, 4GB RAM, 80GB SSD)
- **月額**: $12/月
- **特徴**:
  - AWS エコシステム統合
  - 3ヶ月無料トライアル
  - 予測しやすい料金
- **注意点**: 
  - データ転送量オーバー時高額 ($0.09/GB)
  - CPU 使用率継続時パフォーマンス低下

### 最終推奨: Hetzner Cloud

**理由**:
- コスト効率性: 他社の1/3の価格
- 十分なスペック: 2 vCPU, 4GB RAM でコンテナ3個は余裕
- 安定性: ドイツ品質のインフラ  
- Docker 適性: Linux環境が最適化済み

## システム要件

### 最小スペック
- **CPU**: 1 vCPU（RSSHub + Redis + Node.js）
- **メモリ**: 2GB（各コンテナ 500MB〜1GB）
- **ストレージ**: 40GB（OS + Docker + データ + ログ）
- **帯域**: 月100GB（RSS + Gemini API）

### 推奨スペック  
- **CPU**: 2 vCPU（余裕を持った運用）
- **メモリ**: 4GB（バッファ込み）
- **ストレージ**: 80GB（成長余地込み）
- **帯域**: 月500GB〜無制限

## 移行手順

### フェーズ1: VPS 環境構築

#### 1.1 VPS インスタンス作成
```bash
# Hetzner の場合（Web Console）
# - Location: Nuremberg (ドイツ)  
# - Image: Ubuntu 22.04 LTS
# - Type: CPX21 (2 vCPU, 4GB RAM)
# - Networking: Public IPv4 + IPv6
# - SSH Keys: 公開鍵を登録
```

#### 1.2 初期設定
```bash
# SSH 接続
ssh root@[VPS_IP]

# システム更新  
apt update && apt upgrade -y

# 基本ツールインストール
apt install -y curl wget git vim ufw

# Docker インストール
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose インストール  
apt install -y docker-compose-plugin

# ファイアウォール設定
ufw allow ssh
# RSSHub は原則内部利用。外部公開が必要な場合のみ開放
# ufw allow 1200/tcp
ufw --force enable

# 作業ユーザー作成
adduser deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

#### 1.3 アプリケーション配置
```bash
# ユーザー切り替え
su - deploy

# リポジトリクローン
git clone <リポジトリURL> claude-code-rss
cd claude-code-rss

# 環境変数設定
cp .env.example .env
# .env ファイルを本番用に編集（後述）

# 依存関係インストール
npm install
```

### フェーズ2: 設定ファイル調整

#### 2.1 環境変数(.env)調整
```env
# Gemini API
GEMINI_API_KEY=<実際のAPIキー>

# RSSHub (VPS内部通信)
RSSHUB_BASE_URL=http://localhost:1200

# ストレージ設定
STORAGE_TYPE=dropbox  # または local
DROPBOX_CLIENT_ID=<クライアントID>
DROPBOX_CLIENT_SECRET=<クライアントシークレット>  
DROPBOX_REFRESH_TOKEN=<リフレッシュトークン>
DROPBOX_TOKEN_STORAGE_PATH=/home/deploy/claude-code-rss/.state/dropbox-tokens.json
DROPBOX_BASE_PATH=/RSS-Digest/

# 対象アカウント
TARGET_ACCOUNTS=anthropicai,claudeai

# ログレベル（本番用）
LOG_LEVEL=info
```

#### 2.2 Docker Compose 調整（必要に応じて）
```yaml
# docker/docker-compose.rsshub.yml
services:
  rsshub:
    image: diygod/rsshub:latest
    container_name: rsshub
    restart: unless-stopped
    ports:
      - "1200:1200"
    env_file:
      - ../.env  # パス確認
    depends_on:
      - redis
    # メモリ制限追加（推奨）
    deploy:
      resources:
        limits:
          memory: 1G

  redis:
    image: redis:7-alpine
    container_name: rsshub-redis
    restart: unless-stopped
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    volumes:
      - redis-data:/data
    # メモリ制限追加
    deploy:
      resources:
        limits:
          memory: 512M

volumes:
  redis-data:
```

### フェーズ3: 動作確認とテスト

#### 3.1 RSSHub + Redis 起動確認
```bash
# サービス起動
npm run rsshub:up

# 起動確認
docker ps
docker logs rsshub
docker logs rsshub-redis

# RSSHub API確認
curl http://localhost:1200/
curl http://localhost:1200/twitter/user/anthropicai
```

#### 3.2 Node.js バッチテスト
```bash
# TypeScript コンパイル確認
npm run check

# 手動実行テスト（短縮期間）
# 一時的に期間を1時間に変更してテスト
npm run run

# ログ確認
# 出力先確認（ローカル or Dropbox）
```

#### 3.3 必要なディレクトリ作成
```bash
# 状態ファイル用ディレクトリ
mkdir -p .state

# ログディレクトリ
mkdir -p logs

# 権限設定
chmod 755 .state logs
```

### フェーズ4: 自動実行設定

#### 4.1 cron 設定
```bash
# crontab 編集
crontab -e

# 毎朝8:00に実行（JST = UTC+9、UTC 23:00）
0 23 * * * cd /home/deploy/claude-code-rss && /usr/bin/npm run run >> /home/deploy/logs/claude-code-digest.log 2>&1

# 週1回の再起動（日曜深夜）
0 2 * * 0 cd /home/deploy/claude-code-rss && npm run rsshub:down && sleep 10 && npm run rsshub:up
```

#### 4.2 ログローテーション設定
```bash
# logrotate 設定作成
sudo vim /etc/logrotate.d/claude-code-digest

# 内容:
/home/deploy/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 deploy deploy
}
```

### フェーズ5: 監視とバックアップ

#### 5.1 基本監視スクリプト
```bash
# ~/scripts/health-check.sh
#!/bin/bash

LOG_FILE="/home/deploy/logs/health-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Health check started" >> $LOG_FILE

# RSSHub チェック  
if curl -f -s http://localhost:1200/ > /dev/null; then
    echo "[$DATE] RSSHub: OK" >> $LOG_FILE
else
    echo "[$DATE] RSSHub: ERROR" >> $LOG_FILE
    # 再起動
    cd /home/deploy/claude-code-rss
    npm run rsshub:down && npm run rsshub:up
fi

# ディスク使用量チェック
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "[$DATE] Disk usage: WARNING ${DISK_USAGE}%" >> $LOG_FILE
fi
```

```bash
# 実行権限付与
chmod +x ~/scripts/health-check.sh

# cron に追加（30分間隔）
*/30 * * * * /home/deploy/scripts/health-check.sh
```

#### 5.2 バックアップスクリプト
```bash
# ~/scripts/backup.sh
#!/bin/bash

BACKUP_DIR="/home/deploy/backups"
DATE=$(date '+%Y%m%d')

mkdir -p $BACKUP_DIR

# 設定ファイル
cp /home/deploy/claude-code-rss/.env $BACKUP_DIR/env-$DATE

# Redis データ
docker exec rsshub-redis redis-cli BGSAVE
sleep 5
docker cp rsshub-redis:/data/dump.rdb $BACKUP_DIR/redis-$DATE.rdb

# 状態ファイル
cp -r /home/deploy/claude-code-rss/.state $BACKUP_DIR/state-$DATE

# 古いバックアップ削除（7日以上前）
find $BACKUP_DIR -name "*" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# cron に追加（毎日深夜2:00）
0 2 * * * /home/deploy/scripts/backup.sh >> /home/deploy/logs/backup.log 2>&1
```

## セキュリティ設定

### ファイアウォール
```bash
# UFW 状態確認
sudo ufw status

# 必要最小限のポートのみ開放
sudo ufw allow ssh      # 22
# RSSHub は原則内部利用。外部公開が必要な場合のみ開放
# sudo ufw allow 1200/tcp
```

### SSH セキュリティ強化
```bash
# /etc/ssh/sshd_config 編集
sudo vim /etc/ssh/sshd_config

# 設定項目:
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
Port 22  # または非標準ポート

# SSH 再起動
sudo systemctl restart ssh
```

### 定期的なセキュリティ更新
```bash
# cron に追加（週1回、日曜深夜）
0 3 * * 0 sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y >> /home/deploy/logs/system-update.log 2>&1
```

## 移行時の注意点

### データ移行
1. **ローカル状態ファイル**: `.state/` ディレクトリのバックアップ
2. **環境変数**: API キー等の機密情報の安全な移行
3. **cron 設定**: タイムゾーン設定の確認（UTC vs JST）

### 切り替えタイミング  
1. **テスト期間**: 1週間並行運用
2. **データ整合性確認**: 出力結果の比較
3. **完全移行**: ローカル環境停止

### ロールバック準備
1. **ローカル環境保持**: 問題時の即座復旧
2. **データバックアップ**: VPS での全データ保存
3. **手順書作成**: 緊急時対応手順

## 費用見積もり

### Hetzner Cloud（推奨）
- **VPS 料金**: €6.90/月 ≈ $7/月 ≈ ¥1,050/月
- **追加費用**: なし（トラフィック無制限）
- **年間**: $84 ≈ ¥12,600

### その他費用
- **Dropbox API**: 無料（通常使用範囲内）  
- **Gemini API**: 従量課金（変動なし）
- **ドメイン**: 必要に応じて$10-15/年

### 総費用: 月額 $7-10 (¥1,000-1,500)

## 移行後の運用

### 日常監視項目
- [ ] RSSHub サービス稼働状況
- [ ] Redis データ永続化
- [ ] Node.js バッチ実行ログ
- [ ] ディスク使用量
- [ ] メモリ使用量

### 月次メンテナンス
- [ ] システム更新適用
- [ ] ログファイル確認・整理
- [ ] バックアップ取得確認
- [ ] パフォーマンス確認

### 緊急時対応
1. **サービス停止**: `systemctl status docker`, `docker ps`
2. **ディスク容量逼迫**: ログローテーション、古いデータ削除
3. **メモリ不足**: コンテナ再起動、メモリ使用量確認
4. **ネットワーク障害**: VPS プロバイダー状態確認

## まとめ

**推奨**: Hetzner Cloud CPX21 プラン ($7/月)
**移行期間**: 2-3週間（計画・構築・テスト・移行）
**リスク**: 低（Docker環境の移植性、段階的移行）
**効果**: 24時間稼働、安定運用、コスト効率

この移行により、ローカル環境の制約から解放され、より安定した RSS 収集・処理システムの運用が可能になります。