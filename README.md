# kb-tool (vibe-discovery)

> AI-assisted product discovery knowledge base for small teams (PM + Designer + BA). The team talks to Claude Code, browses in Obsidian, and never touches a terminal after install.

```
Chat → Draft → Human Edit → Publish (commit) → Canonical Knowledge → AI Retrieval
```

---

## What this solves

- Insights scatter across Notion, Slack, and local docs
- Roadmaps drift out of sync with the research that justified them
- Newcomers have no single place to learn *why* past decisions were made
- AI outputs aren't reusable across the team

---

## Status

**v1 + v2 complete.** All 9 planned phases shipped.

### What's live

| Area | Done |
|---|---|
| `kb init` + `kb init --upgrade` | ✅ Phase 1 — scaffolds a fresh vault from `scaffold/` with placeholder substitution |
| `kb updates --generate` + post-merge hook | ✅ Phase 2 — auto-runs on `git pull`, writes `Updates-Log/*.md` |
| `kb index` + semantic search | ✅ Phase 3 — all-MiniLM-L6-v2 embeddings, hybrid keyword+semantic via RRF |
| Slash commands `/roadmap` `/preserve` `/engineer-critique` `/spec-writer` | ✅ Phase 4 — scaffolded by `kb init` / `--upgrade` |
| `scripts/install.sh` | ✅ Phase 5 — clone + build + link |
| `kb publish` wikilink auto-generation + 7 seeded `.base` files + `/graph` | ✅ Phase 7 — Obsidian bases as primary team UI, auto-generated `## Links` sections |
| `11_Data/`, `_files/`, `_private/` + `kb snapshot` + `kb files --link` | ✅ Phase 8 — data snapshots, OneDrive-synced binaries, personal workspace |
| `kb edit` + `kb link` + `kb retire` + 3 subagents + `/edit /link /curate` | ✅ Phase 9 — safe updates, link management, retirement with backlink warnings |
| Core CLI (`draft`, `publish`, `list`, `status`, `search`, `branch`) | ✅ PoC |
| Sample vault | ✅ [vibe-disco-vault-test](https://github.com/v-yatskin/vibe-disco-vault-test) — realistic TaskFlow team data |

### Backlog

| Area | Target |
|---|---|
| Compiled binary (`bun build --compile`) | Phase 6 (optional, no-Node install) |
| `/inbox-process` slash command | Batch-publish all pending drafts in 00_Drafts/ |
| `kb ui` local web dashboard | Standup/stakeholder views |
| `kb sync` with Obsidian Sync headless mode | Alternative to git for non-engineers |

See [`docs/execution-plan.md`](docs/execution-plan.md) for the full phase history and remaining backlog.

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
2. **Processing** — `kb publish` validates frontmatter against entity schemas, moves file to canonical folder, auto-generates `## Links` section
3. **Storage** — markdown with typed frontmatter, one entity per file, append-only; Obsidian bases for live filtered views
4. **Retrieval** — `kb search` (hybrid fuse.js + semantic embeddings via RRF) + Claude reads files directly

### Entity schemas

| Type | Folder | Required fields |
|---|---|---|
| `problem` | `01_Problems/` | title, severity, status |
| `insight` | `02_Insights/` | title, confidence, linked_problems |
| `experiment` | `03_Experiments/` | title, hypothesis, result |
| `decision` | `04_Decisions/` | title, reasoning, linked_evidence |
| `initiative` | `05_Initiatives/` | title, status, priority, linked_problems |
| `feature` | `06_Features/` | title, status, linked_initiative |
| `data-snapshot` | `11_Data/<date-slug>/snapshot.md` | title, date, source |

See `scaffold/templates/` for full template definitions.

---

## Planning & design docs

All design thinking lives in [`docs/`](docs/):

| File | Purpose |
|---|---|
| [`docs/project-plan.md`](docs/project-plan.md) | Full PRD — objective, problems, architecture, data model, commands, workflow, build status |
| [`docs/architecture.md`](docs/architecture.md) | Technical architecture — repo layout, entity schemas, command specs, git model, slash command specs |
| [`docs/execution-plan.md`](docs/execution-plan.md) | Phased roadmap with time estimates — all 9 phases shipped |
| [`docs/phase-2-plan.md`](docs/phase-2-plan.md) | v2 design — Obsidian bases & wikilinks, extended folders, update & curation flows, subagents |
| [`docs/user-journey.md`](docs/user-journey.md) | End-to-end walkthrough of Anna (Designer) — install, capture, publish, query, session end |
| [`docs/reddit.html`](docs/reddit.html) | Reference material: community knowledge-system patterns that informed the design |

---

## Install (end users)

```bash
curl -fsSL https://raw.githubusercontent.com/v-yatskin/vibe-discovery-kb-tool/main/scripts/install.sh | bash
```

The installer clones into `~/.kb/app`, installs dependencies, builds, and links `kb` globally. Requires Node 20+ (the script exits with install instructions if missing).

After install, run `kb init` to scaffold a fresh vault from scratch — it prompts for vault path, product name, author, and team, then creates the full folder structure, templates, `.claude/` slash commands, `.gitignore`, and writes `~/.kb/config.json`. For existing PoC vaults, `kb init --upgrade` adds any missing folders, slash commands, subagents, Obsidian config, and backfills `## Links` sections on canonical files without touching your edits.

The end-user walkthrough lives in the vault repo — see `README.md` in [vibe-disco-vault-test](https://github.com/v-yatskin/vibe-disco-vault-test) for the flow teammates will follow.

---

## Install (development)

```bash
git clone https://github.com/v-yatskin/vibe-discovery-kb-tool
cd vibe-discovery-kb-tool
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
git clone https://github.com/v-yatskin/vibe-disco-vault-test.git ~/vault-test
cd ~/vault-test
kb status
```

---

## Architecture

- **Language:** TypeScript, Node.js 20+
- **Build:** compiled to CJS via `tsc`
- **Dependencies:** `commander` (CLI), `fuse.js` (keyword search), `gray-matter` (frontmatter), `chalk` (colors), `@xenova/transformers` (embeddings — Phase 3), `ora` (spinners)
- **Git:** shells out to `git` and `gh` — no JS git library
- **Config:** `~/.kb/config.json` (vault path, author name)
- **Per-vault state:** `.kb/vectors.json` (semantic index), `.kb/session.json` (active branch), `.kb/pending-edits.json` (kb edit tracking), `.kb/model/` (cached embedding model)

Design goals: zero manual setup, no API key, no per-token cost (uses the user's Claude Code subscription).

Full design: [`docs/architecture.md`](docs/architecture.md).

---

## Repository layout

```
vibe-discovery-kb-tool/
├── src/
│   ├── commands/          # one file per `kb <command>` (init, draft, publish, edit, link, retire, ...)
│   ├── config/            # ~/.kb/config.json read/write + CWD-aware vault detection
│   ├── schema/            # frontmatter validators per entity type
│   ├── search/            # embed (transformer.js) + vectors (cosine + diff)
│   ├── vault/             # git helpers, reader, session, wikilinks, edits
│   └── index.ts           # CLI entry
├── scaffold/              # seed files copied by `kb init`
│   ├── templates/         # 9 entity templates
│   ├── .claude/           # CLAUDE.md + slash commands + subagents (with {{placeholders}})
│   ├── .obsidian/         # app.json with team-friendly defaults
│   ├── Bases/             # 7 starter .base files for Obsidian
│   ├── _private/README.md
│   ├── Home.md
│   ├── README.md
│   └── .gitignore
├── scripts/
│   └── install.sh
├── docs/                  # planning / design docs
├── package.json
└── README.md
```

---

## Related repos

- **[vibe-disco-vault-test](https://github.com/v-yatskin/vibe-disco-vault-test)** — sample vault with realistic TaskFlow team data, committed `.claude/` slash commands, and working `.obsidian/` config. Clone it to see a populated vault in action.

---

## Contributing

Small internal tool. If you're on the team:

1. Open an issue describing the change
2. Branch from `main` — `feat/<topic>` or `fix/<topic>`
3. `npm run build` before pushing (no test suite yet)
4. Open a PR, get one review, squash-merge

The CLI surface is deliberately small. Before adding a command, check whether the behavior belongs in a slash command (AI-guided, `.claude/commands/` → `scaffold/.claude/commands/`) or a subagent (`.claude/agents/`) instead — that's usually the right layer.

---

## License

Internal. Not for distribution outside the team.
