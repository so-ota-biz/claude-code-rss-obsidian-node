# Test Plan

## Ticket

Issue #30: データ保存方法を Dropbox API に切り替えられる構造にする
https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/30

## Test Targets

- **StorageProvider Interface**: 抽象化インターフェースの正確性
- **LocalStorage Implementation**: 既存の動作を保持
- **DropboxStorage Implementation**: Dropbox API連携の動作
- **Configuration Loading**: 環境変数による動的プロバイダー選択
- **File Operations**: ファイル読み書き・ディレクトリ作成の動作確認
- **Error Handling**: エラー時の適切な例外とメッセージ
- **Path Normalization**: Windows/Unix パス形式の正規化
- **Integration**: メイン処理フローでの統合テスト

## Test Cases

### 1. Configuration Tests (`config.test.ts`)

#### TC-CFG-001: デフォルト設定でローカルストレージが選択される
- **Given**: `STORAGE_TYPE`環境変数が未設定
- **When**: `loadConfig()`を実行
- **Then**: `storageType`が`'local'`になる

#### TC-CFG-002: STORAGE_TYPE=dropbox時の設定読み込み
- **Given**: `STORAGE_TYPE=dropbox`, `DROPBOX_ACCESS_TOKEN=test_token`
- **When**: `loadConfig()`を実行  
- **Then**: `storageType`が`'dropbox'`, `dropboxAccessToken`が`'test_token'`になる

#### TC-CFG-003: Dropbox設定不備時のエラー
- **Given**: `STORAGE_TYPE=dropbox`, `DROPBOX_ACCESS_TOKEN`未設定
- **When**: `loadConfig()`を実行
- **Then**: 設定不備エラーが発生する

### 2. LocalStorage Tests (`storage-local.test.ts`)

#### TC-LOC-001: ローカルファイル書き込み
- **Given**: LocalStorageインスタンス
- **When**: `writeFile('test/file.txt', 'content')`を実行
- **Then**: 指定パスにファイルが作成され、内容が正しく書き込まれる

#### TC-LOC-002: ローカルファイル読み取り
- **Given**: 既存ファイル `test/file.txt`
- **When**: `readFile('test/file.txt')`を実行
- **Then**: ファイル内容が正しく読み取れる

#### TC-LOC-003: ディレクトリ作成
- **Given**: LocalStorageインスタンス
- **When**: `ensureDir('test/nested/dir')`を実行
- **Then**: ディレクトリが再帰的に作成される

#### TC-LOC-004: ファイル存在チェック
- **Given**: 存在するファイル・存在しないファイル
- **When**: `exists()`を実行
- **Then**: 正しいbool値が返される

### 3. DropboxStorage Tests (`storage-dropbox.test.ts`)

#### TC-DRP-001: Dropboxファイル書き込み (Mock)
- **Given**: MockしたDropbox APIクライアント
- **When**: `writeFile('/test/file.txt', 'content')`を実行
- **Then**: Dropbox API `filesUpload`が正しいパラメータで呼ばれる

#### TC-DRP-002: Dropboxファイル読み取り (Mock)
- **Given**: MockしたDropbox APIクライアント
- **When**: `readFile('/test/file.txt')`を実行
- **Then**: Dropbox API `filesDownload`が呼ばれ、内容が返される

#### TC-DRP-003: Dropboxディレクトリ作成 (Mock)
- **Given**: MockしたDropbox APIクライアント
- **When**: `ensureDir('/test/nested/dir')`を実行
- **Then**: Dropbox API `filesCreateFolderV2`が呼ばれる

#### TC-DRP-004: パス正規化
- **Given**: DropboxStorageインスタンス
- **When**: Windowsパス形式 `test\file.txt`を渡す
- **Then**: Unix形式 `/test/file.txt`に正規化される

#### TC-DRP-005: Dropbox APIエラーハンドリング
- **Given**: MockでDropbox APIエラーを返すように設定
- **When**: ファイル操作を実行
- **Then**: 適切なエラーメッセージと共に例外が発生

### 4. Storage Factory Tests (`storage.test.ts`)

#### TC-FAC-001: ローカルストレージファクトリー
- **Given**: `storageType: 'local'`の設定
- **When**: `createStorageProvider(config)`を実行
- **Then**: `LocalStorage`インスタンスが返される

#### TC-FAC-002: Dropboxストレージファクトリー
- **Given**: `storageType: 'dropbox'`の設定
- **When**: `createStorageProvider(config)`を実行
- **Then**: `DropboxStorage`インスタンスが返される

#### TC-FAC-003: 不明なストレージタイプの処理
- **Given**: `storageType: 'unknown'`の設定
- **When**: `createStorageProvider(config)`を実行
- **Then**: デフォルトで`LocalStorage`インスタンスが返される

### 5. Integration Tests (`integration.test.ts`)

#### TC-INT-001: E2Eローカルストレージ
- **Given**: ローカルストレージ設定
- **When**: メイン処理を実行（モックデータ使用）
- **Then**: digest, raw, thumbnail, stateの各ファイルがローカルに保存される

#### TC-INT-002: E2E Dropboxストレージ（Mock）
- **Given**: Dropboxストレージ設定（API Mock）
- **When**: メイン処理を実行（モックデータ使用）
- **Then**: 各ファイルのDropboxへの保存処理が正しく呼ばれる

### 6. Backward Compatibility Tests (`backward-compatibility.test.ts`)

#### TC-BCK-001: 既存設定での動作保証
- **Given**: `STORAGE_TYPE`未設定の既存環境
- **When**: アプリケーション実行
- **Then**: 従来通りローカルファイルシステムに保存される

#### TC-BCK-002: 既存パス設定の維持
- **Given**: `OBSIDIAN_VAULT_PATH`等の既存設定
- **When**: ローカルストレージモードで実行
- **Then**: 既存の保存パスが維持される

## Risks / Unknowns

### 1. Dropbox API仕様の詳細
- **リスク**: Dropbox JavaScript SDK v10+の詳細な動作、エラーコード
- **対策**: 公式ドキュメント確認、実際のAPI呼び出しテスト

### 2. 大きなファイルサイズの対応
- **リスク**: 画像ファイル等のバイナリデータアップロード処理
- **対策**: 初期実装では小さなテキストファイルのみ、必要に応じて拡張

### 3. Dropbox API制限
- **リスク**: レート制限、ファイルサイズ制限
- **対策**: エラーハンドリングでの適切な表示

### 4. 非同期処理のパフォーマンス
- **リスク**: Dropbox API呼び出しによる処理時間増加
- **対策**: 初期実装では順次処理、後に並列化検討

### 5. テスト環境での認証
- **リスク**: CI/CDでのDropbox API認証テスト
- **対策**: Mock中心のテスト、実際のAPI呼び出しはローカル開発のみ