# Design

## Ticket

GitHub Issue #27 - 503エラーの解消
https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/27

## Background

- `npm run run`の実行で503エラーが発生し、プログラムがfatalエラーで終了する
- RSSHubのDockerログによると、Twitter API設定不備により`/twitter/user/anthropicai`で503エラーが発生
- 現在の`src/lib/rss.ts`では`parser.parseURL()`でHTTPエラーに対する適切なハンドリングが実装されていない
- ユーザーはRSSHubのTwitter API認証設定が必要だが、その手順書が存在しない

## Scope

### 対処範囲

1. **エラーハンドリング改善** - RSS取得時の503エラーやその他HTTPエラーに対する適切な処理
2. **ユーザー向け手順書作成** - Twitter API設定手順を含むトラブルシューティングドキュメント
3. **ログメッセージ改善** - 503エラーの際により具体的で分かりやすいエラーメッセージ

### 対処対象外

- RSSHub自体の設定変更や修正
- Twitter APIキーの取得方法（外部ドキュメント）
- その他のHTTPステータスコード以外のエラー

## Design Decisions

### 1. エラーハンドリング戦略

- `src/lib/rss.ts`の`fetchPostsForAccount`関数でHTTPエラーをcatchし、適切なエラーメッセージを出力
- 503エラーの場合は「API設定不備」を示唆するメッセージを表示
- アカウント単位でエラーが発生しても、他のアカウントの処理は継続する
- プログラム全体は終了せず、取得できたデータがあれば処理を継続

### 2. 手順書の作成

- `docs/troubleshooting.md`を作成し、以下の内容を含む：
  - Twitter API認証設定手順
  - RSSHubのenv設定方法
  - 一般的な503エラーの対処法
  - アカウントごとのエラー発生パターン

### 3. ログレベルとメッセージ改善

- 503エラー時は`[error]`レベルで明確なメッセージを表示
- 他のアカウントの処理継続を`[info]`レベルで通知
- 設定手順への言及を含める

### 4. 実装方針

- 既存のコード構造を最小限の変更で改善
- `try-catch`でrss-parserの例外をキャッチ
- HTTPエラーステータスに応じた分岐処理
- 空の結果配列を返すことで、後続処理のエラーを回避

## Risks

- rss-parserライブラリの内部動作に依存するため、ライブラリ更新時に挙動が変わる可能性
- Twitter API以外のHTTPエラー（404、429など）に対する最適なハンドリング戦略を決める必要
- ユーザーがTwitter API設定を行うまでの間、アプリケーションの動作テストが困難