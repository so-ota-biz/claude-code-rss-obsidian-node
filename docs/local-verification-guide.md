# ローカル動作確認ガイド

> VPS 移行前のローカル環境での動作確認手順と確認観点チェックリスト

---

## 前提条件

| 要件 | 確認コマンド |
|------|-------------|
| Node.js >= 20 | `node --version` |
| Docker Desktop 起動済み | `docker info` |
| npm 依存関係インストール済み | `npm install` |
| `.env` ファイル作成済み | `ls .env` |
| `docker/.env` 作成済み（`examples/rsshub.env.example` から） | `ls docker/.env` |

---

## 手順

### ステップ 1: `.env` ファイルを準備する

```bash
cp .env.example .env
```

`.env` に最低限必要な項目を設定する:

```env
# 必須
GEMINI_API_KEY=<your-key>
RSSHUB_BASE_URL=http://localhost:1200
OBSIDIAN_VAULT_PATH=<出力先のローカルパス（絶対パス）>

# ストレージ（まずは local で確認する）
STORAGE_TYPE=local

# ローカル動作確認時は過去1週間分を対象にする（デフォルト: 1 = 昨日のみ）
LOOKBACK_DAYS=7
```

> ストレージを `local` にすると `OBSIDIAN_VAULT_PATH` 配下にファイルが書き出される。  
> Dropbox は後工程で確認する。  
> `LOOKBACK_DAYS=7` にしておくと、昨日分だけでなく過去7日分のフィードを対象にするため、ローカル確認時にポストが取れないリスクが下がる。VPS 本番運用時は `LOOKBACK_DAYS=1`（デフォルト）に戻すこと。

---

### ステップ 1-b: `docker/.env` を準備する

`docker/docker-compose.rsshub.yml` の `env_file: - ./.env` はコンポーズファイルからの相対パスで解決されるため、`docker/.env` が必要。RSSHub 専用のテンプレートが `examples/rsshub.env.example` に用意されているので、それをコピーして使う（以下はプロジェクトルートで実行）：

```bash
# プロジェクトルートで実行
cp examples/rsshub.env.example docker/.env
```

`/twitter/user` ルートは Twitter/X 認証設定が必須。`docker/.env` を開いて以下の3つのいずれかのコメントを外して設定する：

```env
# Method 1: Cookie 認証（推奨・API申請不要）
TWITTER_AUTH_TOKEN=your_auth_token_here
TWITTER_COOKIE=auth_token=your_auth_token_here; ct0=your_ct0_here

# Method 2: ユーザー名/パスワード
# TWITTER_USERNAME=your_username
# TWITTER_PASSWORD=your_password

# Method 3: Bearer Token（Developer Portal 申請が必要）
# TWITTER_BEARER_TOKEN=your_bearer_token_here
```

Cookie 認証の場合、ブラウザで Twitter/X にログインした状態で開発者ツール → Application → Cookies から `auth_token` と `ct0` を取得する。

> `docker/.env` はアプリ設定（`.env`）とは独立したファイルとして管理する。`.env` には Node.js バッチ用の設定のみ、`docker/.env` には RSSHub コンテナ用の設定のみを記載する。

> `docker/.env` が存在しない場合、`rsshub` コンテナが環境変数なしで起動し、設定が反映されない。

---

### ステップ 2: RSSHub + Redis を起動する

```bash
npm run rsshub:up
```

起動後に状態を確認する:

```bash
docker ps
# rsshub と rsshub-redis が Up になっていること

docker logs rsshub
# エラーがないこと

curl http://localhost:1200/
# {"status":"success"} のようなレスポンスが返ること
```

---

### ステップ 3: RSS フィードを手動で確認する

```bash
curl "http://localhost:1200/twitter/user/anthropicai"
# XML フィードが返ること（items が含まれること）

curl "http://localhost:1200/twitter/user/claudeai"
# 同様に XML フィードが返ること
```

---

### ステップ 4: TypeScript のコンパイルエラーを確認する

```bash
npm run check
# エラーゼロで終了すること
```

---

### ステップ 5: テストを実行する

```bash
npm test
# 全テストが PASS すること
```

---

### ステップ 6: バッチをローカルで手動実行する

```bash
# 必要なディレクトリを事前作成
mkdir -p .state

# バッチ実行
npm run run
```

実行後に以下を確認する:

```bash
# ログ出力（標準出力）の確認ポイント
# [info] Target day: YYYY-MM-DD
# [info] Storage type: local
# [info] Fetching RSS for @anthropicai
# [info]  -> N posts
# [done] Digest written to ...
# [done] Raw feed written to ...
```

---

### ステップ 7: 出力ファイルを確認する

`OBSIDIAN_VAULT_PATH` 配下に以下が生成されていること:

```
<OBSIDIAN_VAULT_PATH>/
└── AI Digest/
    └── Claude Code/
        ├── YYYY-MM-DD.md      # Digest（翻訳・サマリー付き）
        ├── raw/
        │   └── YYYY-MM-DD.md  # 生データ
        └── assets/            # サムネイル（ENABLE_THUMBNAIL=true の場合）
```

---

### ステップ 8: Dropbox ストレージで確認する（オプション）

```env
STORAGE_TYPE=dropbox
DROPBOX_CLIENT_ID=<id>
DROPBOX_CLIENT_SECRET=<secret>
DROPBOX_REFRESH_TOKEN=<token>
DROPBOX_TOKEN_STORAGE_PATH=.state/dropbox-tokens.json
DROPBOX_BASE_PATH=/RSS-Digest/
```

```bash
npm run run
# Dropbox 上の DROPBOX_BASE_PATH に同様のファイルが生成されること
```

---

### ステップ 9: 後片付け

```bash
npm run rsshub:down
```

---

## 確認観点チェックリスト

### 環境構築

- [ ] `.env` が `.env.example` の全必須項目を含んでいる
- [ ] `LOOKBACK_DAYS=7` が設定されている（ローカル確認用）
- [ ] `GEMINI_API_KEY` が有効なキーである
- [ ] `OBSIDIAN_VAULT_PATH` が存在するディレクトリを指している（`local` の場合）
- [ ] `npm install` が完了しており `node_modules` が存在する
- [ ] `docker/.env` が存在する（`examples/rsshub.env.example` からコピー）
- [ ] `docker/.env` に Twitter/X 認証情報が設定されている（必須）

### Docker / RSSHub

- [ ] `docker ps` で `rsshub`・`rsshub-redis` が `Up` 状態
- [ ] `docker logs rsshub` にエラーがない
- [ ] `curl http://localhost:1200/` が 200 レスポンスを返す
- [ ] `curl http://localhost:1200/twitter/user/anthropicai` が XML フィードを返す
- [ ] `curl http://localhost:1200/twitter/user/claudeai` が XML フィードを返す
- [ ] Redis ボリューム (`redis-data`) が作成されている（`docker volume ls`）

### コード品質

- [ ] `npm run check` がエラーゼロで終了する
- [ ] `npm test` が全テスト PASS で終了する

### バッチ実行（local ストレージ）

- [ ] `.state/` ディレクトリが作成されている
- [ ] `npm run run` が `[fatal]` ログなしで終了する
- [ ] 標準出力に `[done] Digest written to ...` が出力される
- [ ] 標準出力に `[done] Raw feed written to ...` が出力される
- [ ] `OBSIDIAN_VAULT_PATH/AI Digest/Claude Code/YYYY-MM-DD.md` が生成されている
- [ ] Digest ファイルに翻訳済み本文が含まれている（`ENABLE_TRANSLATION=true` の場合）
- [ ] Digest ファイルにサマリーセクションが含まれている（`ENABLE_DIGEST=true` の場合）
- [ ] `.state/` に状態ファイルが書き込まれている

### バッチ実行（Dropbox ストレージ）

- [ ] `STORAGE_TYPE=dropbox` での `npm run run` がエラーなしで終了する
- [ ] Dropbox の `DROPBOX_BASE_PATH` 配下にファイルが生成されている
- [ ] 再実行時に重複投稿が出力されない（`seenIds` による重複排除）

### エッジケース

- [ ] RSSHub 停止状態で `npm run run` を実行したとき、`[fatal]` ログで明示的にエラー終了する
- [ ] `GEMINI_API_KEY` を空にした場合、起動時にバリデーションエラーが出る
- [ ] `config/accounts.yml` の `accounts` を空にしたとき、エラーメッセージが出る
- [ ] 2回連続実行しても、2回目は同日分の重複 Digest が上書き（または skip）される

### VPS 移行に向けた追加確認

- [ ] `docker/.env`（RSSHub 用）と `.env`（アプリ用）が独立したファイルとして存在している
- [ ] `npm run rsshub:down && npm run rsshub:up` で再起動後もフィードが正常に取得できる
- [ ] ログ出力に個人情報・シークレットが含まれていない
- [ ] `.env` が `.gitignore` に含まれており、リポジトリに push されない

---

## トラブルシューティング

| 症状 | 確認ポイント |
|------|-------------|
| `rsshub` が起動しない | `docker logs rsshub` でエラー確認、ポート 1200 の競合確認 |
| RSSHub に環境変数が渡らない | `docker/.env` が存在するか確認（`ls docker/.env`） |
| RSS フィードが空 | Twitter/X の RSSHub ルートは認証不要だが、レート制限に注意 |
| Gemini API エラー | `GEMINI_API_KEY` の有効性、クォータ超過を確認 |
| Dropbox 認証エラー | `DROPBOX_REFRESH_TOKEN` の有効期限、スコープ設定を確認 |
| 出力ファイルが生成されない | `OBSIDIAN_VAULT_PATH` のパス・権限を確認 |
| `tsc` エラー | `npm install` が最新か確認、`node_modules` を削除して再インストール |
