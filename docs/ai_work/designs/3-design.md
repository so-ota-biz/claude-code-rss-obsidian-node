# Design

## Ticket

GitHub Issue #3 - 適切な単体テストを設計・実装する
https://github.com/so-ota-biz/claude-code-rss-obsidian-node/issues/3

## Background

本アプリケーションは RSSHub 経由で X（旧Twitter）アカウントの投稿を収集し、Gemini API で翻訳・日次ダイジェスト化して Obsidian Vault に Markdown を保存する Node.js バッチです。

現状、テストコードが一切存在しない。Issue の要件は以下の通り：

- 仕様を理解・文書化する
- 単体テストを実装する
- カバレッジ 75% 以上を達成する
- 全テストを通過させる

## Scope

### テスト対象モジュール（優先度順）

| モジュール | 内容 | 外部依存 | 優先度 |
|---|---|---|---|
| `src/lib/text.ts` | HTML除去・言語判定・RT/Reply判定・正規化・truncate | なし | 高 |
| `src/lib/date.ts` | 日付範囲計算・範囲内判定 | なし（Node組込みのみ） | 高 |
| `src/lib/fs.ts` | ディレクトリ作成・state読み書き・パス解決 | node:fs/promises | 高 |
| `src/lib/config.ts` | 環境変数バリデーション・AppConfig生成 | dotenv / zod | 高 |
| `src/lib/pipeline.ts` | 投稿フィルタ・翻訳・ダイジェスト構築 | GeminiClient（モック必要） | 中 |
| `src/lib/markdown.ts` | Markdownファイル書き出し | node:fs/promises | 中 |
| `src/lib/gemini.ts` | Gemini API クライアント | fetch（モック必要） | 中 |
| `src/lib/thumbnail.ts` | サムネイル生成コマンド実行 | node:child_process spawn（モック必要） | 低 |
| `src/lib/rss.ts` | RSS フィード取得・パース | rss-parser / ネットワーク（モック必要） | 低 |

### テスト対象外

- `src/index.ts`（統合エントリポイント、E2E 的性質）
- 外部サービス（Gemini API 実呼び出し、RSSHub 実呼び出し）

## Design Decisions

### 1. テストフレームワーク: Vitest

- ESM ネイティブで `"type": "module"` のプロジェクトと相性が良い
- TypeScript を追加設定なしに実行できる
- `vi.spyOn` / `vi.fn` / `vi.mock` で Node 組込み・fetch・child_process のモックが容易
- カバレッジは `@vitest/coverage-v8` で計測（Istanbul より軽量）

### 2. テストファイル配置: `src/lib/__tests__/`

既存の `src/lib/` 直下に `__tests__/` ディレクトリを作成し、対象ファイルと1:1で配置する。

```
src/lib/__tests__/
  text.test.ts
  date.test.ts
  fs.test.ts
  config.test.ts
  pipeline.test.ts
  markdown.test.ts
  gemini.test.ts
  thumbnail.test.ts
```

### 3. fs 操作のテスト方針

- `node:fs/promises` の `mkdir` / `readFile` / `writeFile` を `vi.mock` でモック化する
- もしくは `tmp` ディレクトリ（`os.tmpdir()`）を使用して実ファイル操作を行い、teardown で削除する
- `fs.ts` と `markdown.ts` は一時ディレクトリ方式で実ファイル操作をテストする（モック不要・実際の挙動を検証）

### 4. fetch モック（GeminiClient）

- Vitest の `vi.stubGlobal('fetch', vi.fn())` で global fetch をモックする
- 正常系・異常系（非200レスポンス・空コンテンツ・タイムアウト）をカバーする

### 5. child_process モック（thumbnail）

- `vi.mock('node:child_process', ...)` で `spawn` をモックする

### 6. config.ts のテスト方針

- `process.env` を各テスト前に直接設定し、テスト後に復元する
- 必須キーの欠落・型不正のバリデーションエラーケースを含む

### 7. カバレッジ目標

- 全体で行カバレッジ 75% 以上
- `text.ts` / `date.ts` は 90% 以上を目標

## Risks

- `config.ts` の `loadConfig()` は `process.env` をグローバルに変更するため、テスト間の隔離に注意が必要
- `gemini.ts` の `buildDigest` は JSON パースを含むため、不正な JSON レスポンスのエラーケースが複雑になる可能性がある
- Vitest は devDependency として追加する必要があり、`package.json` の変更が伴う
