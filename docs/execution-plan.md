# kb-tool — Execution Plan

Phases ordered by user value. Each phase is independently usable.

---

## ✅ Phase PoC — COMPLETE

**What was built:**

### CLI commands
| Command | Status | Notes |
|---|---|---|
| `kb list [type] [--status X]` | ✅ done | plural aliases (problems→problem, insights→insight, etc.) |
| `kb list drafts` | ✅ done | shows pending files in 00_Drafts/ |
| `kb draft --type [type] --title "[title]"` | ✅ done | creates from template, writes to 00_Drafts/ |
| `kb publish [filename]` | ✅ done | validates schema, moves file, local commit only |
| `kb status` | ✅ done | entity counts, git state, pending drafts |
| `kb search "[query]"` | ✅ done | keyword search via fuse.js |
| `kb branch --open [topic]` | ✅ done | local branch only (no push, no PR) |
| `kb branch --close` | ✅ done | push → gh pr create → gh pr merge → git pull |
| `kb branch --status` | ✅ done | shows active session state |

### Vault fixture
- `fixtures/vibe-disco-vault-test/` — TaskFlow team vault, pre-populated with realistic data (published to https://github.com/v-yatskin/vibe-disco-vault-test)
- 4 Problems, 3 Insights, 3 Experiments, 2 Decisions, 3 Initiatives, 3 Features
- 2 Meeting Notes, 1 Integration spec, 2 Ceremonies, 9 Templates
- Remote repo: https://github.com/v-yatskin/vibe-disco-vault-test.git

### Slash commands (in `.claude/commands/`)
| Command | Status |
|---|---|
| `/draft` | ✅ done |
| `/publish` | ✅ done (renamed from /structure) |
| `/resume` | ✅ done |
| `/compress` | ✅ done |
| `/gap-analysis` | ✅ done |

### Git flow — two-phase model (final design)
**Draft phase:** purely local, zero git involvement
**Publish phase:** all git/GitHub happens atomically at `kb branch --close`:
1. `git push -u origin [branch]` — pushes all local commits at once, creates remote branch
2. `gh pr create --title "feat: [topic]" --body "[buildPRBody(session)]"` — opens PR with full artifact list
3. `gh pr merge --squash --delete-branch` — merges on GitHub
4. `git checkout main && git pull` — syncs local main

**Nothing is pushed or PR'd until the user says to close the session.**

### Install (developer)
```bash
git clone https://github.com/your-org/kb-tool
cd kb-tool
npm install && npm run build && npm link
```

---

## Next phases (not started)

---

## Phase 1 — `kb init` (3h)
**Goal:** new vaults can be created from scratch, no manual file setup.

- Prompt: vault path, author name
- Create all folders: `00_Drafts/` through `10_Ceremonies/`, `Session-Logs/`, `Updates-Log/`, `archive/`
- Write `.gitignore`
- `git init` if not already a repo
- Copy templates into `09_Templates/`
- Write `.claude/CLAUDE.md` and all slash command files
- Save `~/.kb/config.json`
- Check `gh` CLI is installed and authenticated (warn if missing)
- Install post-merge hook: `kb updates --generate && kb index --quiet`

**Done when:** `kb init` → complete vault on disk, ready for Claude Code.

---

## Phase 2 — `kb updates --generate` (2h)
**Goal:** teammates know what changed after `git pull`.

- `kb updates --generate` reads `git log ORIG_HEAD..HEAD`, writes `Updates-Log/YYYY-MM-DD-HHMM.md`
- Post-merge hook (installed by `kb init`) runs it automatically on `git pull`
- `/updates` slash command reads these local files and summarizes in plain language

**Done when:** `git pull` auto-generates an update log; `/updates` shows who added what.

---

## Phase 3 — `kb index` + Semantic Search (4h)
**Goal:** Claude finds relevant files for open-ended questions, not just keyword matches.

- `kb index` walks canonical folders (01–08, 10), generates 384-dim embeddings via `@xenova/transformers` (all-MiniLM-L6-v2), writes `.kb/vectors.json`
- `kb index --quiet` — silent, for post-merge hook
- `kb index --diff` — only re-embeds changed files
- `kb search` upgraded: embeds query, cosine similarity, merged with fuse.js keyword results, ranked output
- Fallback: if `.kb/vectors.json` missing, keyword-only with warning

**First run:** downloads 22MB model to `~/.kb/model/` (cached), indexes all files (~30s/100 files).
**Done when:** `kb search "power users"` returns semantically correct top-5 files.

---

## Phase 4 — Remaining Slash Commands (2h)
**Goal:** agentic skills and memory system complete.

Commands to write and test:
- `/roadmap` — `kb list initiatives` + `kb list problems` → synthesized priority view
- `/preserve` — promotes a learning to permanent CLAUDE.md memory
- `/updates` — reads Updates-Log/, summarizes in plain language
- `/engineer-critique` — reads feature + linked files → engineering feasibility review
- `/spec-writer` — reads initiative → generates full feature spec draft

**Done when:** each command runs end-to-end against the sample vault.

---

## Phase 5 — Install Script + Distribution (2h)
**Goal:** a coworker can install in under 10 minutes with one command.

- `scripts/install.sh`:
  1. Check Node 20+ → install via nvm if missing
  2. Check `gh` CLI → if missing, print install instructions and exit
  3. `npm install -g kb-tool`
  4. Print: "Done. Run `kb init` to get started."
- `README.md`: one-page quickstart

**Done when:** fresh Mac, run install script, run `kb init`, open Claude Code → working.

---

## Phase 6 — Compiled Binary (optional, 2h)
**Goal:** no-Node install for non-engineers.

- `bun build --compile src/index.ts --outfile kb`
- GitHub Releases: `kb-macos-arm64`
- Install: `curl ... -o /usr/local/bin/kb && chmod +x /usr/local/bin/kb`

---

## Phase 7 — Obsidian Integration ✅ (5h)
**Goal:** bases become the team's primary list UI; Obsidian's backlink graph becomes real.

See [phase-2-plan.md](phase-2-plan.md) → Area 1 for full design.

- **Bases are the canonical list UI.** `kb list` stays as an internal/programmatic interface only — Claude never dumps its output in chat for a question a base answers.
- `kb init` seeds `Bases/` with 7 starter bases (open-problems, active-initiatives, high-confidence-insights, my-drafts, recent-decisions, orphan-insights, stale-initiatives)
- `kb publish` auto-generates a `## Links` section with `[[wikilinks]]` from `linked_*` frontmatter fields (idempotent — regenerates on every publish)
- `kb base --list / --create / --show` commands
- `kb search --base [name]` and `kb search --in [folder]` filtering
- `/graph [entity]` slash command — text-based link-graph summary
- CLAUDE.md updated: for every list-style user question, Claude answers with a 1–2 line summary + "see the `X` base in Obsidian" instead of a table dump
- `kb init --upgrade` — adds wikilinks section to existing canonical files without rewriting content

**Gate:** requires Obsidian 1.9+ for bases. `kb init` checks and warns.

**Done when:** user opens Obsidian, clicks `open-problems` base in sidebar, sees a live filterable table; `kb search "zapier" --base active-initiatives` returns filtered results.

---

## Phase 8 — Extended Vault Structure ✅ (2h)
**Goal:** vault holds more than markdown — data snapshots (tracked), OneDrive-synced binaries, a personal workspace, and personal agents.

See [phase-2-plan.md](phase-2-plan.md) → Area 2 for full design.

- New folders created by `kb init` / `kb init --upgrade`:
  - `11_Data/` — data snapshots (metadata.md + data.csv + optional chart.png) — tracked
  - `_files/` — OneDrive-synced binaries (PDFs, decks, images) — gitignored entirely
  - `_private/` — personal additions (stakeholder emails, scratch notes) — folder + single README tracked, contents gitignored
  - `.claude/agents/` — committed team subagents
  - `.claude/agents.private/` — gitignored personal subagents
- `.gitignore` updated with:
  ```
  _files/
  _private/*
  !_private/README.md
  .claude/agents.private/
  .claude/skills.private/
  ```
- `kb init` writes `_private/README.md` explaining the folder's purpose (personal additions, never shared)
- `kb snapshot --title "[name]" --date [date]` — creates a dated snapshot folder with metadata template
- `/snapshot` slash command
- `kb publish` refuses to publish files under `_private/` (hard error)

**Dropped from earlier draft:** `11_Files/` (replaced by OneDrive-synced `_files/`), `kb attach` command, Git LFS auto-setup, `/attach` slash command. Binaries live in OneDrive; git handles only structured text + small data.

**Done when:** Viktor can take a data snapshot, drop a PDF into `_files/` (OneDrive syncs it), write personal notes in `_private/`, and only the data snapshot ships to the team's remote.

---

## Phase 9 — Update & Curation Flows ✅ (3h)
**Goal:** canonical knowledge stays accurate as the team grows; updates are safe, tracked, and reviewed.

See [phase-2-plan.md](phase-2-plan.md) → Area 3 for full design.

- `kb edit [path]` — copies canonical back to `00_Drafts/`, records in `.kb/pending-edits.json`
- `kb publish` detects edit-drafts, shows diff before commit, writes `update: ...` commit message (no folder move)
- `kb link [src] [target]` — updates frontmatter + regenerates wikilinks section; commits atomically
- `kb link --suggest [file]` — invokes `link-finder` subagent to propose candidates
- `kb retire [path] --reason "..."` — moves to `archive/`, sets status `archived`, warns about inbound links
- Subagents in `.claude/agents/`:
  - `kb-reviewer.md` — pre-publish draft critique (schema, confidence calibration, link completeness) — produces critique, does **not** block
  - `link-finder.md` — proposes candidate links for a file
  - `vault-curator.md` — weekly sweep (orphans, stale, broken, lingering drafts)
- Slash commands: `/edit`, `/link`, `/curate`
- CLAUDE.md guardrails updated:
  - Never edit canonical files directly
  - Prefer `kb link` / `kb retire` over manual frontmatter edits
  - Never promote `_private/` files without `kb publish`
  - **On git conflict, never auto-resolve — print conflicted paths with instructions, halt, user resolves manually**

**Dropped from earlier draft:** `KB_STRICT=1` hard-gate mode. `kb publish` keeps its existing soft default (warn on missing fields, ask user to accept). `kb-reviewer` critique is advisory. Revisit strict mode only if team grows past ~10 and quality becomes a real problem.

**Done when:** an existing insight can be edited, linked, or retired without opening a canonical file manually; `/curate` surfaces vault health issues weekly; git conflicts surface clearly and halt cleanly for manual resolution.

---

## Backlog

| Item | Value | Notes |
|---|---|---|
| `/inbox-process` slash command | medium | Batch-publish all pending drafts in 00_Drafts/ |
| Homebrew formula | low | Best UX but overkill for a 3-person team |
| `kb ui` local web dashboard | low | Useful for standup/stakeholder views |
| Slack/OneDrive integration for meeting notes | low | Manual paste works for now |
| `kb sync` with Obsidian Sync headless mode | medium | Alternative to git for non-engineers |

---

## Estimated remaining effort

### Original scope (PoC → v1)

| Phase | Time |
|---|---|
| 1 — kb init | ~3h |
| 2 — kb updates + post-merge hook | ~2h |
| 3 — kb index + semantic search | ~4h |
| 4 — remaining slash commands | ~2h |
| 5 — install script + docs | ~2h |
| **v1 subtotal** | **~13h** |

### Phase 2 scope (v1 → v2)

| Phase | Time |
|---|---|
| 7 — Obsidian integration (bases as primary UI, wikilinks, /graph) | ~5h |
| 8 — Extended vault structure (`_files/`, `_private/`, `11_Data/`, agents) | ~2h |
| 9 — Update & curation flows (kb edit/link/retire, subagents, /curate) | ~3h |
| **v2 subtotal** | **~10h** |

### Total remaining

**~23h across ~5 focused sessions.** Phases 1–5 unblock v1 (team rollout); 7–9 are the enrichment pass after people are actually using it.

**Recommended sequencing:** ship 1→5 first (team is unblocked), run for 2–3 weeks to collect real usage signal, then do 7→9 informed by what actually hurts.
