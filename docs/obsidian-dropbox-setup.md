# Obsidian + Dropbox セットアップガイド

Dropbox API ストレージを使って生成したダイジェストを Obsidian で快適に閲覧するための設定手順をまとめます。

## 推奨フォルダ構成

Dropbox 内に Obsidian Vault 専用のフォルダを用意し、`DROPBOX_BASE_PATH` でそのルートを指定します。

```text
Dropbox/
└── ObsidianVault/                  ← DROPBOX_BASE_PATH=/ObsidianVault
    └── AI Digest/
        └── Claude Code/            ← OUTPUT_SUBDIR（デフォルト）
            ├── 2026-03-11.md       ← 日次ダイジェスト
            ├── assets/
            │   └── 2026-03-11.png  ← サムネイル画像
            └── raw/
                └── 2026-03-11.md   ← 翻訳付き raw ログ
```

Obsidian の Vault ルートを `ObsidianVault/` に設定すれば、ダイジェスト内の `![[AI Digest/Claude Code/assets/2026-03-11.png]]` が正しく解決されます。

## `.env` 設定例（Dropbox + サムネイル有効）

```env
# ---- Gemini / RSSHub ----
GEMINI_API_KEY=your_gemini_api_key
RSSHUB_BASE_URL=http://localhost:1200

# ---- Dropbox ----
STORAGE_TYPE=dropbox
DROPBOX_CLIENT_ID=your_dropbox_app_key
DROPBOX_CLIENT_SECRET=your_dropbox_app_secret
DROPBOX_REFRESH_TOKEN=your_refresh_token
DROPBOX_BASE_PATH=/ObsidianVault   # Vault のルートに合わせて変更

# ---- 出力パス（Vault ルートからの相対パス）----
OUTPUT_SUBDIR=AI Digest/Claude Code
RAW_SUBDIR=AI Digest/Claude Code/raw
ASSETS_SUBDIR=AI Digest/Claude Code/assets

# ---- サムネイル ----
ENABLE_THUMBNAIL=true
MODEL_IMAGE=gemini-2.5-flash-image

# ---- OBSIDIAN_VAULT_PATH は Dropbox モードでは使用されない ----
# ローカル保存（STORAGE_TYPE=local）の場合のみ必要
OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault
```

> **注意**: `STORAGE_TYPE=dropbox` の場合、`OBSIDIAN_VAULT_PATH` はファイルパスの構築に使用されません。
> 出力先は `DROPBOX_BASE_PATH` + 各 `*_SUBDIR` の組み合わせで決まります。

## Obsidian の同期設定

Dropbox API で保存したファイルを Obsidian で閲覧するには、Vault のコンテンツを端末にローカル同期する必要があります。

### 方法 A: Dropbox デスクトップアプリ（推奨）

1. Dropbox デスクトップアプリをインストール・サインイン
2. Dropbox の同期設定で `ObsidianVault/` フォルダをローカルに同期
3. Obsidian で `~/Dropbox/ObsidianVault` を Vault として開く

Dropbox が自動的にファイルを同期するため、バッチ実行後しばらく待つと Obsidian 上に最新のダイジェストが表示されます。

### 方法 B: Obsidian Sync

Obsidian Sync を利用している場合、Dropbox のローカル同期フォルダを経由せず直接 Obsidian Sync Vault に書き込む構成には対応していません。この場合は方法 A（Dropbox デスクトップアプリ）を使ってください。

## サムネイル機能の有効化

`ENABLE_THUMBNAIL=true` にするだけで、Gemini の画像生成モデル（Nano Banana）が自動的に呼び出されます。VPS への追加インストールは不要です。

```env
ENABLE_THUMBNAIL=true
MODEL_IMAGE=gemini-2.5-flash-image   # デフォルト
# 高品質版: gemini-3-pro-image-preview
# 高速版:   gemini-3.1-flash-image-preview
```

### サムネイルが Obsidian で表示されない場合

- `DROPBOX_BASE_PATH` と Obsidian の Vault ルートが一致しているか確認
- Dropbox の同期が完了しているか確認（初回同期は数分かかる場合あり）
- ダイジェスト Markdown の frontmatter に `thumbnail:` が記載されているか確認

## ローカル実行との違い

| 項目 | ローカル (`STORAGE_TYPE=local`) | Dropbox (`STORAGE_TYPE=dropbox`) |
|---|---|---|
| ファイル書き込み | Vault に直接書き込み | Dropbox API 経由でアップロード |
| サムネイル | 生成 → Vault に保存 | 生成 → Dropbox にアップロード |
| Obsidian 閲覧 | Vault を直接開く | Dropbox 同期後に開く |
| `OBSIDIAN_VAULT_PATH` | 必須（Vault の絶対パス） | 不使用 |
| 出力パスの決定 | `OBSIDIAN_VAULT_PATH` + `OUTPUT_SUBDIR` | `DROPBOX_BASE_PATH` + `OUTPUT_SUBDIR` |
