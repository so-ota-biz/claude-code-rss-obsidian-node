# Design

## Ticket

GitHub Issue #32: DropboxAPI Refresh Token によるアクセストークンの自動更新機能を実装

## Background

- Dropbox のアクセストークン期限切れ問題に対応する必要がある
- 2021年9月30日以降、Dropbox のアクセストークンは4時間で期限切れとなる
- 従来の長期間有効なトークンは廃止された
- 現在の実装では静的アクセストークンを使用しているため、4時間後にAPI呼び出しが失敗する

## Scope

### 実装対象
- OAuth 2.0 フローでRefresh Tokenを取得する仕組み
- アクセストークンの自動更新機能
- トークン管理の設定項目追加
- エラーハンドリングと再試行ロジック
- ドキュメント更新（README等）

### 対象外
- Dropbox API の既存機能変更
- 既存のローカルストレージ機能の変更
- UI/CLIインターフェースの追加

## Design Decisions

### 1. OAuth 2.0 実装方針
- **PKCE (Proof Key for Code Exchange)** を使用したOAuth 2.0フローを実装
- セキュリティを重視し、Client Secretを避けてPKCEフローを採用
- `dropbox` ライブラリのOAuth機能を活用

### 2. トークン管理設計
- 新しい `TokenManager` クラスを作成してトークン管理を分離
- アクセストークンとリフレッシュトークンの両方を管理
- トークンの有効期限チェックと自動更新機能
- セキュアなトークン保存（ローカルファイル、暗号化考慮）

### 3. 設定項目の追加
```typescript
// 新しい環境変数
DROPBOX_CLIENT_ID: string           // Dropbox App Key
DROPBOX_REFRESH_TOKEN: string       // Initial Refresh Token (optional)
DROPBOX_TOKEN_STORAGE_PATH: string  // Token storage file path
```

### 4. DropboxStorage クラスの拡張
- コンストラクタでTokenManagerを受け取る方式に変更
- API呼び出し時に自動的にトークンの有効性をチェック
- トークンが期限切れの場合は自動更新を実行

### 5. エラーハンドリング戦略
- 401 Unauthorizedエラー検出時の自動リトライ
- リフレッシュトークンが無効な場合の適切なエラーメッセージ
- 設定不備時の詳細なエラーガイダンス

### 6. 初期セットアップフロー
- 初回実行時にOAuth認証URLを表示
- ユーザーがブラウザで認証完了後、認証コードを入力
- 認証コード→アクセストークン+リフレッシュトークン変換
- トークンをセキュアに保存

## Risks

### セキュリティリスク
- リフレッシュトークンの平文保存リスク → 暗号化ストレージ検討必要
- トークンファイルの権限設定 → chmod 600相当の制限必要

### 運用リスク
- 初回セットアップの複雑化 → 詳細なドキュメント作成必要
- リフレッシュトークン期限切れ時の手動再認証 → 適切なエラーメッセージ必要

### 技術リスク
- Dropbox APIの仕様変更 → 将来的な互換性の監視必要
- 既存コードへの影響 → 下位互換性の保持

### 依存関係リスク
- `dropbox` ライブラリのOAuth実装依存 → 代替実装の検討