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
| `kb publish` | ✅ validates schema, moves file, local commit |
| `kb list [type]` | ✅ colored table, plural aliases, `--status` filter |
| `kb status` | ✅ entity counts, git state, pending drafts |
| `kb search` | ✅ hybrid — fuse.js keyword + semantic (all-MiniLM-L6-v2) via RRF fusion |
| `kb index` + `kb index --diff` | ✅ Phase 3 — embeds canonical files into `.kb/vectors.json`, content-hash diff |
| `kb branch --open / --close / --status` | ✅ full two-phase git flow (push + `gh pr create` + `gh pr merge` + `git pull`) |
| Sample vault | ✅ lives in separate repo: [vibe-disco-vault-test](https://github.com/v-yatskin/vibe-disco-vault-test) |
| `.claude/CLAUDE.md` + slash commands (scaffolded into every new vault by `kb init`) | ✅ `/draft`, `/publish`, `/resume`, `/compress`, `/gap-analysis`, `/updates`, `/roadmap`, `/preserve`, `/engineer-critique`, `/spec-writer` |
| `kb init` + `kb init --upgrade` | ✅ Phase 1 — scaffolds a fresh vault from `scaffold/` with placeholder substitution |
| `kb publish` wikilink auto-generation | ✅ Phase 7 — auto-appends `## Links` section with `[[wikilinks]]` from frontmatter, idempotent |
| `kb base --list` + 7 seeded `.base` files | ✅ Phase 7 — Obsidian live filtered views (open-problems, active-initiatives, high-confidence-insights, my-drafts, recent-decisions, orphan-insights, stale-initiatives) |
| `/graph [entity]` slash command | ✅ Phase 7 — text summary of the link graph around an entity |
| `scripts/install.sh` | ✅ clone + build + link |

### In progress / not started

| Area | Target |
|---|---|
| `kb updates --generate` + post-merge hook | ✅ Phase 2 — auto-runs on `git pull`, writes `Updates-Log/*.md` |
| Slash commands `/roadmap` `/preserve` `/engineer-critique` `/spec-writer` | ✅ Phase 4 — scaffolded by `kb init` / `kb init --upgrade` |
| Compiled binary (`bun build --compile`) | Phase 6 (optional) |

Estimated remaining effort: **~10h v1 + ~10h v2** — see `execution-plan.md` in the [planning repo](https://github.com/v-yatskin/vibe-discovery).

---

## How it works

### Two-phase git model

```
Draft phase          Publish phase (triggered by user)
─────────────        ──────────────────────────────────
kb draft             kb branch --open   → local branch
  ↓                  kb publish × N     → local commits
00_Drafts/           kb branch --close  → push + PR + merge + pull
(gitignored)                             (atomic: all work lands together)
```

**Nothing is pushed until the user says to close the session.** This eliminates merge conflicts by construction — drafts never leave the user's machine.

### Layers

1. **Input** — Claude Code conversation → `kb draft`
2. **Processing** — `kb publish` validates frontmatter against entity schemas, moves file to canonical folder
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

Full design lives in the planning repo: [vibe-discovery](https://github.com/v-yatskin/vibe-discovery) (see `architecture.md` and `project-plan.md`).

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

To test against the sample vault, clone it separately:

```bash
git clone https://github.com/v-yatskin/vibe-disco-vault-test.git ~/vault-test
cd ~/vault-test
kb status
```

---

## Install (for end users)

```bash
curl -fsSL https://raw.githubusercontent.com/v-yatskin/vibe-discovery-kb-tool/main/scripts/install.sh | bash
```

The installer clones into `~/.kb/app`, installs dependencies, builds, and links `kb` globally. Requires Node 20+ (bail with instructions if missing).

After install, run `kb init` to scaffold a fresh vault from scratch — it prompts for vault path, product name, author, and team, then creates the full folder structure, templates, `.claude/` slash commands, `.gitignore`, and a `~/.kb/config.json`. For existing PoC vaults, `kb init --upgrade` adds any missing folders or slash commands without touching existing files.

The end-user README lives in the vault repo — see `README.md` in the sample vault for the flow teammates will follow.

---

## Repository layout

```
kb-tool/
├── src/
│   ├── commands/          # one file per `kb <command>` (init, draft, publish, ...)
│   ├── config/            # ~/.kb/config.json read/write
│   ├── schema/            # frontmatter validators per entity type
│   ├── vault/             # folder + git helpers
│   └── index.ts           # CLI entry
├── scaffold/              # seed files copied by `kb init`
│   ├── templates/         # 9 entity templates
│   ├── .claude/           # CLAUDE.md + 5 slash commands (with {{placeholders}})
│   ├── Home.md
│   ├── README.md
│   └── .gitignore
├── scripts/
│   └── install.sh
├── package.json
└── README.md
```

Planning docs (`architecture.md`, `project-plan.md`, `execution-plan.md`, `user-journey.md`) live in the [vibe-discovery](https://github.com/v-yatskin/vibe-discovery) repo.

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
