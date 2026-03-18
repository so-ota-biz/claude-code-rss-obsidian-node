# Design

## Ticket

https://github.com/so-ota-biz/ai-agent-orchestration-settings/issues/33

## Background

- 現在のシステムは RSSHub + Redis + Node.js バッチ処理で構成されており、ローカル環境で運用されている
- VPS 移行により、24時間稼働が可能な環境でより安定した運用を実現したい
- Amazon Lightsail を第一候補として検討しているが、他の選択肢も評価が必要
- 移行には Docker Compose ベースの現在の構成を維持しつつ、VPS での運用に最適化した構成を検討する

## Scope

- VPS ホスティング選択肢の調査と推奨案の提示（Amazon Lightsail を含む）
- 各選択肢の月額コスト見積もりと機能比較
- 現在のシステム（RSSHub + Redis + Node.js バッチ）のVPS移行手順
- Docker Compose を使った VPS デプロイメント方法の詳細化
- VPS 環境での運用監視とメンテナンス手順
- データバックアップとリストア手順
- セキュリティ設定の推奨事項

## Design Decisions

### VPS 選択基準
- 月額コスト効率性（予算への適合性）
- CPU・メモリ・ストレージの十分性（Docker コンテナ 2-3 個分）
- ネットワーク帯域幅（RSS データ取得・API 呼び出しに十分）
- 運用の簡単さ（管理画面の使いやすさ、SSH アクセス）
- 可用性・サポート体制

### システム構成維持方針
- 現在の Docker Compose 構成を VPS でそのまま利用
- データ永続化（Redis データ、ログファイル、状態ファイル）を適切に設定
- 環境変数の管理方法（.env ファイルのセキュアな配置）
- cron ジョブによるバッチ処理の自動実行設定

### 移行方式
- Blue-Green 方式での段階的移行
  1. VPS 環境構築・テスト
  2. ローカル環境と並行運用期間
  3. 完全移行

## Risks

- VPS のスペック不足による動作パフォーマンス低下
- Docker Compose の VPS 環境での動作差異
- ネットワーク帯域制限による RSS フィード取得失敗
- Gemini API アクセスの地理的制限やレイテンシ増加
- データ移行中のデータ損失リスク
- VPS プロバイダーのサービス障害時の対応
- セキュリティ設定不備による不正アクセス
- 月額コストの予算超過リスク