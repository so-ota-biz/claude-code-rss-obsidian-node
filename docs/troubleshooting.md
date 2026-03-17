# トラブルシューティング

## 503エラー（Service Unavailable）の対処法

### 症状

`npm run run`実行時に以下のようなエラーが表示される：

```
[fatal] Error: Status code 503
```

RSSHubのDockerログに以下のメッセージが出力される：

```
error: Error in /twitter/user/anthropicai: ConfigNotFoundError: Twitter API is not configured
info: --> GET /twitter/user/anthropicai 503 192ms
```

### 原因

RSSHubでTwitter APIの認証設定が行われていないため、Twitterアカウントの投稿を取得できない状態です。

### 解決手順

#### 1. Twitter API認証情報の取得

以下のいずれかの方法でTwitter API認証情報を取得してください：

**方法A: Twitter API v2 Bearer Token（推奨）**
1. [Twitter Developer Portal](https://developer.twitter.com/en/portal) にアクセス
2. プロジェクトを作成し、App を作成
3. Keys and Tokens タブから Bearer Token を生成・コピー

**方法B: レガシー認証（Username/Password）**
1. 既存のTwitterアカウントのユーザー名とパスワードを使用
2. 2FA（二要素認証）が有効な場合は一時的に無効化が必要な場合があります

#### 2. RSSHub設定ファイルの編集

プロジェクトの `examples/rsshub.env.example` をベースに、RSSHub用の環境設定を行います：

```bash
# examples/rsshub.env.example をコピー
cp examples/rsshub.env.example docker/.env
```

`docker/.env` を編集し、以下の認証情報を設定：

**Bearer Token を使用する場合:**
```env
NODE_ENV=production
CACHE_TYPE=redis
REDIS_URL=redis://redis:6379/
CACHE_EXPIRE=600
ALLOW_ORIGIN=*

# Twitter API v2 Bearer Token
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

**Username/Password を使用する場合:**
```env
NODE_ENV=production
CACHE_TYPE=redis
REDIS_URL=redis://redis:6379/
CACHE_EXPIRE=600
ALLOW_ORIGIN=*

# Twitter Legacy Auth
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
```

#### 3. docker-compose設定の更新

`docker/docker-compose.rsshub.yml` の env_file 設定を確認し、作成した `.env` ファイルを参照するよう変更：

```yaml
services:
  rsshub:
    # ... 他の設定
    env_file:
      - ./.env  # examples/rsshub.env.example から docker/.env に変更
```

#### 4. RSSHubコンテナの再起動

設定変更後、RSSHubを再起動して新しい設定を適用：

```bash
npm run rsshub:down
npm run rsshub:up
```

#### 5. 動作確認

```bash
npm run run
```

正常に動作する場合、以下のような出力が表示されます：

```
[info] Target day: 2026-03-17 (...)
[info] Fetching RSS for @anthropicai
[info]  -> X posts  # Xは取得された投稿数
```

### その他のよくあるエラー

#### 404エラー（Account not found）

**症状:**
```
[error] Account @username: Account not found (404)
```

**対処法:**
- アカウント名のスペルミスを確認
- アカウントが存在するか、削除・非公開になっていないか確認
- `.env` の `TARGET_ACCOUNTS` 設定を見直し

#### 429エラー（Rate limit exceeded）

**症状:**
```
[error] Account @username: Rate limit exceeded (429)
```

**対処法:**
- 時間をおいて再実行
- 複数アカウントを設定している場合は、一時的に取得対象アカウントを減らす
- RSSHubのキャッシュ設定（`CACHE_EXPIRE`）を長めに設定

### 参考リンク

- [RSSHub公式ドキュメント](https://docs.rsshub.app/)
- [RSSHub Twitter Route Documentation](https://docs.rsshub.app/routes/social-media#twitter)
- [Twitter API Documentation](https://developer.twitter.com/en/docs)