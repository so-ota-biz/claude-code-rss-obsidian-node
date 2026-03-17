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

以下のいずれかの方法でTwitter認証情報を取得してください：

**方法A: Cookie認証（Web API経由）- 推奨・申請不要**
1. Twitterにブラウザでログイン（https://twitter.com または https://x.com）
2. ブラウザの開発者ツールを開く：
   - Windows/Linux: `F12` または `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`
3. `Application`タブ（ChromeまたはEdge）または`Storage`タブ（Firefox）を選択
4. 左サイドバーの `Cookies` → `https://twitter.com` または `https://x.com` をクリック
5. 以下の2つのcookie値をコピー：
   - `auth_token`: 長い文字列（例：`1a2b3c4d...`）
   - `ct0`: ランダムな文字列（例：`xyz123...`）

**代替方法（JavaScript コンソール）:**
1. Twitter/Xにログイン後、開発者ツールの`Console`タブを開く
2. 以下のコードを実行してcookie情報を取得：
   ```javascript
   javascript:prompt("Cookies:", document.cookie);
   ```
3. 表示されたcookie文字列から`auth_token`と`ct0`の値を抽出

**方法B: Twitter API v2 Bearer Token（申請必要）**
1. [Twitter Developer Portal](https://developer.twitter.com/en/portal) にアクセス
2. プロジェクトを作成し、App を作成
3. Keys and Tokens タブから Bearer Token を生成・コピー
4. ※「XのデータおよびAPIのすべてのユースケース説明」（100文字以上）が必要

**方法C: レガシー認証（Username/Password）**
1. 既存のTwitterアカウントのユーザー名とパスワードを使用
2. 2FA（二要素認証）が有効な場合は一時的に無効化が必要な場合があります

#### 2. RSSHub設定ファイルの編集

プロジェクトの `examples/rsshub.env.example` をベースに、RSSHub用の環境設定を行います：

```bash
# examples/rsshub.env.example をコピー
cp examples/rsshub.env.example docker/.env
```

`docker/.env` を編集し、以下の認証情報を設定：

**Cookie認証を使用する場合（推奨）:**
```env
NODE_ENV=production
CACHE_TYPE=redis
REDIS_URL=redis://redis:6379/
CACHE_EXPIRE=600
ALLOW_ORIGIN=*

# Twitter Cookie Authentication (手順1で取得した値を設定)
TWITTER_COOKIE=auth_token=your_auth_token_here; ct0=your_ct0_here
```

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

### Cookie認証でのよくある問題と対処法

#### Cookie の有効期限切れ

**症状:**
Cookie認証を設定したが、しばらく経つと再び503エラーが発生する

**対処法:**
1. Twitter/Xに再度ログイン
2. 新しい`auth_token`と`ct0`の値を取得
3. `docker/.env`ファイルを更新
4. RSSHubを再起動（`npm run rsshub:down && npm run rsshub:up`）

#### 不正なCookie形式

**症状:**
```
[error] Twitter cookie format is invalid
```

**対処法:**
1. Cookie値に余分なスペースや改行が含まれていないか確認
2. 正しい形式で設定：`TWITTER_COOKIE=auth_token=値; ct0=値`
3. セミコロン（`;`）とスペースの組み合わせに注意

#### ブラウザでのCookie取得に失敗

**症状:**
開発者ツールでCookieが見つからない、または値が表示されない

**対処法:**
1. Twitter/Xに確実にログインしているか確認（ログイン画面でないか）
2. 別のブラウザ（Chrome、Firefox、Edge）で試行
3. シークレット/プライベートモードでログインし直す
4. JavaScriptコンソール方式を試行

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