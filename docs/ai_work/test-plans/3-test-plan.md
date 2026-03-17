# Test Plan

## Ticket

GitHub Issue #3 - 適切な単体テストを設計・実装する
https://github.com/so-ota-biz/claude-code-rss-obsidian-node/issues/3

## Test Targets

| ファイル | テスト対象関数 | 種別 |
|---|---|---|
| `src/lib/text.ts` | `stripHtml`, `detectLanguage`, `looksLikeRetweet`, `looksLikeReply`, `normalizeForDedup`, `truncate` | 純粋関数 |
| `src/lib/date.ts` | `getTargetDateRange`, `isWithinRange` | 純粋関数（日付演算） |
| `src/lib/fs.ts` | `ensureDir`, `readState`, `writeState`, `resolveVaultPath` | ファイルシステム |
| `src/lib/config.ts` | `loadConfig` | 環境変数パース |
| `src/lib/pipeline.ts` | `processPosts`, `buildDigest` | 非同期・GeminiClientモック |
| `src/lib/markdown.ts` | `writeDigestMarkdown`, `writeRawMarkdown` | ファイルシステム |
| `src/lib/gemini.ts` | `GeminiClient.translate`, `GeminiClient.buildDigest` | fetch モック |
| `src/lib/thumbnail.ts` | `maybeGenerateThumbnail` | spawn モック |

## Test Cases

### text.ts

#### `stripHtml`
- `<br>` / `<br/>` が `\n` に変換されること
- `<div>`, `<span>` 等のタグが除去されること
- `&amp;`, `&lt;`, `&gt;`, `&#39;`, `&quot;`, `&nbsp;` がデコードされること
- 連続スペースが1つに正規化されること
- 3行以上の連続改行が2行に正規化されること
- 前後の空白がトリムされること

#### `detectLanguage`
- 日本語文字が4文字以上 → `'ja'` を返す
- 十分なラテン文字を含む英語テキスト → `'en'` を返す
- どちらにも該当しないテキスト → `'other'` を返す
- 空文字列 → `'other'` を返す

#### `looksLikeRetweet`
- `"RT @user ..."` で始まるテキスト → `true`
- `"... via @user"` を含むテキスト → `true`
- 通常の投稿 → `false`

#### `looksLikeReply`
- `"@user ..."` で始まるテキスト → `true`
- 途中に `@user` が現れるだけのテキスト → `false`
- 先頭に空白がある場合も正しく判定されること

#### `normalizeForDedup`
- URLが除去されること
- `@mention`, `#hashtag` が除去されること
- 大文字小文字が統一されること
- 連続空白が正規化されること

#### `truncate`
- `maxLength` 以下のテキストはそのまま返す
- `maxLength` を超えるテキストは切り詰めて `…` が付く
- デフォルト `maxLength` は 600

---

### date.ts

#### `getTargetDateRange`
- 指定タイムゾーン・日時から「前日」の日付文字列 (`day`) が正しく計算されること
- `startIso` が前日 00:00:00 のUTC相当ISO文字列であること
- `endIso` が前日 24:00:00（当日 00:00:00）のUTC相当ISO文字列であること
- タイムゾーン `Asia/Tokyo`（UTC+9）での検証
- 月末・年末をまたぐケース

#### `isWithinRange`
- `startIso` と同時刻 → `true`（境界値: 含む）
- `endIso` と同時刻 → `false`（境界値: 含まない）
- 範囲内の時刻 → `true`
- 範囲外の時刻 → `false`

---

### fs.ts

#### `ensureDir`
- 存在しないディレクトリが再帰的に作成されること
- 既存ディレクトリでもエラーにならないこと

#### `readState`
- 有効な JSON が存在する場合、State オブジェクトを返すこと
- ファイルが存在しない場合、空オブジェクト `{}` を返すこと
- 不正な JSON ファイルの場合、空オブジェクトを返すこと

#### `writeState`
- State が JSON としてファイルに書き込まれること
- ディレクトリが存在しなくても自動作成されること

#### `resolveVaultPath`
- vaultRoot / subdir / filename が正しく結合されること

---

### config.ts

#### `loadConfig`
- 全必須環境変数が揃っている場合、AppConfig オブジェクトを返すこと
- `TARGET_ACCOUNTS` がカンマ区切りで配列に変換されること
- `RSSHUB_BASE_URL` の末尾スラッシュが除去されること
- ブール値変換: `'true'`, `'1'`, `'yes'`, `'on'` → `true`、その他 → `false`
- `GEMINI_API_KEY` が空文字の場合、バリデーションエラーをスローすること
- `RSSHUB_BASE_URL` が URL 形式でない場合、バリデーションエラーをスローすること
- デフォルト値が正しく適用されること（`TIMEZONE`, `MODEL_TEXT` 等）

---

### pipeline.ts

#### `processPosts`
- RT パターンの投稿が `skipRetweets: true` のとき除外されること
- リプライパターンの投稿が `skipReplies: true` のとき除外されること
- 重複コンテンツの投稿が除外されること
- 英語投稿が `enableTranslation: true` のとき翻訳されること（GeminiClient モック）
- 日本語投稿は翻訳 API が呼ばれないこと
- 結果が `publishedAt` の昇順でソートされていること

#### `buildDigest`
- `enableDigest: false` のとき、Gemini を呼ばずにデフォルトオブジェクトを返すこと
- `enableDigest: true` のとき、GeminiClient.buildDigest が呼ばれること（モック）

---

### markdown.ts

#### `writeDigestMarkdown`
- 出力 Markdown に frontmatter（title, date, tags）が含まれること
- ハイライトが正しく Markdown 見出しで出力されること
- `thumbnailRelativePath` 指定時は `thumbnail` フィールドと画像埋め込みが含まれること
- 対象ファイルが正しいパスに作成されること

#### `writeRawMarkdown`
- 各投稿の account, link, publishedAt, language, content, translatedText が出力されること
- 対象ファイルが正しいパスに作成されること

---

### gemini.ts

#### `GeminiClient.translate`
- 正常なレスポンス → 翻訳テキストを返すこと
- API エラー（非200） → Error をスローすること
- 空コンテンツレスポンス → Error をスローすること
- タイムアウト → AbortError をスローすること（fetch モック）

#### `GeminiClient.buildDigest`
- 正常なJSON レスポンス → DailyDigest オブジェクトを返すこと
- 不正な JSON → JSON.parse エラーをスローすること

---

### thumbnail.ts

#### `maybeGenerateThumbnail`
- `enableThumbnail: false` → `undefined` を返し、spawn が呼ばれないこと
- `thumbnailCommand` が未設定 → `undefined` を返すこと
- `thumbnailCommand` が設定済みで spawn が exit code 0 → 相対パスを返すこと
- spawn が exit code 非0 → Error をスローすること

## Risks / Unknowns

- `config.ts` の `loadConfig` は `process.env` を直接参照するため、テスト間で `process.env` を確実にリセットする必要がある。Vitest の `beforeEach`/`afterEach` で管理する。
- `date.ts` のタイムゾーン変換は `Intl.DateTimeFormat` に依存するため、テスト実行環境の Node.js がタイムゾーンデータを持つことが前提。Node.js 20 では問題なし。
- `gemini.ts` の `buildDigest` は Gemini がレスポンス本文に余分なテキスト（Markdown コードフェンスなど）を含む場合 JSON.parse が失敗するが、現実装では対処していない。テストでは実装の現行挙動を仕様として扱い、テストを改変しない。
- カバレッジ 75% は `text.ts` / `date.ts` / `config.ts` / `fs.ts` の高カバレッジで達成見込み。`rss.ts` は今回スコープ外とする（ネットワーク依存のため）。
