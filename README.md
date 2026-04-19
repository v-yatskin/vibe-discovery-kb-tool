# kb-tool

> A CLI that turns an Obsidian vault into a git-backed, AI-queryable knowledge base for product discovery teams.

`kb` is the engine behind a two-phase workflow:

1. **Capture** — AI-assisted drafts in `00_Drafts/`, purely local, no git
2. **Publish** — drafts are validated, committed to canonical folders, pushed as a PR, and merged — all in one step

The user talks to Claude Code. Claude runs `kb`. No one opens a terminal after install.

---

## Status

**Proof of concept complete.** The core CLI and two-phase git flow work end-to-end against a sample vault.

### Shipped

| Area | Done |
|---|---|
| `kb draft` | ✅ creates from template, writes to `00_Drafts/` |
| `kb structure` | ✅ validates schema, moves file, local commit |
| `kb list [type]` | ✅ colored table, plural aliases, `--status` filter |
| `kb status` | ✅ entity counts, git state, pending drafts |
| `kb search` | ✅ keyword via fuse.js |
| `kb branch --open / --close / --status` | ✅ full two-phase git flow (push + `gh pr create` + `gh pr merge` + `git pull`) |
| Sample vault fixture | ✅ TaskFlow team, realistic data |
| `.claude/CLAUDE.md` + slash commands | ✅ `/draft`, `/publish`, `/resume`, `/compress`, `/gap-analysis` |
| Remote vault | ✅ https://github.com/v-yatskin/vibe-disco-vault-test |

### In progress / not started

| Area | Target |
|---|---|
| `kb init` | Phase 1 — create a vault from scratch (folders, templates, `.claude/`, post-merge hook) |
| `kb updates --generate` | Phase 2 — post-pull digest of what teammates merged |
| `kb index` + semantic search | Phase 3 — local embeddings via `@xenova/transformers` |
| Slash commands `/roadmap` `/updates` `/preserve` `/engineer-critique` `/spec-writer` | Phase 4 |
| `scripts/install.sh` | ✅ done — clone + build + link |
| User-facing vault README | Phase 5 (done in vault repo) |
| Compiled binary (`bun build --compile`) | Phase 6 (optional) |

Estimated remaining effort: **~13h across 2–3 focused sessions.** See [execution-plan.md](execution-plan.md).

---

## How it works

### Two-phase git model

```
Draft phase          Publish phase (triggered by user)
─────────────        ──────────────────────────────────
kb draft             kb branch --open   → local branch
  ↓                  kb structure × N   → local commits
00_Drafts/           kb branch --close  → push + PR + merge + pull
(gitignored)                             (atomic: all work lands together)
```

**Nothing is pushed until the user says to close the session.** This eliminates merge conflicts by construction — drafts never leave the user's machine.

### Layers

1. **Input** — Claude Code conversation → `kb draft`
2. **Processing** — `kb structure` validates frontmatter against entity schemas, moves file to canonical folder
3. **Storage** — markdown with typed frontmatter, one entity per file, append-only
4. **Retrieval** — `kb search` (keyword now, semantic later) + Claude reads files directly

### Entity schemas

| Type | Folder | Required fields |
|---|---|---|
| `problem` | `01_Problems/` | title, severity, status |
| `insight` | `02_Insights/` | title, confidence, linked_problems |
| `experiment` | `03_Experiments/` | title, hypothesis, result |
| `decision` | `04_Decisions/` | title, reasoning, linked_evidence |
| `initiative` | `05_Initiatives/` | title, status, priority, linked_problems |
| `feature` | `06_Features/` | title, status, linked_initiative |

See `09_Templates/` in the sample vault for full schemas.

---

## Architecture

- **Language:** TypeScript, Node.js 20+
- **Build:** compiled to CJS via `tsc`
- **Dependencies:** `commander` (CLI), `fuse.js` (keyword search), `gray-matter` (frontmatter), `chalk` (colors), `@xenova/transformers` (embeddings — Phase 3)
- **Git:** shells out to `git` and `gh` — no JS git library
- **Config:** `~/.kb/config.json` (vault path, author name)
- **Per-vault state:** `.kb/vectors.json` (Phase 3), `.kb/session.json` (active branch)

Design goals: zero manual setup, no API key, no per-token cost (uses the user's Claude Code subscription).

Full design: see [architecture.md](architecture.md) and [project-plan.md](project-plan.md).

---

## Install (for development)

```bash
git clone https://github.com/v-yatskin/vibe-discovery-kb-tool
cd kb-tool
npm install
npm run build
npm link   # makes `kb` available globally
```

Verify:

```bash
kb --version
kb --help
```

To test against the sample vault:

```bash
cd fixtures/task-tracker-vault
kb status
```

---

## Install (for end users)

```bash
curl -fsSL https://raw.githubusercontent.com/v-yatskin/vibe-discovery-kb-tool/main/scripts/install.sh | bash
```

The installer clones into `~/.kb/app`, installs dependencies, builds, and links `kb` globally. Requires Node 20+ (bail with instructions if missing).

After install, run `kb init` (once Phase 1 ships) to create a new vault. For now, clone an existing vault directly.

The end-user README lives in the vault repo — see `README.md` in the sample vault for the flow teammates will follow.

---

## Repository layout

```
kb-tool/
├── src/
│   ├── commands/          # one file per `kb <command>`
│   ├── entities/          # schema definitions + validators
│   ├── git/               # git + gh wrappers
│   ├── search/            # fuse + embeddings
│   └── index.ts           # CLI entry
├── fixtures/
│   └── task-tracker-vault/    # sample vault for dev + tests
├── scripts/
│   └── install.sh         # (Phase 5)
├── .claude/
│   ├── CLAUDE.md          # instructions for Claude Code in this repo
│   └── commands/          # slash commands
├── architecture.md
├── execution-plan.md
├── project-plan.md
└── user-journey.md
```

---

## Contributing

This is a small internal tool maintained by the TaskFlow team. If you're on the team:

1. Open an issue describing the change
2. Branch from `main` — use `feat/<topic>` or `fix/<topic>`
3. `npm run build && npm test` before pushing
4. Open a PR, get one review, squash-merge

The CLI surface is deliberately small. Before adding a command, check whether the behavior belongs in a slash command (AI-guided, lives in `.claude/commands/`) instead — that's usually the right layer.

---

## License

Internal. Not for distribution outside the team.
