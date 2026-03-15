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
