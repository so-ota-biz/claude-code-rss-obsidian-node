# Claude Code X Digest → Obsidian (Node.js / TypeScript)

X 上の Claude Code 関連アカウントを RSSHub で収集し、Gemini で翻訳・日次ハイライト化して、Obsidian Vault に Markdown と画像を保存する Node.js 実装です。

## できること

- RSSHub 経由で複数 X アカウントの投稿を取得
- 前日分だけを対象に抽出
- 英語投稿を Gemini で日本語翻訳
- 重複・返信・RT を簡易除外
- 1 日分の要約を Gemini で生成
- Obsidian 向け Markdown を 2 種類出力
  - 日次ダイジェスト
  - 翻訳付き raw ログ
- 外部 CLI を呼び出してサムネイル画像を生成

## 構成

```text
.
├─ docs/
│  └─ VPS-MIGRATION-PLAN.md
├─ docker/
│  └─ docker-compose.rsshub.yml
├─ examples/
│  └─ rsshub.env.example
├─ scripts/
│  ├─ generate-thumbnail.sh
│  └─ vps/
│     ├─ setup.sh
│     ├─ deploy.sh
│     ├─ setup-cron.sh
│     ├─ health-check.sh
│     ├─ backup.sh
│     └─ install-logrotate.sh
├─ src/
│  ├─ index.ts
│  ├─ types.ts
│  └─ lib/
│     ├─ config.ts
│     ├─ date.ts
│     ├─ fs.ts
│     ├─ gemini.ts
│     ├─ markdown.ts
│     ├─ pipeline.ts
│     ├─ rss.ts
│     ├─ text.ts
│     └─ thumbnail.ts
├─ .env.example
├─ package.json
└─ README.md
```

## 前提

- Node.js 20+
- npm
- Docker / Docker Compose
- Gemini API キー
- Obsidian Vault のローカルパス
- サムネイル生成を使う場合は Gemini API キー（画像生成モデルへのアクセス権）

## セットアップ

```bash
cp .env.example .env
npm install
npm run rsshub:up
npm run run
```

## `.env` の主要項目

```env
GEMINI_API_KEY=...
RSSHUB_BASE_URL=http://localhost:1200
OBSIDIAN_VAULT_PATH=/absolute/path/to/ObsidianVault
```

## 収集対象アカウントの管理

収集対象アカウントは `config/accounts.yml` で管理します。

```yaml
accounts:
  - name: "anthropicai"
    description: "Anthropic official account"
    category: "AI Company"
  - name: "claudeai"
    description: "Claude AI official account"
    category: "AI Product"
```

### アカウントを追加する

`config/accounts.yml` に以下の形式でエントリを追加してください。

```yaml
  - name: "追加したいアカウント名"
    description: "説明（任意）"
    category: "カテゴリ（任意）"
```

### アカウントを削除する

`config/accounts.yml` から該当のエントリを削除してください。

## ストレージ設定

デフォルトはローカルファイルシステム（`STORAGE_TYPE=local`）への保存ですが、Dropbox APIを使った保存に切り替えることも可能です。

### ローカル保存（デフォルト）

```env
# STORAGE_TYPE=local  # デフォルトなので省略可能
OBSIDIAN_VAULT_PATH=/absolute/path/to/ObsidianVault
```

### Dropbox保存

Dropboxへの保存では2つの方法をサポートしています：

#### 方法1: OAuth 2.0 + Refresh Token（推奨）

2021年9月30日以降のDropbox Access Tokenは4時間で期限切れとなるため、長期運用にはOAuth 2.0 + Refresh Tokenの使用を推奨します。

```env
STORAGE_TYPE=dropbox
DROPBOX_CLIENT_ID=your_dropbox_app_key_here
DROPBOX_CLIENT_SECRET=your_dropbox_app_secret_here
DROPBOX_REFRESH_TOKEN=your_refresh_token_here  # 初回セットアップ後は自動設定
DROPBOX_TOKEN_STORAGE_PATH=.state/dropbox-tokens.json
DROPBOX_BASE_PATH=/  # オプション
```

**OAuth 2.0セットアップ手順（詳細版）**:

### Step 1: Dropboxアプリの作成と設定

1. **アプリを作成**
   - [Dropbox App Console](https://www.dropbox.com/developers/apps) にアクセス
   - 「Create app」ボタンをクリック
   - 以下の設定を選択：
     - **Choose an API**: 「Scoped access」を選択
     - **Choose the type of access you need**: 「Full Dropbox」を推奨
     - **Name your app**: アプリ名を入力（例: "RSS Obsidian Bot"）
   - 「Create app」をクリック

2. **権限設定**
   - アプリ作成後、「Permissions」タブをクリック
   - 以下の権限にチェックを入れて有効化：
     - ✅ `files.metadata.write` (ファイルメタデータの書き込み)
     - ✅ `files.metadata.read` (ファイルメタデータの読み取り)
     - ✅ `files.content.write` (ファイル内容の書き込み)
     - ✅ `files.content.read` (ファイル内容の読み取り)
   - 「Submit」ボタンをクリックして権限を保存

3. **認証情報の取得**
   - 「Settings」タブに移動
   - 以下の情報をコピーして保管：
     - **App key**: そのままコピー → `.env`の`DROPBOX_CLIENT_ID`に設定
     - **App secret**: 「Show」ボタンをクリックして表示 → `.env`の`DROPBOX_CLIENT_SECRET`に設定

4. **OAuth設定**
   - 同じく「Settings」タブで「OAuth 2」セクションを探す
   - 「Redirect URIs」に以下を追加：
     ```
     http://localhost:8080/callback
     ```
   - 「Add」ボタンをクリックして保存

### Step 2: Refresh Tokenの手動取得

現在は手動でRefresh Tokenを取得する必要があります。以下の手順を **正確に** 実行してください：

1. **認証URLの作成とアクセス**
   
   以下のURLをブラウザで開きます。`YOUR_APP_KEY`の部分を**Step 1で取得したApp key**に置き換えてください：
   
   ```text
   https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&response_type=code&token_access_type=offline&redirect_uri=http://localhost:8080/callback
   ```
   
   **例**: App keyが`abc123def456`の場合
   ```
   https://www.dropbox.com/oauth2/authorize?client_id=abc123def456&response_type=code&token_access_type=offline&redirect_uri=http://localhost:8080/callback
   ```

2. **認証の実行**
   
   - Dropboxのログイン画面が表示される場合はログインする
   - アプリの権限許可画面で「**許可する**」をクリック
   - エラーページ（接続できませんでした）が表示されるが、**これは正常です**
   - ブラウザのアドレスバーのURLを確認する
   
   **期待されるURL形式**:
   ```
   http://localhost:8080/callback?code=VERY_LONG_CODE_STRING&state=...
   ```

3. **認証コードの抽出**
   
   上記URLの`code=`と`&`（または`&state=`）の間にある長い文字列をコピーします。
   
   **例**: 
   ```
   http://localhost:8080/callback?code=abcdef123456789&state=xyz
   ```
   この場合、`abcdef123456789`が認証コードです。

4. **Refresh Tokenの取得**
   
   以下のcurlコマンドを実行します。`認証コード`と`YOUR_APP_KEY`、`YOUR_APP_SECRET`を実際の値に置き換えてください：
   
   ```bash
   curl -X POST https://api.dropboxapi.com/oauth2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "code=認証コード" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_APP_KEY" \
     -d "client_secret=YOUR_APP_SECRET" \
     -d "redirect_uri=http://localhost:8080/callback"
   ```
   
   **成功時のレスポンス例**:
   ```json
   {
     "access_token": "sl.xxxxxxxxx",
     "token_type": "bearer",
     "expires_in": 14400,
     "refresh_token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
     "scope": "account_info.read files.content.read files.content.write files.metadata.read files.metadata.write"
   }
   ```

5. **設定ファイルに値を設定**
   
   上記レスポンスから以下の値を`.env`ファイルに設定：
   
   ```env
   DROPBOX_CLIENT_ID=YOUR_APP_KEY # Step 1で取得
   DROPBOX_CLIENT_SECRET=YOUR_APP_SECRET # Step 1で取得
   DROPBOX_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx # 上記レスポンスのrefresh_token
   ```

### 設定値一覧表

| 環境変数名 | 取得場所 | 説明 |
|------------|----------|------|
| `DROPBOX_CLIENT_ID` | Dropbox App Console → Settings → App key | アプリケーション識別子 |
| `DROPBOX_CLIENT_SECRET` | Dropbox App Console → Settings → App secret（Showボタンで表示） | アプリケーション秘密鍵 |
| `DROPBOX_REFRESH_TOKEN` | curlコマンドの実行結果 → `refresh_token`フィールド | 長期アクセス用トークン |

**⚠️ 重要な注意事項**:
- `DROPBOX_CLIENT_SECRET`と`DROPBOX_REFRESH_TOKEN`は機密情報です。絶対に公開しないでください
- 認証コードは一度しか使用できません。失敗した場合は Step 2 からやり直してください
- Refresh Tokenは有効期限がありませんが、Dropbox側で無効化される場合があります
- 初回設定後はアクセストークンの自動更新が行われるため、手動操作は不要です

#### 方法2: 静的Access Token（非推奨）

```env
STORAGE_TYPE=dropbox
DROPBOX_ACCESS_TOKEN=your_dropbox_access_token_here
DROPBOX_BASE_PATH=/
```

**注意**: この方法では4時間でトークンが期限切れとなり、手動でトークンを更新する必要があります。本番環境での使用は推奨されません。

**Access Tokenの取得方法**:

1. 上記のアプリ作成手順を実行
2. "Settings" タブの "Generated access token" セクションで "Generate" をクリック
3. 生成されたトークンを `DROPBOX_ACCESS_TOKEN` に設定

**共通の注意事項**: 
- Dropbox保存時は、`OBSIDIAN_VAULT_PATH` の設定値は使用されません
- `DROPBOX_BASE_PATH` でDropbox内の保存先ルートパスを指定できます（例: `/MyApp/`）
- Dropbox保存時はObsidianでの直接閲覧はできません。必要に応じてDropboxからローカルに同期してください
- OAuth 2.0 + Refresh Token方式では、アクセストークンの自動更新に対応しており、4時間の期限切れを気にせず長期運用が可能です

### サムネイル生成を有効にする場合

`ENABLE_THUMBNAIL=true` にするだけで、Gemini の画像生成モデル（Nano Banana）が自動的に呼び出されます。

```env
ENABLE_THUMBNAIL=true
MODEL_IMAGE=gemini-2.5-flash-image  # デフォルト値。Pro モデルも指定可能
```

VPS への追加インストールは不要です。既存の `GEMINI_API_KEY` がそのまま使われます。

## RSSHub の起動

```bash
npm run rsshub:up
npm run rsshub:logs
```

停止:

```bash
npm run rsshub:down
```

認証が必要な route を使う場合は `examples/rsshub.env.example` を元に `docker/.env` などへ分離して運用してください。

## 実行結果

デフォルトでは Obsidian Vault に以下を出力します。

```text
AI Digest/Claude Code/
├─ 2026-03-11.md
├─ assets/
│  ├─ 2026-03-11.png
│  └─ 2026-03-11.thumbnail-prompt.txt
└─ raw/
   └─ 2026-03-11.md
```

## cron 例

毎朝 8:00 に実行する例です。

```cron
0 8 * * * cd /opt/claude-code-rss-obsidian-node && /usr/bin/npm run run >> /var/log/claude-code-digest.log 2>&1
```

## おすすめ運用パターン

### A. いちばん扱いやすい構成

- VPS: RSSHub + Redis だけを常時稼働
- ローカル PC: Node バッチを毎朝実行
- 出力: ローカル Obsidian Vault に直接保存

この構成だと、Vault の同期や画像保存で悩みにくいです。

### B. 全部 VPS で実行

- VPS: RSSHub + Redis + Node バッチ
- Vault: Obsidian Sync / Syncthing / Git などで別端末へ持ってくる

構成は単純ですが、Vault の同期方針を別途決める必要があります。

## VPS デプロイ

VPS への自動デプロイ用スクリプトを提供しています。詳細は [VPS Migration Plan](docs/VPS-MIGRATION-PLAN.md) を参照してください。

### 推奨VPS

1. **Hetzner Cloud** - CPX21 プラン（月額 $7、2 vCPU/4GB RAM）
2. DigitalOcean - Basic Droplet（月額 $12）
3. Vultr - Regular Performance（月額 $10）

### クイックデプロイ手順

1. **VPS初期設定**（root権限で実行）：
```bash
curl -fsSLO https://raw.githubusercontent.com/so-ota-biz/claude-code-rss-obsidian-node/main/scripts/vps/setup.sh
# 内容を確認してから実行
bash setup.sh
```

2. **アプリケーションデプロイ**（deployユーザーで実行）：
```bash
su - deploy
git clone https://github.com/so-ota-biz/claude-code-rss-obsidian-node.git ~/claude-code-rss
~/claude-code-rss/scripts/vps/deploy.sh
```

3. **自動実行設定**：
```bash
./scripts/vps/setup-cron.sh
```

### VPS運用機能

- **自動ヘルスチェック**: 30分間隔でRSSHub/Redis監視
- **自動バックアップ**: 設定・状態ファイル・Redis データの日次バックアップ
- **ログローテーション**: ディスク容量管理
- **自動復旧**: サービス停止時の自動再起動

詳細な移行手順・設定・コスト比較は `docs/VPS-MIGRATION-PLAN.md` を参照してください。

## 改造ポイント

- `src/lib/rss.ts`
  - RSSHub route 変更
- `src/lib/pipeline.ts`
  - フィルタ条件や重複判定の強化
- `src/lib/gemini.ts`
  - プロンプト改善
- `src/lib/thumbnail.ts`
  - 画像 CLI 以外に差し替え
- `src/lib/markdown.ts`
  - Daily Notes 形式や frontmatter 変更

## 注意点

- RSSHub の X 系 route は仕様変更や認証要件の影響を受けやすいです。
- 画像 CLI の呼び出し仕様は環境ごとに異なるため、アダプタスクリプトを調整してください。
- 重複判定は現在は簡易版です。引用ポストやスレッド統合を厳密にやる場合は追加実装が必要です。
