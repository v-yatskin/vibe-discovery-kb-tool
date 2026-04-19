# AI-Assisted Product Discovery Knowledge Hub

**PRD + Execution Plan**

---

# 1. Overview

## Objective

Build a **local-first, AI-assisted knowledge system** for a product discovery team (PM, Designer, BA/Low-code) that:

* Captures raw thinking naturally (via chat)
* Converts it into structured knowledge
* Stores it in a clean, scalable format
* Enables AI-powered retrieval, synthesis, and roadmap generation

---

## Core Idea

Instead of editing shared documents:

```text
Chat → Draft → Human Edit → Publish (commit) → Canonical Knowledge → AI Retrieval
```

This eliminates:

* merge conflicts
* messy notes
* lost insights
* inconsistent thinking

---

# 2. Problems to Solve

## 2.1 Collaboration Problems

* Multiple people editing same notes → conflicts
* No ownership of knowledge
* Overwrites and sync issues (e.g., OneDrive)

## 2.2 Knowledge Problems

* Insights scattered across tools
* No consistent structure
* Hard to reuse past learnings
* Decisions lose context over time

## 2.3 AI Problems

* Prompts are inconsistent
* AI outputs are not reusable
* No shared memory for AI

## 2.4 Product Discovery Problems

* Hard to connect:

  * problems → insights → decisions → roadmap
* Roadmaps become static and outdated
* PM work is manual and repetitive

---

# 3. Product Vision

A system where:

* Team members **talk to AI naturally**
* AI creates structured drafts
* Humans refine thinking
* AI formalizes knowledge via a “commit step”
* Knowledge becomes queryable and composable
* Roadmaps are generated dynamically

---

# 4. System Architecture

## 4.1 Layers

### 1. Input Layer (Human + AI Chat)

* Conversational interface (Claude/Codex)
* Produces structured drafts

### 2. Processing Layer (Publish Command)

* AI transforms drafts → canonical knowledge
* Human reviews (PR-style)

### 3. Storage Layer (Obsidian Vault)

* Markdown-based
* Structured, append-only

### 4. Retrieval Layer (RAG-lite initially)

* File search + AI synthesis
* Later: embeddings

---

# 5. Vault Structure

```
/00_Drafts           ← gitignored (personal workspace)
/01_Problems
/02_Insights
/03_Experiments
/04_Decisions
/05_Initiatives
/06_Features
/07_Meeting-Notes
/08_Integrations
/09_Templates
/10_Ceremonies
/11_Data             ← Phase 8: data snapshots (CSV + metadata.md) — tracked
/_files              ← Phase 8: OneDrive-synced binaries (PDFs, decks, images) — gitignored
/_private            ← Phase 8: personal additions (stakeholder emails, scratch) — folder tracked, contents gitignored
/archive             ← gitignored
/Bases               ← Phase 7: live filtered Obsidian views (.base files at vault root for file-tree visibility)
/.claude
   /commands         ← committed team slash commands
   /agents           ← Phase 8: committed team subagents
   /agents.private   ← Phase 8: gitignored personal subagents
```

See [phase-2-plan.md](phase-2-plan.md) for the rationale behind Phase 7/8 additions.

---

# 6. Data Model

## 6.1 Draft Format

```yaml
type: problem | insight | experiment | idea
title: ""
context: ""
content: ""
confidence: low | medium | high
tags: []
```

---

## 6.2 Canonical Entities

### Problem

* clearly defined user/business issue

### Insight

* validated learning

### Experiment

* hypothesis + result

### Decision

* explicit choice + reasoning

### Initiative (roadmap unit)

```yaml
type: initiative
title: ""
status: idea | planned | in_progress | done
priority: low | medium | high
linked_problems: []
linked_insights: []
```

---

# 7. Core Commands (CLI)

## 7.1 `kb draft` ✅

**Purpose:** Create a draft file from template — capture only, no git

Flow:
* `kb draft --type [type] --title "[title]"` creates `00_Drafts/YYYY-MM-DD-[slug].md`
* Claude fills in the frontmatter and content via conversation
* File stays local and gitignored — no branch, no commit
* User reviews/edits in Obsidian, then says "publish" when ready

---

## 7.2 `kb publish` ✅

**Purpose:** Validate and commit a draft to the active session branch (local only)

Flow:

1. Load draft from `00_Drafts/`
2. Validate frontmatter schema (required fields, valid enum values)
3. Prompt: `[a]ccept / [s]kip`
4. On accept: move file to canonical folder, archive draft, `git commit` (local)
5. No push — commits stay local until `kb branch --close`

---

## 7.3 `kb branch` ✅

**Purpose:** Manage session branches and the publish lifecycle

```
kb branch --open [topic]   → git checkout -b kb/[date]-[topic]  (local only)
kb branch --close          → push + gh pr create + gh pr merge + git pull
kb branch --status         → show active session info
```

The user never runs git. Claude manages the branch lifecycle.

---

## 7.4 `kb list` / `kb status` / `kb search` ✅

**Purpose:** Query the vault

* `kb list [type] [--status X]` — colored table of entities by type and status
* `kb status` — vault health dashboard (counts, git state, pending drafts)
* `kb search "[query]"` — keyword search via fuse.js (semantic search planned)

---

## 7.5 `kb init` (planned)

**Purpose:** First-time setup — creates vault structure, .gitignore, templates, CLAUDE.md, post-merge hook

* Set vault path + author name
* No API key, no AI provider setup
* `kb init --upgrade` retrofits existing vaults with Phase 7/8 additions (bases, new folders, wikilinks sections, agents dir)

---

## 7.6 Phase 2 commands (planned — see [phase-2-plan.md](phase-2-plan.md))

### Obsidian integration (Phase 7)

* `kb base --list` — list the vault's `Bases/*.base` files (live filtered Obsidian views)
* `kb search --base [name]` / `kb search --in [folder]` — scope search to a base or folder
* `/graph [entity]` — text summary of the link graph around an entity

### Extended structure (Phase 8)

* `kb snapshot --title "[name]"` — creates `11_Data/YYYY-MM-DD-[slug]/` with metadata template
* `/snapshot` — guided slash command
* `_files/` (OneDrive-synced, gitignored) and `_private/` (folder tracked, contents gitignored) created by `kb init`
* `kb publish` refuses any path under `_private/` (hard error)

### Update & curation (Phase 9)

* `kb edit [path]` — copies canonical to `00_Drafts/` for editing; `kb publish` detects edit-drafts and commits in place with a diff
* `kb link [src] [target]` — updates frontmatter + regenerates wikilinks section
* `kb link --suggest [file]` — invokes `link-finder` subagent to propose candidate links
* `kb retire [path] --reason "..."` — archive with reason, warn on inbound links
* Subagents (`.claude/agents/`): `kb-reviewer` (pre-publish critique — advisory, doesn't block), `link-finder` (suggests links), `vault-curator` (weekly sweep)
* Slash commands: `/edit`, `/link`, `/curate`
* Git-conflict guardrail: `kb` never auto-resolves; prints conflicted paths, halts, user resolves manually

---

# 7a. Obsidian Integration (Phase 7)

The vault is rendered in Obsidian, but today we use almost none of Obsidian's features. Phase 7 changes that, with one central shift:

**Bases are the team's main list UI.** `.base` files (Obsidian 1.9+) define saved filters + live table/card views. The team clicks a base in the Obsidian sidebar and gets an up-to-the-second filtered view — no chat, no CLI. `kb list` still exists as an internal tool, but Claude no longer dumps its output for teammates; it points at the relevant base instead.

`kb init` seeds 7 starter bases:

| Base | What it shows |
|---|---|
| `open-problems` | All problems with status = open |
| `active-initiatives` | Initiatives planned or in progress |
| `high-confidence-insights` | Insights with confidence = high |
| `my-drafts` | Pending drafts in `00_Drafts/` |
| `recent-decisions` | Last 20 decisions by date |
| `orphan-insights` | Insights with no linked problems (curation) |
| `stale-initiatives` | In-progress initiatives not updated in 30+ days |

**Wikilinks:** every `kb publish` auto-generates a `## Links` section from frontmatter (`linked_problems`, `linked_insights`, etc.) using `[[wikilink]]` syntax. Obsidian's backlink graph comes alive — every entity sees who links to it.

**Search filtering:** `kb search "zapier" --base active-initiatives` applies the base's filter before ranking.

**Claude references bases in answers:** instead of dumping a `kb list` table in chat, Claude says "see the `open-problems` base in Obsidian for a live view — top 3 by severity are …". Keeps chat terse, leverages the UI.

---

# 8. AI Usage Model

## 8.1 AI Roles

### Draft Assistant

* helps articulate ideas
* structures initial thinking

### Structuring Engine

* enforces schema
* improves clarity
* links knowledge

### Retrieval Engine

* answers questions
* synthesizes knowledge

### Roadmap Generator

* connects insights to initiatives

---

## 8.2 Constraints

* AI never edits canonical files directly without review
* AI outputs must be structured
* AI must rely on vault context (not hallucinate)

---

# 9. RAG Strategy

## Phase 1 (MVP)

* keyword search
* metadata filtering
* pass relevant notes to AI

## Phase 2 (optional)

* embeddings
* vector search
* hybrid retrieval

---

# 10. Workflow

## Two-phase model

### Phase 1 — Capture (no git)

1. Tell Claude what to capture (problem, insight, feature, etc.)
2. Claude runs `kb draft`, fills in the frontmatter via conversation
3. Edit in Obsidian, refine thinking
4. Say "publish" when happy with the draft(s)

### Phase 2 — Publish (triggered by user)

1. Claude runs `kb branch --open [topic]` — local branch
2. Claude runs `kb publish [filename]` for each draft — local commits
3. Claude runs `kb branch --close` — push + PR + merge + pull
4. Teammates see the work on their next `git pull`

## PM

* Query vault: talk naturally to Claude → Claude runs `kb search` + `kb list`
* Generate roadmap: `/roadmap` slash command
* Create initiatives: Claude drafts + structures via the two-phase flow

---

# 11. Distribution Strategy

## Packaging

* CLI tool (`kb`) — TypeScript/Node.js, compiled to CJS
* Shell installer → global `kb` command via npm

## Setup

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/kb-tool/main/scripts/install.sh | bash
kb init
```

## Requirements

* Node.js 20+
* `gh` CLI (authenticated) — required for branch + PR flow
* No API key — uses Claude Code subscription

---

## Design Goals

* zero manual setup
* works in <10 minutes
* no API keys, no per-token cost

---

# 12. Key Design Decisions

## 12.1 No Shared Editing

* prevents conflicts
* ensures clarity

## 12.2 Append-Only Knowledge

* preserves history
* improves traceability

## 12.3 Draft → Publish Pipeline

* separates thinking from storage
* improves quality

## 12.4 AI as Interface

* not free-form usage
* guided workflows only

---

# 13. Risks & Mitigations

## Risk: Low Adoption

* mitigate with:

  * simple commands
  * natural chat flow

## Risk: Poor Draft Quality

* mitigate with:

  * AI-guided drafting
  * enforced template

## Risk: Knowledge Drift

* mitigate with:

  * publish step
  * no direct editing

## Risk: Overengineering

* mitigate with:

  * MVP first (no embeddings)

---

# 14. Build Status

## ✅ Done (PoC complete)

* `kb draft`, `kb publish`, `kb list`, `kb status`, `kb search` (keyword)
* `kb branch --open / --close / --status` (full two-phase git flow)
* Sample vault (TaskFlow team) with realistic data
* `.claude/CLAUDE.md` + slash commands: `/draft`, `/publish`, `/resume`, `/compress`, `/gap-analysis`
* Remote vault on GitHub: https://github.com/v-yatskin/vibe-disco-vault-test.git

## Next to build (v1 — team rollout)

* `kb init` — vault creation from scratch
* `kb updates --generate` — post-pull change digest
* `kb index` + semantic search (local embeddings via `@xenova/transformers`)
* Remaining slash commands: `/roadmap`, `/updates`, `/preserve`, `/engineer-critique`, `/spec-writer`
* Install script ✅ + user-facing READMEs ✅

## v2 — enrichment pass (see [phase-2-plan.md](phase-2-plan.md))

* **Phase 7 (Obsidian integration):** bases as primary team list UI, wikilink auto-generation on publish, seeded `.base` files, `kb search --base`, `/graph` command
* **Phase 8 (extended structure):** `11_Data/` (snapshots, tracked), `_files/` (OneDrive-synced, gitignored), `_private/` (folder tracked, contents gitignored), `.claude/agents/` + `agents.private/`, `kb snapshot`
* **Phase 9 (update & curation):** `kb edit` (edit-in-drafts), `kb link`, `kb retire`, subagents (`kb-reviewer`, `link-finder`, `vault-curator`), slash commands (`/edit`, `/link`, `/curate`), git-conflict manual-resolve guardrail

## Later

* Compiled binary (no Node required)
* Homebrew formula
* Local web dashboard (`kb ui`)

---

# 15. Execution Plan

See `execution-plan.md` for full phase breakdown with time estimates.

**Remaining effort:**
- v1 (Phases 1–5): ~13h / ~2–3 sessions
- v2 (Phases 7–9): ~10h / ~2 sessions
- **Total: ~23h / ~5 sessions**

Ship v1 first, run it for 2–3 weeks with the team, then inform v2 priorities with real usage signal.

---

# 16. Success Criteria

* Team uses system daily
* Draft → publish flow becomes habit
* Questions answered via `kb ask`
* Roadmap generated from knowledge (not manual docs)

---

# 17. Final Vision

A system where:

* knowledge is never lost
* AI is grounded in real data
* product decisions are traceable
* roadmap emerges from evidence

---

**This is not a note-taking tool.
This is a product discovery operating system.**
