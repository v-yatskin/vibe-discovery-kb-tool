# kb-tool — Architecture

> **Who this is for:** A PM building solo with AI coding assistants for a 3-person product discovery team (PM, Designer, BA).
> **Stack:** TypeScript / Node.js (engineers know it; no new language to learn).
> **AI model:** Claude Code + Claude.ai subscription — no API keys, no per-token cost.
> **Distribution:** Shell installer → global `kb` command.

---

## 1. Mental Model

```
Claude Code (in vault directory)  ←→  Obsidian (split screen)
        │
        runs kb commands directly
        reads/writes vault files
        │
   kb CLI  ───  Vault (git-tracked .md files)
```

Claude Code is the single interface for all actions. It knows how to use `kb` because the vault repo ships with a `.claude/` folder containing CLAUDE.md and slash commands. Coworkers open Claude Code in the vault directory, talk naturally, Claude does the rest.

Obsidian is for browsing and reading the vault visually — not required for the workflow.

No MCP. No clipboard. No copy-paste. No separate AI tab.

### Default daily workflow

```
[Claude Code in ~/ProductVault]   ←─ split screen ─→  [Obsidian]
              │
     talk naturally:
     "what's on the roadmap?"          → Claude runs: kb list initiatives
     "what do we know about triggers?" → Claude runs: kb search "triggers"
     "I have a new insight"            → Claude runs: kb draft, guides you
     "commit this to the vault"        → Claude opens branch + PR, runs kb publish
```

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (Node.js 20+) | Engineers know it |
| CLI framework | `commander.js` | Simple, battle-tested |
| Markdown / YAML | `gray-matter` | Reads/writes YAML frontmatter |
| Keyword search | `fuse.js` | In-memory fuzzy search for `kb list` / `kb status` |
| Semantic search | `@xenova/transformers` (all-MiniLM-L6-v2) | Local embeddings, no API cost, 22MB model |
| Vector index | JSON at `.kb/vectors.json` | Simple flat file, fast enough for <500 files |
| Obsidian CLI | `obsidian` (system binary) | Create, append, open vault files |
| Terminal output | `chalk` + `ora` | Colors + spinners |
| Config | JSON at `~/.kb/config.json` | Simple, no database |
| **AI** | **Claude Code + Claude.ai subscription** | **No API key, no cost per call** |

**Not in this stack:**
- `@anthropic-ai/sdk` — not needed (Claude Code runs the CLI; no API calls from the CLI itself)
- `@modelcontextprotocol/sdk` — not needed
- `clipboardy` — not needed
- API key — not needed

---

## 3. Repository Structure

```
kb-tool/
├── src/
│   ├── index.ts                  # CLI entry point
│   ├── commands/
│   │   ├── init.ts               # kb init
│   │   ├── draft.ts              # kb draft
│   │   ├── publish.ts            # kb publish
│   │   ├── branch.ts             # kb branch --open / --close
│   │   ├── updates.ts            # kb updates --generate
│   │   ├── index-cmd.ts          # kb index (build vector index)
│   │   ├── search.ts             # kb search
│   │   ├── list.ts               # kb list
│   │   └── status.ts             # kb status
│   ├── vault/
│   │   ├── reader.ts             # Read + parse .md files
│   │   ├── writer.ts             # Write + move .md files
│   │   ├── search.ts             # Fuse.js keyword search
│   │   ├── embed.ts              # Embedding generation (transformers.js)
│   │   ├── vector-store.ts       # Vector index read/write/query
│   │   └── git.ts                # git helpers (add/commit/log/diff)
│   ├── schema/
│   │   └── validate.ts           # Validate frontmatter against entity schemas
│   └── config/
│       └── index.ts              # Read/write ~/.kb/config.json
├── templates/
│   ├── problem.md
│   ├── insight.md
│   ├── experiment.md
│   ├── decision.md
│   ├── initiative.md
│   ├── feature.md
│   ├── meeting-note.md
│   ├── integration.md
│   └── ceremony.md
├── scripts/
│   └── install.sh                # One-line shell installer
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. Data Model

### Vault structure

```
ProductVault/               ← git repo (shared, tracked)
├── .claude/                ← committed — shared with all teammates
│   ├── CLAUDE.md           ← teaches Claude Code the vault, kb commands, workflow
│   └── commands/
│       ├── draft.md
│       ├── publish.md
│       ├── roadmap.md
│       ├── resume.md
│       ├── compress.md
│       ├── preserve.md
│       ├── updates.md
│       ├── engineer-critique.md
│       ├── spec-writer.md
│       └── gap-analysis.md
├── .gitignore
├── 00_Drafts/              ← GITIGNORED — personal, never shared, never overwritten
├── 01_Problems/
├── 02_Insights/
├── 03_Experiments/
├── 04_Decisions/
├── 05_Initiatives/
├── 06_Features/            ← full feature specs, Figma links, acceptance criteria
├── 07_Meeting-Notes/
├── 08_Integrations/        ← integration specs, partner APIs, technical docs
├── 09_Templates/           ← committed vault templates for Obsidian
├── 10_Ceremonies/          ← groomings, sprint plannings, retros
├── Session-Logs/           ← GITIGNORED — personal CPR session logs
├── Updates-Log/            ← GITIGNORED — local digest of git pulls (auto-generated)
└── archive/                ← GITIGNORED — moved drafts post-publish
```

### .gitignore

```
00_Drafts/
Session-Logs/
Updates-Log/
archive/
.kb/
.DS_Store
```

**`git pull` will never overwrite or delete anything in these folders.** They are invisible to git — not staged, not tracked, not affected by pull/push/reset. Personal drafts are safe by construction.

### Draft format (gitignored)

```yaml
---
type: draft
subtype: problem | insight | experiment | idea | decision
title: ""
created: 2026-04-19T10:00:00Z
author: ""
status: draft
confidence: low | medium | high
tags: []
---

[Write directly, or Claude fills this via Obsidian CLI]
```

### Canonical entity schemas

All enforced by `kb publish`. Fields marked `*` are required.

#### Problem (`01_Problems/`)
```yaml
---
type: problem          *
title: ""              *
created: 2026-04-19    *
author: ""             *
status: open | validated | solved
severity: low | medium | high
linked_insights: []
linked_experiments: []
tags: []
---
## Description
## Evidence
## Impact
```

#### Insight (`02_Insights/`)
```yaml
---
type: insight          *
title: ""              *
created: 2026-04-19    *
author: ""             *
confidence: low | medium | high    *
source: ""             *
linked_problems: []
linked_decisions: []
tags: []
---
## Finding
## Evidence
## Implications
```

#### Experiment (`03_Experiments/`)
```yaml
---
type: experiment       *
title: ""              *
created: 2026-04-19    *
author: ""             *
status: planned | running | concluded
hypothesis: ""
result: ""
linked_problems: []
tags: []
---
## Setup
## Results
## Learnings
```

#### Decision (`04_Decisions/`)
```yaml
---
type: decision         *
title: ""              *
created: 2026-04-19    *
author: ""             *
status: proposed | decided | superseded
linked_problems: []
linked_insights: []
tags: []
---
## Context
## Options Considered
## Decision & Rationale
## Consequences
```

#### Initiative (`05_Initiatives/`)
```yaml
---
type: initiative       *
title: ""              *
created: 2026-04-19    *
author: ""             *
status: idea | planned | in_progress | done
priority: low | medium | high
linked_problems: []
linked_insights: []
linked_features: []
tags: []
---
## Overview
## Goals
## Success Metrics
## Open Questions
```

#### Feature (`06_Features/`)
```yaml
---
type: feature          *
title: ""              *
created: 2026-04-19    *
author: ""             *
status: idea | spec | in-dev | shipped | archived
linked_problems: []
linked_insights: []
linked_decisions: []
linked_initiatives: []
figma_url: ""
spec_doc_url: ""
tags: []
---
## Overview
## User Story
## Acceptance Criteria
## Technical Notes
## Open Questions
```

#### Meeting Note (`07_Meeting-Notes/`)
```yaml
---
type: meeting-note     *
date: 2026-04-19       *
attendees: []          *
meeting_type: standup | planning | design | review | stakeholder | other
linked_features: []
linked_decisions: []
linked_problems: []
tags: []
---
## Agenda
## Notes
## Decisions Made
## Action Items
```

#### Integration Spec (`08_Integrations/`)
```yaml
---
type: integration      *
title: ""              *
created: 2026-04-19    *
author: ""             *
partner: ""            *
status: planned | in-dev | live | deprecated
linked_features: []
tags: []
---
## Overview
## API / Technical Spec
## Data Flow
## Edge Cases & Constraints
## Links & Docs
```

#### Ceremony (`10_Ceremonies/`)
```yaml
---
type: ceremony                   *
ceremony_type: grooming | sprint-planning | retrospective | review   *
date: 2026-04-19                 *
sprint: ""
attendees: []
linked_features: []
linked_initiatives: []
linked_decisions: []
tags: []
---
## Agenda
## Items Discussed
## Decisions
## Committed to Sprint
## Action Items
```

---

## 5. Command Reference

### `kb init`

Sets up vault + config on first run. No AI provider step.

```
Prompts:
  - Vault path (default: ~/ProductVault)
  - Your name
  - Team member names (optional)

Creates:
  - All folders: 00_Drafts/ through 10_Ceremonies/, 09_Templates/, Session-Logs/, Updates-Log/, archive/
  - .gitignore (00_Drafts/, Session-Logs/, Updates-Log/, archive/, .kb/)
  - git init (if not already a repo)
  - .git/hooks/post-merge  →  kb updates --generate && kb index --quiet
  - Templates copied to 09_Templates/
  - .claude/CLAUDE.md and all slash command files
  - ~/.kb/config.json

Checks:
  - Node 20+ installed
  - gh CLI installed and authenticated (required for branch + PR flow)
  - Obsidian CLI installed (warns if missing; vault still works without it)
```

---

### `kb draft`

Creates a draft using Obsidian CLI, which writes directly into the vault.

```bash
kb draft --type insight
kb draft --type problem --title "Login drop"
```

Flow:
1. Determine slug + path: `00_Drafts/YYYY-MM-DD-<slug>.md`
2. Create note from template: `obsidian new --template [type].md --title "[slug]"`
3. Return file path to Claude
4. Claude writes content: `obsidian append --file "[path]" --content "..."`
5. Claude opens file: `obsidian open --file "[path]"`
6. User reviews/edits in Obsidian, tells Claude to publish it

**Obsidian CLI commands used:**

| Command | Purpose |
|---|---|
| `obsidian new --template [type].md --title "[slug]"` | Create note from vault template |
| `obsidian append --file "[path]" --content "[content]"` | Write content without overwriting |
| `obsidian open --file "[path]"` | Focus Obsidian on the file |

---

### `kb publish [filename]`

Converts a draft to canonical knowledge. Validates schema, shows diff, moves file, commits to active session branch.

```bash
kb publish                       # lists drafts, user picks one
kb publish 2026-04-19-login.md
```

Flow:
1. List drafts in `00_Drafts/` if no filename given
2. Load draft, detect `subtype`
3. Validate against schema — check required fields, valid enum values
4. Show target path and schema result
5. Prompt: `[a]ccept / [s]kip`
6. On accept:
   - Save to correct folder (`01_Problems/`, etc.)
   - Move draft to `archive/`
   - `git add <file> && git commit -m "publish: <title> (<type>)"` on current branch (local only)
   - Update session artifact list in `.kb/session.json`

**No push during publish.** Commits accumulate locally. All remote work happens in `kb branch --close`.

**Schema validation is local** — no AI call. Claude already filled in the content; this step enforces structure.

---

### `kb branch`

Manages session branches. Run by Claude as part of the publish flow — not by the user directly.

```bash
kb branch --open delayed-messages
# → git checkout -b kb/2026-04-19-delayed-messages  (local only, no push, no PR)
# → saves session to .kb/session.json

kb branch --close
# → git push -u origin [branch]                     (first remote touch)
# → gh pr create --title "feat: [topic]" --body "[buildPRBody(session)]"
# → gh pr merge [pr-number] --squash --delete-branch
# → git checkout main && git pull

kb branch --status
# → shows active branch, artifact list, open/close timestamps
```

Claude opens a branch only when the user explicitly triggers the publish phase ("publish this", "let's publish", "let's commit"). Never during capture.

---

### `kb updates --generate`

Reads git history since last pull, writes a local Updates-Log entry.

```bash
kb updates --generate    # run by post-merge hook automatically
kb updates --generate    # run manually to regenerate
```

Parses merged commits and changed files from `git log ORIG_HEAD..HEAD`, writes `Updates-Log/YYYY-MM-DD-HHMM.md`. Never commits this file.

---

### `kb index`

Builds or updates the local vector index for semantic search.

```bash
kb index           # full rebuild
kb index --quiet   # silent, for post-merge hook
kb index --diff    # only re-embed files changed since last index
```

Flow:
1. Walk all canonical folders (01–08, 10_Ceremonies/)
2. For each `.md` file: read title + type + tags + body (first 512 tokens)
3. Generate 384-dim embedding via `@xenova/transformers` (all-MiniLM-L6-v2, runs locally)
4. Write `.kb/vectors.json`

First run: downloads model (~22MB, cached) and indexes all files. Subsequent runs with `--diff`: only re-embeds changed files (~1–2s).

---

### `kb search`

Semantic + keyword search across the vault. Claude calls this before answering open-ended questions.

```bash
kb search "power users workaround"
kb search "onboarding drop-off" --type insight
kb search "Zapier" --limit 10
```

Flow:
1. Embed the query (same model as `kb index`)
2. Cosine similarity vs all vectors in `.kb/vectors.json`
3. Also run fuse.js keyword search as a second pass
4. Merge + deduplicate results, rank by combined score, apply `--type` filter

Output:
```
SEARCH: "power users workaround"  (semantic + keyword)
  0.89  02_Insights/power-users-use-zapier.md          Viktor  Apr 19
  0.82  01_Problems/no-native-trigger-system.md         Viktor  Apr 12
  0.79  05_Initiatives/triggered-notifications.md       Viktor  Apr 18
  0.71  06_Features/triggered-notifications-v1.md       Anna    Apr 15
  0.65  02_Insights/zapier-admin-workaround.md          Anna    Apr 10
```

Claude reads the top files directly after running search.

**Fallback:** if `.kb/vectors.json` doesn't exist yet, falls back to keyword-only search and prints: `"Vector index not found — run kb index for semantic search."`

---

### `kb list`

List vault files by type and status.

```bash
kb list                          # all entities, summary
kb list problems                 # all problems
kb list problems --status open
kb list drafts                   # pending drafts
kb list initiatives --status planned
```

Output (colored terminal):
```
PROBLEMS (4)
  open        onboarding-drop-off.md          Viktor  2026-04-12
  validated   login-friction.md               Anna    2026-04-10
  solved      empty-state-confusion.md        Viktor  2026-04-01

DRAFTS (2 pending publish)
  draft       2026-04-19-payment-drop.md      Viktor  2026-04-19
  draft       2026-04-18-search-intent.md     Anna    2026-04-18
```

---

### `kb status`

Vault health dashboard.

```bash
kb status
```

Output:
```
── kb vault status ──────────────────────────────────────
  vault:    ~/ProductVault  (git: clean, 3 ahead of origin)

  Problems    6   open: 3   validated: 2   solved: 1
  Insights    9   high-confidence: 4
  Experiments 2   running: 1   concluded: 1
  Decisions   5
  Initiatives 4   planned: 2   in-progress: 1   done: 1
  Features    7   spec: 4   in-dev: 2   shipped: 1
  Ceremonies  3   upcoming: 2

  Drafts      2   pending publish
  Index       94 files indexed   last updated: 2h ago
  Last commit 2 hours ago by Viktor

─────────────────────────────────────────────────────────
```

---

### `.claude/CLAUDE.md` (the integration layer)

Lives in the vault repo, committed, shared with all teammates. Claude Code reads this automatically when opened in the vault directory. No setup required.

```markdown
# Product Knowledge Vault

This is a product discovery knowledge base for [team name].

## Your role
You are an assistant for this team's product discovery process.
You work autonomously — never ask the user to copy-paste or manually run terminal commands.
You use the `kb` CLI and Obsidian CLI for all vault operations.

## kb commands
- `kb list [type] [--status X]` — list vault files by type and status
- `kb list drafts` — show pending drafts
- `kb draft --type [type]` — create draft, opens in Obsidian
- `kb publish [file]` — validate + commit draft to current branch, update PR body
- `kb branch --open [topic]` — open session branch + draft PR immediately
- `kb branch --close [pr-number]` — update PR body + squash-merge + return to main
- `kb index` — build/update local vector index for semantic search
- `kb search "[query]"` — semantic + keyword search across vault
- `kb updates --generate` — regenerate local update digest from git log
- `kb status` — vault health overview

## Obsidian CLI commands
- `obsidian new --template [type].md --title "[slug]"` — create from template
- `obsidian append --file "[path]" --content "[content]"` — write to file
- `obsidian open --file "[path]"` — focus Obsidian on a file

## Vault structure
- 01_Problems/ through 10_Ceremonies/ — canonical knowledge (git-tracked)
- 00_Drafts/ — GITIGNORED personal workspace (never commit, never overwrite)
- Session-Logs/ — GITIGNORED personal session memory (CPR system)
- Updates-Log/ — GITIGNORED local git pull digest (auto-generated)
- .kb/ — GITIGNORED vector index cache

## Answering open-ended vault questions
When the user asks anything non-trivial about vault content:
1. Run `kb search "[query]"` first to find relevant files
2. Read the top 3–5 files directly
3. Synthesize with citations: "Source: 02_Insights/power-users-use-zapier.md"
Never guess file paths. Always search first.

## Git flow — session branch + draft PR
- Open a branch at the FIRST sign of vault modification in a conversation
- `kb branch --open [topic]` → branch + draft PR immediately
- All artifacts from this conversation go on that branch
- Never commit directly to main
- Before merging: prompt for missing links (Figma, problems, grooming)
- Close with `kb branch --close [pr-number]` when user signals done

## Workflow rules
1. **Session start:** run `/resume` to load context, then `git pull`
2. **First vault modification:** `kb branch --open [topic]` before touching any file
3. **Drafting:** use `kb draft` + Obsidian CLI; never ask user to paste or move anything
4. **Each publish:** `kb publish` → commits to current branch, updates PR body automatically
5. **Open-ended questions:** run `kb search` first, then read top files
6. **Proactive context:** when discussing a file, run `git log --oneline -- [file]` and flag recent changes
7. **Pre-merge prompt:** ask about Figma, linked problems, grooming — don't leave gaps
8. **Session end:** `kb branch --close [pr]` if complete, then `/compress`
9. **Never** edit canonical files (01–08, 10) directly — only via `kb publish`
10. **Never** ask the user to copy-paste anything or run terminal commands
```

---

### `.claude/commands/draft.md` — `/draft`

```markdown
The user wants to capture a new piece of knowledge.

1. Ask: what type? (problem / insight / experiment / decision / initiative / feature / meeting-note / integration / ceremony)
2. If no active session branch yet: run kb branch --open [topic]
3. Run: kb draft --type [type]
4. Ask clarifying questions to help them articulate it clearly
5. Fill in the draft via Obsidian CLI (never ask user to paste)
6. When content is ready: run kb publish
7. PR body is updated automatically by kb publish
8. Ask: anything else to add to this session?
```

---

### `.claude/commands/publish.md` — `/publish`

```markdown
The user wants to publish drafts. This is Phase 2 — triggered only by the user.

1. Run kb list drafts — show what's pending
2. Pre-flight check: feature without linked_problems or figma_url, insight without source
3. Open local session branch: kb branch --open [topic]
4. For each draft: kb publish [filename]  (local commit only, no push)
5. When all done: kb branch --close
   → push branch → gh pr create → gh pr merge --squash → git pull
6. Confirm what landed: "Published and merged: [list of files]."
```

---

### `.claude/commands/roadmap.md` — `/roadmap`

```markdown
Run: git pull
Run: kb list initiatives
Run: kb list problems --status open
Run: kb list problems --status validated
Run: kb search "roadmap priorities" to surface supporting insights
Synthesize a prioritized roadmap from the results.
Ask the user if they want to save it as a new initiative file.
```

---

### `.claude/commands/updates.md` — `/updates`

```markdown
Show what changed in the vault since the user last checked.

1. Read Updates-Log/ — find most recent files (last 7 days)
2. Summarize in plain language:
   - Who added what entities
   - Which existing entities were updated (Figma, status, links)
   - Open PRs waiting for review
3. Proactively flag anything relevant to the user's current work

Usage:
  /updates          — last 7 days
  /updates 30       — last 30 days
  /updates [topic]  — updates touching a specific entity or topic

Auto-generation: Updates-Log/ is written by the post-merge hook on every git pull.
```

---

## 6. Local RAG

### Problem

As the vault grows past 50 files, Claude can't read everything before answering — it needs to know *which* files are relevant. Keyword search works for structured queries ("show me all planned initiatives") but fails for open-ended questions like "what do we know about power users?" or "what's blocking the notification feature?"

### Solution: local semantic search

The vault ships with a local vector search layer. No cloud API. No Pinecone. No server. Embeddings run on the user's machine using a bundled 22MB model.

### How it works

```
kb index
  └─ Reads all canonical .md files (01–08, 10)
  └─ Concatenates: title + type + tags + body (first 512 tokens)
  └─ Generates 384-dim embedding per file via all-MiniLM-L6-v2
  └─ Writes .kb/vectors.json  (gitignored)

kb search "power users"
  └─ Embeds the query (same model)
  └─ Cosine similarity vs all vectors
  └─ + fuse.js keyword boost
  └─ Returns top-5 file paths + scores

Claude reads top files → answers with citations
```

### Model choice

`@xenova/transformers` with `all-MiniLM-L6-v2`:
- Runs in Node.js — no Python, no GPU, no Ollama required
- Model size: ~22MB, downloaded once and cached at `~/.kb/model/`
- Embedding speed: ~50 files/second on M1 Mac
- 384-dimensional embeddings — well-suited for short product documents

### When index is rebuilt

- `kb index --quiet` runs in the post-merge hook on every `git pull` (incremental: `--diff` mode only re-embeds changed files)
- `kb index` run manually at any time for full rebuild
- First run: ~30s for 100 files (model download + full index)
- Subsequent runs with `--diff`: ~1–2s

### Vector index format

```json
// .kb/vectors.json
{
  "indexed_at": "2026-04-19T09:00:00Z",
  "model": "all-MiniLM-L6-v2",
  "files": [
    {
      "path": "02_Insights/power-users-use-zapier.md",
      "title": "Power users use Zapier as workaround for notification triggers",
      "type": "insight",
      "tags": ["power-users", "zapier", "workaround"],
      "updated_at": "2026-04-19T08:30:00Z",
      "embedding": [0.023, -0.041, ...]
    }
  ]
}
```

### CLAUDE.md instruction (already in Section 5)

```
When the user asks anything non-trivial about vault content:
1. Run kb search "[query]" first
2. Read the top 3–5 files directly
3. Synthesize with citations
Never guess file paths. Always search first.
```

### Fallback

If `.kb/vectors.json` doesn't exist yet (or is empty), falls back to keyword-only search via fuse.js. Prints: `"Vector index not found — run kb index to enable semantic search. Using keyword search."` Never fails silently.

### Phase plan

| Phase | What |
|---|---|
| MVP | `kb search` with keyword-only via fuse.js. Works from day 1, no model needed. |
| Phase 2 | `kb index` + `@xenova/transformers` embeddings. Hook into post-merge. |
| Phase 3 (optional) | Hybrid reranking: semantic score × recency × author-relevance weight. |

---

## 7. CPR Memory System

Adapted from the CPR pattern. Solves the core problem: Claude forgets everything between sessions.

### `/resume` — load context at session start

```markdown
1. Read Session-Logs/ — load the last 3 session summaries
2. Read .claude/CLAUDE.md — load permanent vault memory
3. Brief the user: "Last session: [date], you were working on [topic].
   Key pending items: [list]. Vault has [N] open problems, [N] planned initiatives."
4. Run: git pull (updates vault + triggers post-merge hook if there are new commits)
5. If Updates-Log/ has new entries: summarize what teammates changed
6. Ready to work.

Usage:
  /resume      — last 3 sessions
  /resume 10   — last 10 sessions
  /resume auth — last 3 sessions + search vault for "auth"
```

---

### `/compress` — save session before closing

```markdown
At the end of a work session, save a structured log.

1. Ask the user what topics to tag this session with
2. Create Session-Logs/YYYY-MM-DD-HH-MM-[topic].md with:
   - Quick Reference (topics, outcome — for fast AI scanning)
   - Decisions Made
   - Files Created or Modified
   - Pending Tasks
3. Save to Session-Logs/ (gitignored — personal only)
4. Confirm: "Session saved. Run /resume next time to reload this context."
```

---

### `/preserve` — promote learning to permanent memory

```markdown
1. Ask: what should be permanently remembered?
2. Append to .claude/CLAUDE.md under the relevant section
3. If CLAUDE.md exceeds 280 lines:
   - Archive old sections to .claude/CLAUDE-Archive.md
   - Keep: Vault Structure, Workflow Rules, kb Commands
   - Confirm: "CLAUDE.md archived. [N] lines kept, [N] moved to archive."
```

---

## 8. Agentic Skills

Multi-step autonomous workflows — reading multiple files, synthesizing, writing output — without user intervention between steps.

### `/engineer-critique` — review from engineering perspective

```markdown
Input: a feature or decision filename (or ask user to specify)

1. Read the feature/decision file
2. Read all linked_problems, linked_insights, linked_decisions
3. Run: kb search "[feature topic]" to find related integration specs and prior decisions
4. Read top results
5. Produce structured critique:
   - Technical feasibility
   - Hidden complexity or edge cases
   - Integration risks
   - Open questions for engineering
6. Ask: save as a comment in the feature file, or just display?
```

---

### `/spec-writer` — generate full feature spec from initiative

```markdown
Input: an initiative name or file

1. Read the initiative file
2. Read all linked_problems and linked_insights
3. Run: kb search "[initiative topic]" to find related features + integrations
4. Read top results
5. Generate full feature spec:
   - Overview, User Story, Acceptance Criteria
   - Technical Notes (from integration context)
   - Open Questions
   - Figma URL placeholder if UI involved
6. kb branch --open [feature-name] (if no active branch)
7. kb draft --type feature
8. Write spec via Obsidian CLI, open in Obsidian for review
9. Ask: publish and commit?
```

---

### `/gap-analysis` — find disconnected knowledge

```markdown
Run autonomously. No input needed.

1. kb list problems --status open → check each has at least one linked insight
2. kb list insights → check each has at least one linked problem or decision
3. kb list initiatives → check each has at least one linked problem
4. kb list features → check each has a linked initiative + non-empty figma_url
5. Report gaps:
   - "3 problems have no linked insights — possible blind spots"
   - "2 initiatives have no linked problems — what are they solving?"
   - "4 features have no Figma URL — add before next grooming"
6. Ask: want me to draft missing links or flag them for review?
```

---

## 9. Git Flow — Two-Phase Model

### Core idea

**Draft phase = zero git.** Drafts live in `00_Drafts/` (gitignored) until the user explicitly says to publish. No branches, no commits, no remote involvement during drafting.

**Publish phase = all remote work happens atomically at close.** When the user triggers publish, Claude opens a local branch, commits each published file locally, then `kb branch --close` does everything remote in one shot:

```
1. git push -u origin [branch]         → creates remote branch with all local commits
2. gh pr create --title "feat: [topic]" --body "[full artifact list + checklist]"
3. gh pr merge [number] --squash --delete-branch
4. git checkout main && git pull
```

### Full flow

```
Phase 1 — Draft (no git)
  User shares info → Claude runs: kb draft --type [type] --title "[title]"
  Claude writes content to 00_Drafts/YYYY-MM-DD-[slug].md
  User reviews in Obsidian
  STOP. No branch. No commit. Nothing touches git.

Phase 2 — Publish (triggered by user saying "publish", "looks good", etc.)
  Claude runs: kb branch --open [topic]
    → git checkout -b kb/[date]-[topic]  (local only)
  For each draft:
    Claude runs: kb publish [filename]
    → validates schema, moves file, git add + git commit  (local only)
  Claude runs: kb branch --close
    → git push -u origin [branch]        (all commits land on remote at once)
    → gh pr create --title "feat: [topic]" --body "[full summary]"
    → gh pr merge [number] --squash --delete-branch
    → git checkout main && git pull
```

### Pre-publish checklist (run before kb publish, not before merge)

Claude checks and prompts before accepting each draft:
- Feature with no linked_problems → "Which user problem does this solve?"
- Feature with no figma_url → "Do you have a Figma link yet?"
- Insight with no source → "Where did this come from?"
- Insight with no linked_problems → "Which open problem does this relate to?"

### PR body — generated at close

`buildPRBody(session)` generates the full PR description from the session's artifact list:

```markdown
## Context
**Topic:** delayed-messages
**Session:** 2026-04-19, Anna

## Artifacts in this PR
- [x] 06_Features/delayed-messages.md
- [x] 02_Insights/users-want-async-comms.md
- [x] 02_Insights/admin-panel-send-timing-bottleneck.md

## Review checklist
- [ ] All entities have valid schema
- [ ] Feature linked to at least one problem
- [ ] Grooming entry exists
```

### Branch naming

```
kb/[date]-[topic-slug]
e.g. kb/2026-04-19-delayed-messages
     kb/2026-04-20-grooming-prep
     kb/2026-04-21-zapier-insight-batch
```

### Fallback (no gh or no remote)

If `gh` isn't authenticated or push fails, `kb branch --close` falls back to a local squash-merge (`git merge --squash [branch]`) and prints instructions for manual PR creation. Degrades gracefully.

---

## 10. Updates Digest

### How it works

Source of truth is **git history** — shared, identical for everyone. On every `git pull`, the post-merge hook generates a local `Updates-Log/` entry by reading what was merged. No committed file. No sync needed. Everyone gets the same content because they're reading the same git log.

### Post-merge hook (installed by `kb init`)

```bash
# .git/hooks/post-merge
#!/bin/sh
kb updates --generate
kb index --quiet
```

`kb updates --generate` runs:
```bash
git log ORIG_HEAD..HEAD --merges --pretty=format:"%s|%an|%ai"
git diff --name-only ORIG_HEAD HEAD | grep -E "^0[0-9]_|^1[0-9]_"
```

Parses filenames into entity types and titles, writes:

```
Updates-Log/2026-04-19-0900.md

## Vault update — pulled 2026-04-19 09:00

Anna merged: feat: delayed-messages
  + 06_Features/delayed-messages.md
  + 02_Insights/users-want-async-comms.md
  + 10_Ceremonies/grooming-2026-04-22.md (feature added)

Viktor merged: feat: triggered-notifications-update
  ~ 06_Features/triggered-notifications.md (Figma link added)

1 open PR: kb/2026-04-18-grooming-prep (Anna, waiting review)
```

### `/updates` reads these local files

```
/updates          → last 7 days
/updates 30       → last 30 days
/updates [topic]  → updates touching a specific entity or topic
```

Claude reads the relevant Updates-Log/ entries and summarizes in plain language. Proactively flags things relevant to current work.

---

## 11. Config File

`~/.kb/config.json`:

```json
{
  "vault_path": "/Users/viktor/Documents/ProductVault",
  "author": "Viktor",
  "team": ["viktor", "anna", "max"],
  "editor": "obsidian",
  "auto_git_commit": true
}
```

No API key. No model selection. No provider config.

---

## 12. Distribution & Packaging

### Phase 1 — Shell installer (day 1)

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/kb-tool/main/scripts/install.sh | bash
```

`install.sh`:
1. Check Node 20+ → install via `nvm` if missing (auto-installs nvm if needed)
2. Check `gh` CLI → if missing, print: `"Install with: brew install gh && gh auth login"` and exit
3. `npm install -g kb-tool`
4. Print: `"Done. Run kb init to get started."`

---

### Phase 2 — Compiled binary (no Node needed)

```bash
bun build --compile --minify src/index.ts --outfile kb
```

Drop binary in GitHub Releases. Useful for non-engineers who don't want Node.

```bash
# macOS (arm64)
curl -fsSL https://github.com/your-org/kb-tool/releases/latest/download/kb-macos-arm64 -o /usr/local/bin/kb
chmod +x /usr/local/bin/kb
```

---

### Phase 3 — Homebrew formula (optional)

```bash
brew install your-org/kb/kb-tool
```

Best UX for a Mac-first team. Handles updates automatically. Overkill for a 3-person team — do this when the team grows.

---

## 13. Cost Model

| Item | Cost |
|---|---|
| Claude.ai Pro (per person) | $20/month |
| Claude.ai Team (per person) | $25/month |
| API calls from CLI | $0 |
| Embeddings (local model) | $0 |
| Infrastructure | $0 |

**For a 3-person team: $60–75/month.** No surprise bills. No token counting. No API key rotation.

---

## 14. Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Team uses Claude inconsistently (no schema) | `kb publish` enforces schema at commit time |
| Vault conflicts | Drafts gitignored; canonical files on feature branches — conflicts surface at PR merge, not silently on pull |
| Non-engineers can't install Node | Phase 2 binary; Phase 1 install.sh handles Node via nvm |
| `gh` CLI not installed | `kb init` checks and prints setup instructions; required for PR flow |
| Vault too large for Claude context window | `kb search` retrieves top-N relevant files; Claude never reads the whole vault |
| Vector index stale after pull | Post-merge hook auto-updates index; `kb status` shows index age |
| First-run model download slow (22MB) | Cached at `~/.kb/model/` after first run; `--quiet` skips if nothing changed |
| Low adoption | Simpler than API version — just talk to Claude Code; no terminal, no config |

---

**The CLI is not the product. The habit is the product.**
The CLI makes the habit frictionless.
