# Test Plan

## Ticket

https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/36

## Test Targets

- `src/lib/__tests__/config.test.ts` — `DROPBOX_CLIENT_SECRET` 追加後のバリデーション
- `src/lib/__tests__/storage-factory.test.ts` — `dropboxClientSecret` 必須化後のファクトリ動作
- `src/lib/__tests__/token-manager.test.ts` — SDK v10 新 API 対応後のトークンリフレッシュ動作

## Test Cases

### config.test.ts

| # | テスト名 | 変更内容 |
|---|---|---|
| 1 | beforeEach クリーンアップ | `DROPBOX_CLIENT_SECRET` を env クリーンアップリストに追加 |
| 2 | configures dropbox OAuth when CLIENT_ID and REFRESH_TOKEN are provided | `DROPBOX_CLIENT_SECRET: 'test-client-secret'` 追加、`dropboxClientSecret` アサーション追加 |
| 3 | uses default token storage path when not specified | `DROPBOX_CLIENT_SECRET: 'test-client-secret'` 追加 |
| 4 | allows OAuth config without REFRESH_TOKEN for first-time setup | `DROPBOX_CLIENT_SECRET` + `DROPBOX_TOKEN_STORAGE_PATH` 追加（バリデーション通過に必要） |
| 5 | warns when both access token and OAuth config are provided | `DROPBOX_CLIENT_SECRET: 'test-client-secret'` 追加 |
| 6 | throws error when STORAGE_TYPE is dropbox but no authentication is provided | エラーメッセージを新メッセージ（`DROPBOX_CLIENT_SECRET` 含む）に更新 |
| 7 | accepts CLIENT_ID with token storage path but no refresh token | `DROPBOX_CLIENT_SECRET: 'test-client-secret'` 追加、`dropboxClientSecret` アサーション追加 |

### storage-factory.test.ts

| # | テスト名 | 変更内容 |
|---|---|---|
| 1 | creates DropboxStorage with TokenManager when CLIENT_ID is provided | config に `dropboxClientSecret: 'test-client-secret'` 追加、`TokenManager` 呼び出しアサーションに `clientSecret` 追加 |
| 2 | uses default token storage path when not specified | 同上 |
| 3 | handles OAuth config without refresh token for first-time setup | 同上 |
| 4 | prefers OAuth configuration over legacy access token when both are provided | 同上 |

### token-manager.test.ts

| # | テスト名 | 変更内容 |
|---|---|---|
| 1 | beforeEach config | `clientSecret: 'test-client-secret'` 追加（PR #12 で対応済み） |
| 2 | mock 構造 | `mockAuth = { checkAndRefreshAccessToken, getAccessToken, getRefreshToken, getAccessTokenExpiresAt }` に変更、`Dropbox` を `vi.fn()` でインスタンス毎に `auth` を持つように更新 |
| 3 | refreshAccessToken - successfully refreshes | `mockAuth` の新 API を使うように更新、旧 `setAccessToken`/`setRefreshToken`/`refreshAccessToken` アサーション削除 |
| 4 | refreshAccessToken - throws error on API failure | `mockAuth.checkAndRefreshAccessToken` が reject するように更新 |
| 5 | getValidAccessToken - refreshes token when expired | `mockAuth` 経由のリフレッシュで動作するように更新 |
| 6 | getValidAccessToken - refreshes token when expiring soon | 同上 |
| 7 | getValidAccessToken - uses config refresh token when no token info available | 同上 |
| 8 | getValidAccessToken - handles concurrent refresh requests | `mockAuth.checkAndRefreshAccessToken` が1回だけ呼ばれることを確認 |
| 9 | initializeWithRefreshToken - initializes and gets access token | `mockAuth` の新 API を使うように更新 |

## Risks / Unknowns

- `token-manager.test.ts` の mock 構造変更が広範囲のため、意図しない見落としが発生する可能性がある
- `storage-dropbox.test.ts` が `storage-dropbox.ts` の変更（`setAccessToken` → `new Dropbox({ accessToken })`）と整合しているか確認が必要（本 Issue のスコープ外だが副作用として検出される可能性がある）
