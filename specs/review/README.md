# specs/review/ — 5リポジトリ再検証（2026-09-22）

このディレクトリは、以下 5 リポジトリの現状クローンを直接調査し、本 repo の
`docs/cross-repo-adoption-review.md`（正本、2026-09-06 検証・2026-09-21 追記）が
既に主張している内容を**再実測**した結果の置き場所である。

- `fastapi-pydantic-ai-agent`
- `pydantic-ai-sandbox`
- `agentic-ai-sandbox`
- `agentic-ai-bootcamp`
- `beeai-agentic-ai-sandbox`

## 位置づけ

正本は「追記のみ・過去の結果は書き換えない」規約の文書であり、
本ディレクトリの内容をそちらへ直接書き戻すことはしない（正本の時点記録を保全するため）。
本ディレクトリは**独立した再検証記録**であり、正本の記述のうち何が今も正しく、何が
陳腐化したかを示す。正本を更新する場合の材料として使うことを想定している。

## 読む順序

1. [`2026-09-22-cross-repo-verification.md`](2026-09-22-cross-repo-verification.md) — 本体。
   5 repo それぞれの現状・正本記述との差分・新規発見・本 repo への示唆をまとめる。

## 検証方法

各 repo をローカルにクローンし（`fastapi-pydantic-ai-agent` / `pydantic-ai-sandbox` /
`agentic-ai-sandbox` は読み取り専用の匿名クローン、`agentic-ai-bootcamp` /
`beeai-agentic-ai-sandbox` はセッションに attach 済み）、`grep` によるワークフロー
SHA 固定率・`permissions:` 宣言数の実測、主要ファイルの存在・行数確認、README/CLAUDE.md/
AGENTS.md/docs の通読によるサンプリングを行った。検証日はすべて **2026-09-22**。
