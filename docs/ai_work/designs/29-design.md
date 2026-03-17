# Design

## Ticket

GitHub Issue #29: 収集対象 X アカウントの管理方法変更  
https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/29

## Background

- 現在、収集対象のXアカウント（Twitter）は `.env` ファイルの `TARGET_ACCOUNTS` に直接書き込まれている
- この方式では以下の課題がある：
  - アカウント追加・削除時に `.env` ファイルの直接編集が必要
  - カンマ区切り形式で可読性が低い
  - アカウントごとの詳細設定（説明、カテゴリなど）を追加しにくい
- より柔軟で管理しやすい設定ファイル形式への変更が必要

## Scope

### 変更対象
- `src/lib/config.ts`: 設定読み込みロジックの変更
- `src/types.ts`: 型定義の追加・変更
- `.env.example`: 環境変数の削除・説明の更新
- `config/accounts.yml`: 新設定ファイルの追加
- 既存テストの更新

### 変更しないもの
- 既存の `.env` ファイルの他の設定項目
- アカウント処理の基本ロジック
- RSS取得・処理フロー

## Design Decisions

### 1. 設定ファイル形式の選択
- **選択**: `config/accounts.yml` (YAML形式)
- **理由**: JSONより可読性が高く、コメント記述も可能
- **代替案**: `config/accounts.json` は機械的な処理には適しているが、人間による編集では YAML の方が優位

### 2. 設定ファイル構造
```yaml
# config/accounts.yml
accounts:
  - name: "anthropicai"
    description: "Anthropic official account"
    category: "AI Company"
  - name: "claudeai" 
    description: "Claude AI official account"
    category: "AI Product"
```

### 3. 後方互換性の維持
- 既存の `TARGET_ACCOUNTS` 環境変数が設定されている場合は優先使用
- 設定ファイルが存在しない場合は環境変数にフォールバック
- 段階的移行を可能にする

### 4. バリデーション強化
- 設定ファイルの構造検証
- アカウント名の重複チェック
- 必須フィールドの存在確認

## Risks

### 技術的リスク
- YAML パース処理の追加による初期化時間の若干の増加
- 設定ファイル読み込みエラー時の適切なエラーハンドリングが必要
- 既存の環境変数ベース設定からの移行時の混乱

### 運用リスク
- 設定ファイルの場所や形式を理解せずに古い方法で設定しようとするユーザー
- YAMLの構文エラーによる起動失敗の可能性

### 対策
- 詳細なREADMEドキュメント更新
- エラーメッセージの改善
- 設定ファイルのテンプレート提供
- 既存環境変数からの自動移行ユーティリティ検討