# Design

## Ticket

Issue #30: データ保存方法を Dropbox API に切り替えられる構造にする
https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/30

## Background

- 現在のアプリケーションは、ObsidianのVault（ローカルファイルシステム）にMarkdownファイルを直接保存する構造
- Issue #30では、Dropbox APIを使った保存方法に切り替えられるようにする要求
- 現在の保存方法も保持し、環境変数フラグで動線を制御する必要がある

### 現在の保存処理の分析

- **ファイル保存の箇所**: 
  - `src/lib/markdown.ts`: `writeDigestMarkdown()`, `writeRawMarkdown()` (行39-52, 93-95)
  - `src/lib/thumbnail.ts`: `maybeGenerateThumbnail()` (行22-25)
  - `src/lib/fs.ts`: `writeState()` (行19-22)
- **ファイル読み取りの箇所**: 
  - `src/lib/fs.ts`: `readState()` (行9-17)
- **使用されるパス**:
  - ObsidianVault内の各サブディレクトリ（outputSubdir, rawSubdir, assetsSubdir）
  - 状態ファイル（state.json）

## Scope

### 変更対象

1. **新規モジュール作成**:
   - `src/lib/storage.ts`: ストレージ抽象化インターフェース
   - `src/lib/storage-dropbox.ts`: Dropbox API実装
   - `src/lib/storage-local.ts`: 既存のローカルファイルシステム実装

2. **既存モジュール修正**:
   - `src/lib/config.ts`: Dropbox設定項目の追加
   - `src/lib/fs.ts`: ストレージ抽象化への移行
   - `src/lib/markdown.ts`: ストレージ抽象化への移行
   - `src/lib/thumbnail.ts`: ストレージ抽象化への移行
   - `src/index.ts`: ストレージ選択ロジックの追加

3. **設定ファイル**:
   - `.env.example`: Dropbox設定の追加
   - `package.json`: Dropbox API依存関係の追加

### 環境変数設定

- `STORAGE_TYPE`: `local` (default) | `dropbox`
- `DROPBOX_ACCESS_TOKEN`: Dropbox APIアクセストークン
- `DROPBOX_BASE_PATH`: Dropbox内のベースパス (optional, default: `/`)

## Design Decisions

### 1. ストレージ抽象化パターンの採用

```typescript
interface StorageProvider {
  writeFile(path: string, content: string | Buffer): Promise<void>
  readFile(path: string): Promise<string>
  ensureDir(path: string): Promise<void>
  exists(path: string): Promise<boolean>
}
```

**理由**: 将来的に他のクラウドストレージ（Google Drive, OneDrive等）への拡張も容易

### 2. ファクトリーパターンでプロバイダー選択

```typescript
function createStorageProvider(config: AppConfig): StorageProvider {
  switch (config.storageType) {
    case 'dropbox': return new DropboxStorage(config)
    case 'local': return new LocalStorage(config)
    default: return new LocalStorage(config)
  }
}
```

**理由**: 設定に基づく動的なプロバイダー選択、デフォルトはlocal

### 3. パス正規化戦略

- **Local**: 既存の `path.join()` を使用
- **Dropbox**: Unix形式パス（`/`区切り）に正規化し、先頭に`/`を付与

**理由**: Dropbox APIはUnixパス形式を要求、ローカルは既存のWindows/Unix互換を維持

### 4. エラーハンドリング

- Dropbox APIエラー時はローカル保存へのフォールバックは **行わない**
- 明示的なエラーメッセージで設定不備を通知

**理由**: 意図しない保存先変更による混乱を回避

### 5. 後方互換性

- デフォルト値は`STORAGE_TYPE=local`で既存動作を維持
- 既存のObsidian関連設定はそのまま使用

## Risks

### 1. Dropbox API制限・エラー

- **リスク**: API制限、ネットワークエラー、認証エラー
- **対策**: 適切なエラーメッセージ、リトライ機能は初期実装では省略

### 2. ファイルパス互換性

- **リスク**: Windows/Unix パス形式の差異による問題
- **対策**: パス正規化関数の徹底

### 3. 既存ユーザーへの影響

- **リスク**: 環境変数追加による設定ミス
- **対策**: デフォルト値でのフォールバック、明確な設定ガイド

### 4. サムネイル生成との互換性

- **リスク**: Dropbox保存時のサムネイル生成スクリプトの動作
- **対策**: thumbnail処理はローカル一時ファイル経由で実装

### 5. Obsidianとの統合

- **リスク**: Dropbox保存時はObsidianでの直接閲覧不可
- **対策**: ユーザーに明示的に伝達（ドキュメント化）