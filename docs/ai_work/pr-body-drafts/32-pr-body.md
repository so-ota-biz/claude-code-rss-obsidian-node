# Related Issue / Ticket

Closes #32: DropboxAPI Refresh Token によるアクセストークンの自動更新機能を実装

GitHub Issue: https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/32

# Summary

2021年9月30日以降のDropbox Access Tokenは4時間で期限切れとなる問題を解決するため、OAuth 2.0 + Refresh Tokenによる自動更新機能を実装。長期運用において手動でトークンを更新する必要がなくなり、安定したDropbox連携を実現します。

## ビジネスインパクト
- **長期運用の安定性向上**: 4時間ごとの手動トークン更新が不要となり、自動化ワークフローが中断されなくなります
- **下位互換性の保持**: 既存の静的Access Token設定も引き続き利用可能で、段階的な移行が可能です
- **セキュリティの向上**: PKCE (Proof Key for Code Exchange) を使用したOAuth 2.0フローでセキュアな認証を実現

# Technical Changes

## Core Implementation

### 1. TokenManager クラス (新規作成)
- `src/lib/token-manager.ts`
- OAuth 2.0 PKCE フローの実装
- アクセストークンの自動更新機能
- セキュアなトークン保存（ローカルファイル、600権限）
- 並行リクエスト時の重複リフレッシュ防止

### 2. DropboxStorage クラスの拡張
- `src/lib/storage-dropbox.ts`
- TokenManager統合によるコンストラクタのオーバーロード対応
- 401 Unauthorizedエラー発生時の自動リトライ機能（最大2回）
- エラーハンドリングの改善とユーザフレンドリーなエラーメッセージ

### 3. 設定システムの拡張
- `src/lib/config.ts`, `src/types.ts`
- 新しい環境変数の追加:
  - `DROPBOX_CLIENT_ID`: Dropbox App Key
  - `DROPBOX_REFRESH_TOKEN`: Refresh Token（初回セットアップ後は自動管理）
  - `DROPBOX_TOKEN_STORAGE_PATH`: トークンファイル保存パス
- 設定バリデーションロジックの改善
- 新旧設定の共存と優先度制御

### 4. ストレージファクトリの更新
- `src/lib/storage-factory.ts`
- OAuth設定優先の実装ロジック
- 下位互換性の確保

## Documentation Updates

### 5. README.md の更新
- OAuth 2.0セットアップ手順の追加
- 推奨設定（OAuth）と非推奨設定（静的トークン）の明記
- Dropbox App作成・設定手順の詳細化

### 6. 環境設定ファイル
- `.env.example` の更新
- OAuth設定例とコメントの追加

# Self-Decisions

## 設計上の自律判断

### 1. PKCE フローの採用
- Client Secretを避けてPKCE (Proof Key for Code Exchange) フローを選択
- セキュリティを重視し、公開クライアントでも安全な認証を実現

### 2. 下位互換性の優先
- 既存の静的Access Token設定を完全に削除せず、段階的移行を可能にする設計
- OAuth設定が利用可能な場合は優先使用、フォールバックで静的トークンを使用

### 3. トークン管理の分離
- `TokenManager`クラスを独立したモジュールとして作成
- Single Responsibility Principleに従い、トークン管理の責務を分離

### 4. エラーハンドリング戦略
- 401エラー時の自動リトライ回数を2回に制限（無限ループ防止）
- リフレッシュトークンが無効な場合の適切なエラーメッセージ

### 5. 並行処理の考慮
- 複数のAPI呼び出しが同時にトークンリフレッシュを試行する場合の重複防止
- Promise-based approach による効率的なリフレッシュ管理

### 6. ファイル権限の設定
- トークンファイルに600権限（所有者のみ読み書き）を設定
- セキュリティを重視したトークン保存

# Verification

## 実装完了項目

### ✅ Core Functionality
- [x] OAuth 2.0 PKCE フロー実装
- [x] 自動トークンリフレッシュ機能
- [x] 401エラー時の自動リトライ
- [x] セキュアなトークン保存

### ✅ Integration
- [x] DropboxStorage クラスの TokenManager 統合
- [x] 設定システムの拡張
- [x] ストレージファクトリの更新

### ✅ Backward Compatibility
- [x] 既存の静的Access Token設定のサポート継続
- [x] 段階的移行パスの提供

### ✅ Documentation
- [x] README.md の OAuth 設定手順追加
- [x] .env.example の更新
- [x] 設定優先度の明記

## テストカバレッジ

### ✅ TokenManager Tests (23 test cases)
- [x] OAuth認証フロー
- [x] トークンリフレッシュ機能
- [x] ファイル読み書き
- [x] エラーハンドリング
- [x] 並行処理対応

### ✅ DropboxStorage Integration Tests
- [x] TokenManager統合
- [x] 401エラー時の自動リトライ
- [x] 下位互換性確認
- [x] エラーケースハンドリング

### ✅ Configuration Tests
- [x] 新しい環境変数のパース
- [x] バリデーションロジック
- [x] 設定優先度の確認

### ✅ Storage Factory Tests  
- [x] OAuth優先ロジック
- [x] フォールバック動作
- [x] エラーケース

## 動作確認項目

### ✅ Environment Setup
- [x] 新しい環境変数の設定パース
- [x] デフォルト値の適用
- [x] バリデーションエラーの適切な表示

### ✅ Integration Flow
- [x] OAuth設定時のTokenManager初期化
- [x] 静的トークン設定時のレガシーモード動作
- [x] 設定不備時の明確なエラーメッセージ

# Notes

## Future Enhancements

今回の実装では基盤となるトークン管理機能を提供しましたが、将来的に以下の機能追加が考えられます：

1. **CLI認証コマンド**: `npm run auth:dropbox` による対話的OAuth認証
2. **自動トークン取得**: 初回実行時の自動認証フロー
3. **トークン暗号化**: ローカル保存時の暗号化オプション
4. **設定移行ツール**: 既存の静的トークンからOAuth設定への移行ツール

## Security Considerations

- トークンファイルは600権限で保存されセキュリティを確保
- Client Secretは使用せずPKCEフローでセキュリティを維持
- リフレッシュトークンの適切な管理と自動更新

## Breaking Changes

なし。完全な下位互換性を維持しています。