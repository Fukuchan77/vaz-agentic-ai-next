# 006-repo-consolidation — Act（申し送り・学び）

日付: 2026-09-21。

## Outcome

- **統合ハブへの昇格を完了**: `vaz-ai-next` を `vaz-agentic-ai-next` へリネームし（Task 2）、
  同名を先に占めていた旧 `vaz-agentic-ai-next`（統合計画が「空」と誤認していたリポジトリ）は
  `-archive` へリネームして名前を空けた上で、非 main 6 ブランチ・約 5,400 行
  （正本レビュー・53 要件の承認済み P0 spec・11 原則の憲章・その前身資料）を退避した（Task 1）。
  削除ではなく可逆な archive リネームを選んだことで、事前調査の誤認が実害に至らずに済んだ。
- **欠損していた正本を実体化**: `docs/cross-repo-adoption-review.md`（3 repo・7 参照が
  dangling だった正本）を verbatim 設置。リネームを先に行ったことで、dangling 参照 7 件は
  **編集ゼロ**で解決した（Task 3）。
- **憲章・継承 spec・ADR-0003 を受け入れ**: `specs/memory/constitution.md`（11 原則）を
  verbatim 配置し、継承 spec（53 要件）を `specs/inherited/` へ隔離。組み立て機構のみを
  ADR-0003 で supersede し、要件は活かした（Task 4）。
- **ガイド背骨を構築**: `docs/guide/` に 8 手法（PE/CE/LE/HE/AE/AO/MCP/EV）の学習パスを、
  リンクのみで本文非複製の設計で構築（Task 5）。
- **第 2 Python レーンを統合**: `fastapi-pydantic-ai-agent`（43,592 LOC）を
  `git subtree add --squash` で `services/api` へ導入。root-only ツール
  （`.github/`/`.pre-commit-config.yaml`/`.githooks/`/`mise.toml`）をハブのルートへ
  再配置し、model-ID ゲートを代入形検出へ精密化。TS 652 / Python 1462 のテストが green（Task 6）。
- **パターンカタログは移設せず、リンクによる正本designationで裁定**: 書籍原稿とコードの
  一体性を守るため、Task 6（本番アプリ）とは異なる判断を採用（Task 7）。
- **ADR-0004 を起票**: TS 4 値・Python 5 値の停止理由語彙を統一せず、写像表と非統一の根拠を
  記録（Task 8、本ファイル）。

全 8 Task が完了し、Phase 0〜5 すべてが着地した。

## 統合計画からの主要な乖離（次セッションへの教訓）

| # | 統合計画の想定 | 実際 | 教訓 |
|---|---|---|---|
| 1 | `vaz-agentic-ai-next` は空リポジトリ | 非 main 6 ブランチに約 5,400 行（うち 4 本は互いに独立した固有内容） | **「空」という前提は `main` ブランチしか見ていない可能性がある。`git ls-remote --heads` で全ブランチを確認してから「空」と判断する** |
| 2 | dangling 参照の張り替えが Phase 0 の作業 | リネームを先にすれば編集ゼロで解決 | **複数の文字列参照が同じ未来の名前を指している場合、参照側を編集するより先に「その名前になる」操作（リネーム）を先行させられないか検討する** |
| 3 | 正本レビューの `vaz-ai-next` 列（SHA 固定 0/22）は最新の状態 | 実測で 28/28（X-1 着地済み） | **相互参照する review/backlog 文書は正確でも時点の記録。判断材料にする前に必ず実測で再検証する**（正本レビュー自身の教訓を、正本レビューを使う側にも適用する） |
| 4 | `test_ci_workflows.py` に非空アサートを追加して移送（Task 6 R6.6 の当初案） | ハブの既存 TS ガードが既に汎用的にカバーしており、移送元の個別テストは削除の方が正しかった | **「移送」を検討する前に、移送先に既に同じ役割を果たす仕組みがないか確認する。既存の単一経路に合流させる方が、2 つの類似したガードを維持するより保守コストが低い** |
| 5 | Task 7 で教材コードを `patterns/` へ「絞り込み取り込み」（統合計画 §7 原文） | 書籍原稿との一体性を守るため物理移設をしない決定に変更 | **「取り込み」の実質は移動である必要はない。リンクによる正本designationでも「取捨選択」の目的（読者が正しい方を見つけられる）は達成できる — 移動コストとその損失（ここでは章と実装の分裂）を比較してから決める** |

## Learnings → Rules Mapping

| Learning | Candidate rule / steering update |
|---|---|
| GitHub のリネームは「旧名 → 新名」の片方向リダイレクトを作る。リネーム完了直後に同じセッションで旧名・新名の両方を URL として使うと、まだ誰も名乗っていない新名が別リポジトリの旧名リダイレクトに横取りされることがある（Task 1 で実際に発生、実害ゼロで回収） | **複数リポジトリを同一セッションでリネームする場合、リネーム直後は必ず `git ls-remote origin HEAD` で実際の SHA を確認してから作業を続ける**。信用する前に検証する、を徹底する |
| `git subtree add --squash` はコミット履歴を 1 コミットに圧縮するため、コミット SHA に基づく仕組み（gitleaks の指紋など）は移設と同時に無効化される | **他リポジトリを subtree でインポートする際は、インポート元がコミット SHA に依存する仕組み（セキュリティスキャンの指紋、CI のコミット参照）を持っていないか事前に確認し、無効化される場合は申し送りとして明記する** |
| 「本 spec の verbatim 要件」は正本レビューと憲章にのみ課したが、継承した個別ファイル（`spec.json` や `evals/golden/*.json`）は house のフォーマット規約（tabs）と衝突した。verbatim の範囲を早期に明確化しておかないと、都度その場で判断することになる | **他リポジトリのファイルを持ち込む spec では、「どのファイルが verbatim（本文改変禁止）で、どのファイルは house フォーマットへの追従が許容されるか」を Requirements の時点で明示する** |
| Task 4/6 で 2 回、biome の tab インデント規約と持ち込んだ JSON ファイルの 2-space インデントが衝突した。いずれも `biome --write` の後に `JSON.parse` による意味的完全一致を確認して安全性を担保した | **フォーマッタの自動修正を適用する際、対象が「他所から持ち込んだデータファイル」の場合は、必ず持ち込み前後で意味的（パース後）に同一であることを確認してから採用する** |
| 大規模なコード移設（Task 6）では、移設先で構造衝突する既存テスト・設定ファイルが複数見つかる。個別に「削除するか」「移動先を修正して活かすか」を判断する必要があり、機械的に全部移送しようとすると壊れたテストが混入する | **リポジトリ全体の subtree/squash インポートの後は、必ずインポート先で実際にテストスイートを実行し、失敗したものだけを個別に精査する**（推測で「壊れそうなファイル」を事前列挙しようとするより、実行して失敗を拾う方が漏れが少ない） |

## Next Actions（申し送り）

1. **R9.3: `beeai-agentic-ai-sandbox` への取り込みは本 spec の境界外**。正本レビュー §5 が
   同 repo に対して「X-4（最優先）」ほかを求めているが、本セッションには同 repo がアタッチ
   されておらず検証できていない。次にこのリポジトリへの取り込みを検討する spec は、
   `docs/cross-repo-adoption-review.md` の X-1・X-2・X-3・X-8・X-14・X-15（同 repo の取り込み主軸、
   §5 の表）を出発点にする。
2. **R9.4: 旧リポジトリのアーカイブ判断**。Phase 2（Task 6）・Phase 3（Task 7）はいずれも着地
   したため、`fastapi-pydantic-ai-agent` / `pydantic-ai-sandbox` / `pydantic-ai-agentic-patterns`
   のアーカイブ可否を判断してよい前提条件は揃った。ただし**この spec はアーカイブを実行しない**
   （ユーザ判断を要する不可逆操作であり、本 spec のどの Requirement もアーカイブを必須として
   いない）。判断材料:
   - `fastapi-pydantic-ai-agent`: `services/api` として実体をハブへ import 済み（Task 6）。
     ただし `.gitleaksignore`・pre-commit フック・pre-push フックが未配線という既知ギャップ
     （Task 6 記録）があるため、**それらの配線が終わるまではアーカイブしない方が安全**
     （アーカイブ後は元リポジトリでの `gitleaks` 再スキャン baseline 取得が困難になる）。
   - `pydantic-ai-sandbox`: 8 レーン独立 uv 構成・6 パターンの比較実装は意図的に upstream 維持
     と決定（Task 7、R7.1）。**アーカイブしない**— 統合計画・本 spec のどちらも同 repo を
     独立に保つことを前提としている。
   - `pydantic-ai-agentic-patterns`: 書籍原稿との一体性を理由に教材コードを移設していない
     （Task 7）。**アーカイブしない** — 独立して存在し続けることが Task 7 の決定そのものの前提。
   - 結論: 3 repo とも**現時点でアーカイブしない**。`fastapi-pydantic-ai-agent` のみ、
     Task 6 の既知ギャップ（gitleaks/pre-commit/pre-push の配線）が解消され次第、
     再検討の余地がある。
3. **R8.1/R8.2（Agent Skills / A2A）は未採用のまま**。統合計画 §5.2 が「調査した 4 repo
   すべてで 0 件」と記録した真のギャップだが、本 spec のどの Requirement も採用を必須として
   いない（両方とも `[O] WHERE ... 採用する場合`）。採用を検討する次のセッションは、
   ADR-0001（MCP）の型（採用トリガ条件つき非採用の記録）に倣うこと。
4. **R8.5（`I-H10` の教材側への移植）は未実施**。`docs/guide/agentic-engineering.md` に
   移植機会として記録済み（正本は `services/api/app/agents/guardrails.py` の `StopReason`
   ＋ 副作用前トークン予算）。実施する場合は `pydantic-ai-agentic-patterns` 側のタスクとして
   別セッションで起票する（本ハブから他リポジトリへの直接コミットは、本 spec では
   R9.2（1 行の注記）のみに限定してきた）。
5. **Task 6 の既知ギャップ 2 件を優先度高く申し送る**: (a) `services/api` の pre-commit/pre-push
   フック未配線、(b) `.gitleaksignore` の 365 件の指紋が squash import により無効化されている
   （gitleaks 自体が未配線のため実害は無いが、配線時には再スキャンが必要）。
6. **`docs/cross-repo-adoption-backlog.md`（ハブ自身のもの）は本 spec で更新していない**。
   X-1（SHA 固定）着地・本統合そのものの完了を反映する追記が今後の spec で必要になる
   可能性がある。
