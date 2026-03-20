# Design

## Ticket

https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/36
(Referenced PR comment: https://github.com/so-ota-biz/claude-code-rss-obsidian-node/pull/12#discussion_r2950899036)

## Background

- PR #12 (`fix/dropbox-token-manager-api-v10`) は Dropbox SDK v10 で廃止された `setAccessToken()` / `setRefreshToken()` / `refreshAccessToken()` の使用を修正している
- PR #12 では `DROPBOX_CLIENT_SECRET` のサポートを `config.ts` / `types.ts` / `token-manager.ts` / `storage-factory.ts` に追加した
- CodeRabbit によるレビュー（r2950899036）で、PR #12 の変更によって以下のテストが壊れることが指摘された：
  - `config.test.ts`：`DROPBOX_CLIENT_SECRET` なしで OAuth フローをテストしている箇所
  - `storage-factory.test.ts`：`dropboxClientSecret` なしで `TokenManager` を生成している箇所
  - `token-manager.test.ts`：旧 Dropbox SDK API (`setAccessToken`/`setRefreshToken`/`refreshAccessToken`) のモックを使用している箇所

## Scope

本タスクでは main ブランチを起点に新しい作業ブランチを作成し、以下をすべて含む完全な実装を行う：

1. **ソースコード変更**（PR #12 の変更をポート）
   - `src/types.ts`: `AppConfig` に `dropboxClientSecret?: string` を追加
   - `src/lib/config.ts`: `DROPBOX_CLIENT_SECRET` をスキーマ・バリデーション・返り値に追加
   - `src/lib/token-manager.ts`: `TokenManagerConfig` に `clientSecret: string` を追加し `refreshAccessToken()` を SDK v10 対応実装へ変更
   - `src/lib/storage-dropbox.ts`: 廃止された `setAccessToken()` を `new Dropbox({ accessToken })` に変更
   - `src/lib/storage-factory.ts`: `clientSecret` を条件判定と `TokenManager` 生成に追加

2. **テスト修正**（CodeRabbit r2950899036 が指摘した未対応箇所）
   - `src/lib/__tests__/config.test.ts`
   - `src/lib/__tests__/storage-factory.test.ts`
   - `src/lib/__tests__/token-manager.test.ts`

## Design Decisions

### config.ts のバリデーション変更
`DROPBOX_CLIENT_SECRET` を必須とする条件に変更：
```ts
const hasCompleteOAuthConfig = !!(
  env.DROPBOX_CLIENT_ID &&
  env.DROPBOX_CLIENT_SECRET &&
  (env.DROPBOX_REFRESH_TOKEN || hasExplicitTokenStoragePath)
);
```
- エラーメッセージも `DROPBOX_CLIENT_SECRET` を含む形に更新

### TokenManagerConfig の clientSecret
- `clientSecret: string` を必須フィールドとして追加（`refreshAccessToken()` で必要）
- `process.env.DROPBOX_CLIENT_SECRET` の直接参照を廃止し、設定経由に一本化

### token-manager.ts の refreshAccessToken() 実装変更
旧方式（SDK v10 で動作しない）:
```ts
this.dropbox.setAccessToken(...);
this.dropbox.setRefreshToken(...);
const response = await this.dropbox.refreshAccessToken();
```
新方式（SDK v10 対応）:
```ts
const refreshDropbox = new Dropbox({ clientId, clientSecret, refreshToken });
await refreshDropbox.auth.checkAndRefreshAccessToken();
const newAccessToken = refreshDropbox.auth.getAccessToken();
```

### storage-factory.ts の条件変更
`dropboxClientId` だけでなく `dropboxClientSecret` も存在する場合のみ OAuth モードを使用：
```ts
if (config.dropboxClientId && config.dropboxClientSecret) { ... }
```

### テスト方針
- **config.test.ts**: 全 OAuth テストに `DROPBOX_CLIENT_SECRET` を追加、`beforeEach` クリーンアップリストにも追加、エラーメッセージ文言を更新、"first-time setup" テストは `DROPBOX_TOKEN_STORAGE_PATH` も追加
- **storage-factory.test.ts**: 全 OAuth テストに `dropboxClientSecret` を追加、`TokenManager` 呼び出しアサーションに `clientSecret` を追加
- **token-manager.test.ts**: モックを新 SDK API (`auth.checkAndRefreshAccessToken`, `auth.getAccessToken` 等) に更新、`refreshAccessToken` / `getValidAccessToken` / `initializeWithRefreshToken` テストを更新

## Risks

- `token-manager.test.ts` の `refreshAccessToken` 関連テストはモック構造が大きく変わるため、意図しない挙動見落としのリスクがある
- `storage-dropbox.test.ts` には今回の `storage-dropbox.ts` 変更との整合確認が必要（スコープ外だが要確認）
