# Cron 未実行時の調査ガイド

> 対象システム: VPS 上の RSS バッチ（毎日 8:00 JST / 23:00 UTC）  
> 作成日: 2026-04-05

## 前提：ログファイルの場所

| ログ | パス |
|------|------|
| RSS バッチ実行 | `/home/deploy/logs/claude-code-digest.log` |
| ヘルスチェック | `/home/deploy/logs/health-check.log` |
| バックアップ | `/home/deploy/logs/backup.log` |
| cron デーモン | `/var/log/syslog` または `journalctl -u cron` |

---

## Step 1: cron デーモンが動いていたか確認

```bash
# cron サービスの状態（Ubuntu）
sudo systemctl status cron

# 昨日 23:00 UTC 前後の cron ログを確認
sudo grep 'CRON\|cron' /var/log/syslog | grep '$(date -u -d "yesterday" +%b\ %d)' | grep '23:'

# journalctl を使う場合
sudo journalctl -u cron --since "yesterday 22:50" --until "yesterday 23:10"
```

**判断**: ここで `CMD` の行が出ていればジョブは**起動した**。出ていなければ cron 自体が止まっていた可能性が高い。

---

## Step 2: crontab にジョブが登録されているか確認

```bash
# deploy ユーザーの crontab を確認
sudo crontab -u deploy -l

# 期待する行（以下が含まれているか）
# 0 23 * * * cd /home/deploy/claude-code-rss && /usr/bin/npm run run >> /home/deploy/logs/claude-code-digest.log 2>&1
```

**判断**: 行がなければ `setup-cron.sh` が実行されていないか、上書きされた可能性。

---

## Step 3: バッチログを確認

```bash
# ログの末尾を確認
tail -100 /home/deploy/logs/claude-code-digest.log

# 今日（JST 8:00 = UTC 23:00）の前後の行を絞り込む
grep "$(date -u -d 'yesterday' +'%Y-%m-%d') 23:" /home/deploy/logs/claude-code-digest.log
grep "$(date -u -d 'yesterday' +'%Y-%m-%d') 22:" /home/deploy/logs/claude-code-digest.log
```

| ログの状態 | 意味 |
|-----------|------|
| ログに行がない | cron がジョブを**起動しなかった**（→ Step 1/2 を深掘り） |
| 開始行はあるが途中で切れている | プロセスが途中で**クラッシュ**（→ Step 4） |
| エラーメッセージがある | アプリ側の**実行時エラー**（→ Step 5） |
| 正常終了ログがある | バッチは動いたが出力先（Dropbox など）に問題（→ Step 6） |

---

## Step 4: プロセスのクラッシュ調査

バッチが途中で落ちた場合の原因を調べる。

```bash
# OOM Killer に殺されていないか
sudo dmesg | grep -i 'killed process\|out of memory' | tail -20
sudo journalctl -k | grep -i 'oom\|kill' | tail -20

# 昨夜のメモリ状況（ヘルスチェックログ）
grep "$(date -d 'yesterday' +'%Y-%m-%d')" /home/deploy/logs/health-check.log | grep -i 'memory\|disk'

# Node.js プロセス終了コードの手がかり（syslog）
sudo grep 'claude-code\|npm run run' /var/log/syslog | tail -30
```

---

## Step 5: アプリエラーの調査

バッチは起動したがエラーで失敗した場合。

```bash
# エラーレベルのログを抽出
grep -i '\[error\]\|\[fatal\]\|Error:\|ECONNREFUSED\|503\|429' /home/deploy/logs/claude-code-digest.log | tail -50

# RSSHub が動いていたか確認（ヘルスチェックログ）
grep "$(date -d 'yesterday' +'%Y-%m-%d') 22:\|$(date -d 'yesterday' +'%Y-%m-%d') 23:" \
  /home/deploy/logs/health-check.log

# RSSHub コンテナログで異常がないか（直近200行）
docker logs --tail 200 rsshub 2>&1 | grep -i 'error\|warn\|restart'
docker logs --tail 200 rsshub-redis 2>&1 | grep -i 'error\|warn'
```

---

## Step 6: 出力先（Dropbox）の問題調査

バッチが正常完了したように見えるが Obsidian に届いていない場合。

```bash
# バッチ終了時のログを確認
grep -E '\[info\].*(完了|success|upload|write)' /home/deploy/logs/claude-code-digest.log | tail -20

# Dropbox トークンが期限切れでないか
cat /home/deploy/claude-code-rss/.state/dropbox-tokens.json | python3 -m json.tool

# 環境変数が正しく読み込まれているか（.env ファイル確認）
grep 'DROPBOX_\|STORAGE_TYPE\|GEMINI_API_KEY' /home/deploy/claude-code-rss/.env | \
  sed 's/=.*/=***/'  # 値は隠して確認
```

---

## Step 7: Docker コンテナの状態確認

```bash
# コンテナが動いているか
docker ps

# 再起動ループに入っていないか
docker inspect rsshub --format '{{.RestartCount}}'
docker inspect rsshub-redis --format '{{.RestartCount}}'

# コンテナが落ちていた時刻を確認
docker inspect rsshub --format '{{.State.StartedAt}} {{.State.FinishedAt}}'
```

---

## Step 8: VPS システム全体の異常確認

```bash
# 昨夜の VPS 再起動がなかったか
last reboot | head -10

# ディスク容量（ログが溜まって枯渇していないか）
df -h

# システムログに異常がないか
sudo journalctl --since "yesterday 20:00" --until "today 03:00" -p err
```

---

## 調査結果の記録テンプレート

```
調査日時: 
対象実行予定: YYYY-MM-DD 08:00 JST (前日 23:00 UTC)

[ ] Step 1: cron デーモン稼働  → 稼働/停止
[ ] Step 2: crontab 登録あり  → あり/なし
[ ] Step 3: バッチログの有無  → あり/なし/途中終了
[ ] Step 4: OOM/クラッシュ   → あり/なし
[ ] Step 5: アプリエラー     → あり（内容:）/なし
[ ] Step 6: Dropbox 問題     → あり/なし
[ ] Step 7: Docker 状態      → 正常/異常
[ ] Step 8: VPS 再起動       → あり/なし

根本原因:
対処:
```

---

## よくあるパターンと対処

| 症状 | 原因 | 対処 |
|------|------|------|
| cron ログに `CMD` なし | cron サービス停止または crontab 未登録 | `sudo systemctl start cron` / `setup-cron.sh` 再実行 |
| `ECONNREFUSED` エラー | RSSHub コンテナが停止 | `npm run rsshub:up` |
| `503` エラー | RSSHub の Twitter Cookie 期限切れ | Cookie を更新して `.env` 再設定・再起動 |
| OOM で kill | メモリ不足 | Docker コンテナのメモリ制限を見直し、不要プロセスを削除 |
| Dropbox 認証エラー | リフレッシュトークン失効 | Dropbox 再認証・`.env` 更新 |
| VPS 再起動後に cron が空 | deploy ユーザーの crontab が消えた | `setup-cron.sh` 再実行 |
