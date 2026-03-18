# Test Plan

## Ticket

GitHub Issue #32: DropboxAPI Refresh Token によるアクセストークンの自動更新機能を実装

## Test Targets

### Core Components
- `TokenManager` クラス (新規作成)
  - OAuth 2.0 フロー実行機能
  - トークン自動更新機能
  - トークン保存/読み込み機能
- `DropboxStorage` クラス (拡張)
  - TokenManager統合
  - 自動リトライ機能
- Configuration (拡張)
  - 新しい環境変数のバリデーション
  - 設定の下位互換性

### Integration Points
- Dropbox API連携
- ファイルシステム操作（トークン保存）
- エラーハンドリング

## Test Cases

### Unit Tests

#### TokenManager Tests
1. **OAuth 2.0 Authentication Flow**
   - PKCEパラメータ生成のテスト
   - 認証URL生成のテスト
   - 認証コード→トークン交換のテスト
   - 無効な認証コードでのエラーハンドリング

2. **Token Refresh Mechanism**
   - 有効なリフレッシュトークンでの更新成功
   - 期限切れアクセストークン検出
   - 自動更新実行と新しいトークン保存
   - 無効なリフレッシュトークンでのエラーハンドリング
   - ネットワークエラー時のリトライ動作

3. **Token Storage**
   - トークンファイルの作成・読み込み・更新
   - ファイル権限の設定確認 (Unix系のみ)
   - 破損したトークンファイルからの回復
   - ファイルアクセスエラー時のハンドリング

4. **Token Validation**
   - 有効期限チェックロジック
   - トークン形式の検証
   - 空・null・undefined値のハンドリング

#### DropboxStorage Integration Tests
1. **Token Integration**
   - TokenManagerを使用したDropboxStorage初期化
   - API呼び出し時の自動トークンチェック
   - 401エラー発生時の自動リフレッシュ実行

2. **Error Recovery**
   - トークンリフレッシュ失敗後の適切なエラー伝播
   - 複数回の401エラーでの制限付きリトライ
   - API rate limit時の適切な待機

#### Configuration Tests
1. **Environment Variables**
   - 新しい環境変数のパースとバリデーション
   - 必須項目の不足エラー
   - デフォルト値の適用確認

2. **Backward Compatibility**
   - 従来の `DROPBOX_ACCESS_TOKEN` のみでの動作確認
   - 新旧設定の混在時の動作
   - 段階的移行パスの検証

### Integration Tests

#### End-to-End Dropbox Operations
1. **File Operations with Token Refresh**
   - ファイル書き込み中のトークン期限切れシナリオ
   - ファイル読み込み中の自動リフレッシュ
   - 複数操作にわたるトークン管理

2. **Initial Setup Flow**
   - 初回実行時のOAuth認証フロー
   - ユーザー認証完了後のトークン保存
   - 設定不備時の分かりやすいエラーメッセージ

#### Error Scenarios
1. **Network Issues**
   - Dropbox APIの一時的な障害
   - 断続的なネットワーク接続問題
   - タイムアウト時の適切なエラーハンドリング

2. **Authentication Issues**
   - リフレッシュトークンの取り消し
   - Dropbox App設定の変更
   - 権限不足エラー

### Performance Tests
1. **Token Refresh Overhead**
   - トークンチェック処理の実行時間計測
   - 不要なリフレッシュ実行の回避確認
   - 並行処理時のトークン管理

### Security Tests
1. **Token Storage Security**
   - トークンファイルの権限設定確認
   - 機密情報のログ出力回避確認
   - プロセス間でのトークン共有防止

## Risks / Unknowns

### Test Environment Risks
- **Dropbox API制限**: 開発用アプリの作成とAPI制限の確認が必要
- **OAuth認証**: 自動テストでの認証フロー再現の複雑さ
- **ネットワーク依存**: 外部API依存テストの不安定性

### Coverage Unknowns
- **Dropbox API エラー**: 稀なAPIエラーケースの網羅性
- **OS差異**: Windows/Linux/macOSでのファイル権限処理の差異
- **タイミング**: 非同期処理とトークン期限のタイミング問題

### Test Data Management
- **テスト用Dropboxアカウント**: 専用テストアカウントの準備
- **トークンの管理**: テスト実行のための有効なトークンの管理
- **クリーンアップ**: テスト後のDropboxファイル削除の自動化

### Manual Testing Requirements
- **ブラウザ認証フロー**: OAuth認証の手動実行確認
- **ドキュメント**: README記載手順の実際の動作確認
- **エラーメッセージ**: ユーザビリティ観点での確認