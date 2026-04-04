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

#### 4.1 deploy ユーザーへの sudo 権限付与

`deploy` ユーザーはパスワードなしで作成されているため、このステップは **root セッションで実行する**。

```bash
# root セッションで実行（deploy から exit して root に戻る）
echo 'deploy ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
```

以降の `sudo` コマンドはすべて deploy ユーザーのまま実行できる。

> **nano について**: ローカル端末が Ghostty などの場合、`nano` がエラーになることがある。その場合は先頭に `TERM=xterm-256color` を付けて実行する（例: `TERM=xterm-256color sudo nano /etc/ssh/sshd_config`）。

#### 4.2 ログローテーション設定

スクリプトが `scripts/vps/install-logrotate.sh` として用意されている。

```bash
# deploy ユーザーで実行
sudo bash scripts/vps/install-logrotate.sh
```

#### 4.3 Redis メモリ設定

Redis 起動ログに `WARNING Memory overcommit must be enabled!` が出る場合は以下を実行する。

```bash
sudo sysctl vm.overcommit_memory=1
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
```

### フェーズ5: 監視・バックアップ・自動実行

監視スクリプト（`scripts/vps/health-check.sh`）とバックアップスクリプト（`scripts/vps/backup.sh`）はリポジトリに含まれている。`setup-cron.sh` を実行するとすべての cron ジョブ（バッチ実行・ヘルスチェック・バックアップ・週次再起動・週次 OS 更新）が一括設定される。

```bash
# 実行権限付与
chmod +x scripts/vps/health-check.sh scripts/vps/backup.sh scripts/vps/setup-cron.sh

# cron 一括設定（すでに 4.1 で手動設定済みの場合も重複なく上書きされる）
bash scripts/vps/setup-cron.sh

# 設定確認
crontab -l
```

設定されるジョブ：

| ジョブ | スケジュール |
|--------|-------------|
| RSS バッチ実行 | 毎日 8:00 JST (23:00 UTC) |
| ヘルスチェック | 30 分間隔 |
| バックアップ | 毎日 2:00 JST (17:00 UTC) |
| RSSHub 週次再起動 | 毎週日曜 2:00 JST |
| OS 週次更新 | 毎週日曜 3:00 JST |

## セキュリティ設定

### ファイアウォール確認

```bash
sudo ufw status
# SSH (22) が ALLOW になっていることを確認
# RSSHub (1200) は原則内部利用のため開放不要
```

### SSH セキュリティ強化

```bash
TERM=xterm-256color sudo nano /etc/ssh/sshd_config
```

以下の項目を設定する：

```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

編集後、SSH を再起動する：

```bash
sudo systemctl restart ssh
```

> **注意**: 再起動前に別のターミナルから SSH 接続できることを確認してから既存セッションを閉じること。設定ミスでロックアウトされるリスクを避けるため。

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