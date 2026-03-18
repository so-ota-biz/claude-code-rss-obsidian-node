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
├─ docker/
│  └─ docker-compose.rsshub.yml
├─ examples/
│  └─ rsshub.env.example
├─ scripts/
│  └─ generate-thumbnail.sh
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
- 画像生成を使う場合は `nano-banana` などの CLI

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
TARGET_ACCOUNTS=anthropicai,claudeai
```

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
DROPBOX_REFRESH_TOKEN=your_refresh_token_here  # 初回セットアップ後は自動設定
DROPBOX_TOKEN_STORAGE_PATH=.state/dropbox-tokens.json
DROPBOX_BASE_PATH=/  # オプション
```

**OAuth 2.0セットアップ手順**:

1. [Dropbox App Console](https://www.dropbox.com/developers/apps) でアプリを作成
   - API: "Scoped access" を選択
   - Access: "Full Dropbox" を推奨
   - App名を入力して作成

2. アプリ設定:
   - "Permissions" タブで以下の権限を有効化：
     - `files.metadata.write`
     - `files.metadata.read` 
     - `files.content.write`
     - `files.content.read`
   - "Settings" タブで "App key" をコピーして `DROPBOX_CLIENT_ID` に設定
   - "OAuth 2" セクションで Redirect URI に `http://localhost:8080/callback` を追加

3. Refresh Tokenの取得:
   
   現在のところ手動でRefresh Tokenを取得する必要があります。以下の手順で実行してください：

   **Step 1: 認証URLを生成**
   
   以下のURLにアクセスして認証を行います（`YOUR_APP_KEY`を実際のApp Keyに置き換えてください）：
   
   ```
   https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&response_type=code&token_access_type=offline&redirect_uri=http://localhost:8080/callback
   ```
   
   **Step 2: 認証コードを取得**
   
   - 上記URLにアクセスして「許可する」をクリック
   - `http://localhost:8080/callback?code=XXXXXXXXXX` のようなURLにリダイレクトされます
   - URLの `code=` 以降の文字列（認証コード）をコピーしてください
   
   **Step 3: Refresh Tokenを取得**
   
   以下のcurlコマンドで認証コードをRefresh Tokenに交換します：
   
   ```bash
   curl -X POST https://api.dropboxapi.com/oauth2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "code=認証コード" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_APP_KEY" \
     -d "redirect_uri=http://localhost:8080/callback"
   ```
   
   **Step 4: 設定ファイルに追加**
   
   レスポンスの `refresh_token` フィールドの値を `.env` ファイルの `DROPBOX_REFRESH_TOKEN` に設定してください：
   
   ```env
   DROPBOX_REFRESH_TOKEN=返された_refresh_token_の値
   ```
   
   **注意**: Refresh Tokenは長期間有効ですが、安全に保管してください。このトークンがあればDropboxのファイルにアクセスできます。

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

### 画像生成 CLI を使う場合

`THUMBNAIL_COMMAND` は外部コマンドのテンプレートです。

```env
THUMBNAIL_COMMAND=bash scripts/generate-thumbnail.sh "{promptFile}" "{outputPath}"
```

`generate-thumbnail.sh` の中身を、自分の環境にある CLI に合わせて差し替えてください。

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
