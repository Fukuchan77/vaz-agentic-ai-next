# ADR-0008: HITL を含むエージェント UI 部品の標準を shadcn/ui + Tailwind CSS にする

- **Status**: 移行完了（2026-10-05）
- **Date**: 2026-10-03
- **Migration completed**: 2026-10-05（spec 009 §4 完了。Carbon 全撤去・Tailwind preflight 有効化・CSS 上限 4.0 kB 更新）
- **仕様根拠**: [`specs/008-hub-consolidation-followup/spec.md`](../../specs/008-hub-consolidation-followup/spec.md) R6

散文は日本語、識別子・型・パス・コードは英語（`spec.json` `language: ja`）。

## Context

Agentic AI 系の TypeScript リポジトリ 3 つが、それぞれ別の UI 方式を採っている（2026-10-03 実測）。

| リポジトリ | UI 方式 | HITL 関連 UI |
|---|---|---|
| `vaz-agentic-ai-next`（本ハブ） | Carbon Design System（`@carbon/react`、部品ごとの SCSS） | `apps/web/src/features/jobs/ApprovalPanel` |
| `next-agentic-stack` | CSS Modules | なし |
| `from-genai-to-agentic-ai` | shadcn/ui + Tailwind CSS v4（`apps/web`） | 計画中（カリキュラム M1 以降） |

「Human-in-the-Loop 承認 UI」「思考プロセスの可視化」「ツール実行承認」を部品として共有するには、
方式を 1 つに決める必要がある。

## Decision

**エージェント UI 部品（HITL 承認・ストリーミング表示・ツール実行表示）の標準は
shadcn/ui + Tailwind CSS とする。**

- **ユーザ判断（2026-10-03）**: Carbon は最新版の React / Next.js と不整合を起こしやすい。
  ハブ自体が「Carbon を丸ごと import しない」「Carbon を使う部品は必ず `"use client"`」
  「部品ごとに SCSS を `global.scss` へ追加」という回避規約を抱えている。
- shadcn/ui は部品のソースをリポジトリへコピーする方式なので、上流のメジャー更新に
  引きずられない。React 19 / Next.js canary / TypeScript 7 を先行検証している
  `next-agentic-stack` や `from-genai-to-agentic-ai` とも同じ部品を共有しやすい。
- `from-genai-to-agentic-ai` が既に Tailwind v4 のテーマトークン（コントラスト検査つき）を
  持っている。そのトークン設計を参照元にできる。

## Consequences

- **すべての UI 部品は shadcn/ui + Tailwind で書く。** Carbon は spec 009 §4 で完全撤去済み。
  `@carbon/react`・`@carbon/styles`・SCSS を `apps/web` に追加しない。
- spec 009 で実施した移行の内容:
  - §1: Tailwind v4 と shadcn/ui を `apps/web` へ導入（preflight なし・Carbon 共存）
  - §2: `ApprovalPanel` を `ApprovalCard`（shadcn/ui）へ移行
  - §3: chat 画面（`Chat`・`ChatComposer`・`MessageItem`）を shadcn/ui + Tailwind へ移行
  - §4: Carbon 全撤去・Tailwind preflight 有効化・`.size-limit.json` CSS 上限を 4.0 kB へ引き下げ・`CLAUDE.md`/`AGENTS.md` 更新

## Re-trigger Conditions

1. shadcn/ui または Tailwind が、Next.js / React の新メジャーへの追従を 2 か月以上止めたとき。
2. 社内のデザインシステム標準が別途定められたとき。
