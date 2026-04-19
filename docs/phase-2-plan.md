# Phase 2 Plan — Obsidian Integration, Extended Structure, Curation Flows

> Extends the PoC from a capture-and-retrieve tool into a team-curated knowledge system with live Obsidian views, room for binaries and data snapshots, a personal workspace, and safe update flows.
>
> Reads as: **what we're adding, why, how**. Links to `execution-plan.md` for sequenced phases with time estimates.

---

## Why extend now

The PoC answers: *"how do I capture and publish knowledge?"*

It does **not** yet answer:
- *"how do I browse the vault visually when I don't know what I'm looking for?"* → **Obsidian bases + backlinks**
- *"where do I put PDFs, decks, and Figma exports?"* → **`_files/` (OneDrive-synced)**
- *"where do I keep data snapshots that justify a decision?"* → **`11_Data/`**
- *"where do I keep stakeholder emails and personal additions without sharing?"* → **`_private/`**
- *"how do I update an insight without creating a second copy?"* → **`kb edit` + edit-in-drafts flow**
- *"how do I prevent junk from creeping in as the team grows?"* → **Guardrails, review subagents, curation pass**

---

## Area 1 — Obsidian Integration

### What Obsidian gives us for free

| Feature | Why we care |
|---|---|
| **Bases** (1.9+) | `.base` files = saved filters over the vault with live table/card views. **Primary team list UI.** |
| `[[wikilinks]]` + backlinks | Every entity auto-discovers related entities in the "Linked mentions" panel |
| Graph view | Visualize problem/insight/initiative connections at a glance |
| Properties panel | Frontmatter becomes a structured editing UI (no YAML syntax errors) |
| Tags | Cross-cutting grouping that doesn't fit the folder hierarchy |
| Canvas | Visual whiteboards for workshop/ideation sessions |

We currently use **none** of these. Phase 7 fixes that.

### 7.1 Bases become the primary list UI

**The big shift:** bases replace `kb list` as the team's canonical way to browse entities.

- `kb list` still exists, but it's an internal/programmatic interface — used by Claude when fetching data, not something Claude surfaces to teammates
- Every list-style question ("what's open?", "show me high-confidence insights", "which initiatives are stale?") gets answered with "see the `X` base in Obsidian" + a 1–2 line summary
- Claude never dumps a `kb list` table into chat when a base covers the same query

Why: a static table in chat rots by the time you finish reading it. A base in Obsidian is live, filterable, and one click away.

**Starter bases seeded by `kb init`:**

| Base | Filter | Who uses it |
|---|---|---|
| `open-problems.base` | `type == "problem" AND status == "open"` | PM during roadmap planning |
| `active-initiatives.base` | `type == "initiative" AND status IN ("planned", "in_progress")` | Everyone weekly |
| `high-confidence-insights.base` | `type == "insight" AND confidence == "high"` | Decision-making |
| `my-drafts.base` | folder == `00_Drafts/` | Daily |
| `recent-decisions.base` | `type == "decision"` sorted by date desc, limit 20 | New joiners |
| `orphan-insights.base` | `type == "insight" AND linked_problems is empty` | Curation |
| `stale-initiatives.base` | `status == "in_progress" AND updated < 30d ago` | Retros |

Entities inside a base are still plain `.md` files in their canonical folder — bases are just saved views over them.

**Commands:**

```
kb base --list              # list all bases in Bases/
kb base --create [name]     # interactive: prompt for filter, emit .base file
kb base --show [name]       # run the filter, print matches (parity with what Obsidian shows)
```

Non-engineers mostly never touch these — they click the base in Obsidian's left sidebar.

### 7.2 Wikilinks everywhere

**Today:** `linked_problems: [onboarding-drop-off]` in frontmatter. No `[[wikilink]]` in the body. Obsidian's backlink graph is empty.

**Change:** `kb publish` auto-inserts a **"Links"** section at the bottom of the canonical file with `[[wikilinks]]` derived from frontmatter:

```markdown
## Links

- Linked problems: [[onboarding-drop-off]]
- Linked insights: [[power-users-use-zapier]]
```

Regenerated on every publish — frontmatter stays the source of truth, wikilinks stay in sync.

### 7.3 Search filtering via bases

**Today:** `kb search "zapier"` returns keyword matches across the whole vault.

**Change:** `kb search "zapier" --base active-initiatives` filters results to entities matched by the base before ranking.

Also adds: `kb search "zapier" --in 02_Insights` for quick folder-scoped search.

### 7.4 `/graph` slash command

New command: `/graph [entity]` traces the link graph around a given file — what problems an insight links to, what initiatives pull from that problem, what decisions were made. Text-based summary; Obsidian's graph view does the visual equivalent.

---

## Area 2 — Extended Vault Structure

### New folders

```
ProductVault/
├── 00_Drafts/           ← gitignored (personal workspace)
├── 01_Problems/
├── 02_Insights/
├── 03_Experiments/
├── 04_Decisions/
├── 05_Initiatives/
├── 06_Features/
├── 07_Meeting-Notes/
├── 08_Integrations/
├── 09_Templates/
├── 10_Ceremonies/
├── 11_Data/             ← NEW: data snapshots (CSVs + metadata.md) — tracked
├── _files/              ← NEW: OneDrive-synced binaries (PDFs, decks, images) — gitignored
├── _private/            ← NEW: personal additions (stakeholder emails, notes) — folder tracked, contents gitignored
├── archive/             ← gitignored
├── .obsidian/
│   └── bases/           ← NEW: .base files (seeded by kb init, edited in Obsidian)
└── .claude/
    ├── CLAUDE.md
    ├── commands/        ← committed (team slash commands)
    ├── agents/          ← NEW: committed (team subagents)
    └── agents.private/  ← NEW: gitignored (personal subagents)
```

### 8.1 `_files/` — OneDrive-synced binaries

Purpose: PDFs, PowerPoint decks, Figma exports, customer screenshots, videos — anything binary that markdown entities reference.

**Gitignored entirely.** Git is poor at binaries, and the team already uses OneDrive for file sync. `_files/` lives inside the vault on disk for proximity (a markdown insight can reference `_files/onboarding/customer-screenshots.pdf` with a relative path) but never enters git.

**Sync mechanism:** each teammate points OneDrive at `~/Documents/ProductVault/_files/`. OneDrive handles replication. Git ignores it.

**Naming convention:** `_files/[entity-slug]/[filename]`, mirroring the folder structure of the referring entity by slug so attachments travel mentally with the entity even though git doesn't track the relationship.

**No `kb attach` command** — just drop files in the OneDrive folder. If needed later we can add a thin helper, but the OneDrive-managed flow doesn't require one.

### 8.2 `11_Data/` — data snapshots

Purpose: snapshots of data that decisions depend on. Each snapshot is a folder with a metadata `.md` file and the data itself.

```
11_Data/
└── 2026-04-19-monthly-retention/
    ├── snapshot.md         ← metadata (what, when, source, query used)
    ├── data.csv            ← the data
    └── chart.png           ← optional rendered visualization
```

`snapshot.md` frontmatter:

```yaml
type: data-snapshot
title: "April 2026 monthly retention by cohort"
date: 2026-04-19
source: "Amplitude — query `retention-v3-by-cohort`"
linked_insights: []
linked_decisions: []
confidence: high
```

**New command:**

```bash
kb snapshot --title "monthly retention" --date 2026-04-19
# → creates 11_Data/2026-04-19-monthly-retention/
# → writes snapshot.md template
# → prompts to drop the data file in
```

Why snapshots and not links to Amplitude/Looker? **Preservation.** External dashboards change. The numbers that justified a decision must be reproducible a year later. Markdown + CSV in git gives that.

Snapshots stay tracked (not in `_files/`) because they're small, versionable, and directly referenced by insights/decisions. If a snapshot file ever gets large (>10MB), reconsider individually.

### 8.3 `_private/` — personal additions

A plain folder for anything each teammate wants alongside the vault but doesn't want to share. Examples: stakeholder email threads, PM's personal scratch notes, draft thoughts, meeting prep.

**Folder structure tracked, contents gitignored.** This means:

- `git clone` creates the folder, so every teammate has it without setup
- A single `_private/README.md` is committed explaining the folder's purpose
- Everything else inside `_private/` is gitignored
- Each teammate organizes the folder as they see fit — no imposed subdir skeleton

**`.gitignore` rules:**

```
_private/*
!_private/README.md
```

**Hard rule enforced by `kb publish`:** files under `_private/` can never be published to canonical folders. Attempts error out explicitly. Prevents accidental leaks from the personal workspace into the shared vault.

### 8.4 `.claude/agents/` vs `.claude/agents.private/`

**Team agents (committed):** `.claude/agents/kb-reviewer.md`, `.claude/agents/link-finder.md`. Shared. Versioned.

**Personal agents (gitignored):** `.claude/agents.private/my-coding-helper.md`. Not shared. Lets each person build their own workflow helpers without polluting the team config.

### Complete .gitignore additions

```
# OneDrive-synced binaries — never in git
_files/

# Personal additions — folder tracked, contents gitignored
_private/*
!_private/README.md

# Personal Claude configs
.claude/agents.private/
.claude/skills.private/
.claude/settings.local.json
```

---

## Area 3 — Update & Curation Flows

### The problem

Canonical files are append-only in theory, but reality is messier:
- An insight's confidence graduates from `medium` to `high` after validation
- A problem gets re-scoped
- A feature acquires a Figma link
- A decision gets updated when context changes

Today: the user would manually open `02_Insights/xxx.md` in Obsidian and edit in place. This bypasses `kb publish`'s schema validation. It's also easy to forget to commit, or commit a broken frontmatter.

### 9.1 `kb edit [filename]` — edit-in-drafts flow

```bash
kb edit 02_Insights/power-users-use-zapier.md
# → copies the canonical file back to 00_Drafts/2026-04-19-edit-power-users-use-zapier.md
# → records the source path in .kb/pending-edits.json
# → user edits in Obsidian
```

When the user says "publish" and `kb publish` runs on an edit-draft:
1. Detects it's an edit (not a new entity) from `.kb/pending-edits.json`
2. Validates schema against the new content
3. Shows the user a diff: "these fields changed — confirm?"
4. On accept: overwrites the canonical file, commits with `update: [title] (changed: confidence, source)` message
5. No folder move, no archive — it's an in-place update

### 9.2 `kb link [source] [target]` — safe wikilink updates

```bash
kb link 02_Insights/power-users-use-zapier 01_Problems/no-native-triggers
# → updates frontmatter: linked_problems adds "no-native-triggers"
# → regenerates the "Links" section at the bottom of the file
# → commits: "link: power-users-use-zapier → no-native-triggers"
```

Batch mode: `kb link --suggest [filename]` — Claude (via the `link-finder` subagent) reads the file and proposes candidate links from the vault. User accepts/rejects each.

### 9.3 `kb retire [filename] --reason "..."` — deprecation flow

```bash
kb retire 05_Initiatives/deprecated-roadmap-item.md --reason "merged into triggered-notifications"
# → moves to archive/05_Initiatives/deprecated-roadmap-item.md
# → sets frontmatter status to "archived", writes reason
# → updates any files that linked to it (warns the user)
# → commits: "retire: [title] — [reason]"
```

### 9.4 Subagents

New subagents in `.claude/agents/`:

**`kb-reviewer.md`** — invoked before publish. Reads draft, checks:
- Required fields filled
- Confidence honestly calibrated (flags "high" without `linked_experiments` or `linked_data`)
- Source cited
- At least one linked entity (no orphans)

Produces a critique, **doesn't block** — user decides.

**`link-finder.md`** — given a file, searches the vault for candidate links. "This insight about power users might link to: `no-native-triggers` (high match) and `zapier-workaround-insight` (medium match). Add them?"

**`vault-curator.md`** — runs `/curate` weekly. Surfaces:
- Orphan insights (no `linked_problems`)
- Initiatives stale >30d
- Broken wikilinks (target file renamed/deleted)
- Drafts lingering >14d in `00_Drafts/`
- Inconsistent confidence levels

### 9.5 New slash commands

| Command | What it does |
|---|---|
| `/edit` | Guides the kb edit flow — picks a file, copies to drafts |
| `/link` | Invokes link-finder subagent, proposes links |
| `/curate` | Weekly pass — invokes vault-curator subagent |
| `/graph [entity]` | Text summary of link graph around an entity |
| `/snapshot` | Guides kb snapshot — creates data folder with metadata |

### 9.6 Guardrails

Added to `.claude/CLAUDE.md`:

**Hard rules:**
- Never edit canonical files (01–08, 10–11) directly. Always `kb edit`.
- Never promote a file from `_private/` to canonical without going through `kb publish` (which validates and blocks `_private/` paths).
- **On git conflict, never auto-resolve.** `kb` prints the conflicted paths with resolution instructions, then exits. User resolves manually in their editor, then runs a resume command. Auto-merging semantic content (frontmatter, link arrays) silently corrupts canonical knowledge — too risky.
- Run `kb-reviewer` on every publish by default (can be skipped with `--no-review`).

**Soft guidance:**
- Prefer `kb link` over editing `linked_*` frontmatter manually.
- Prefer `kb retire` over deleting files.
- Run `/curate` at least monthly.

---

## Migration notes

None of this is backwards-incompatible with the PoC vault:

- New folders (`11_Data/`, `_files/`, `_private/`) are additive; existing vaults ignore them until they're created.
- Wikilink auto-insertion on `kb publish` only runs if the new version detects the section is missing — re-publishing an old file adds it; doesn't duplicate.
- `kb edit` relies on `.kb/pending-edits.json` — vaults without it fall back to "treat as new draft".
- Bases are Obsidian-side only; they don't affect file format.

`kb init` gains new prompts but existing vaults keep working under old `init` assumptions until a user runs `kb init --upgrade` (which creates the new folders, seeds default bases, writes `_private/README.md`).

---

## Links

- [execution-plan.md](execution-plan.md) — Phase 7/8/9 scheduling
- [project-plan.md](project-plan.md) — updated vault structure + command list
- Obsidian Bases docs: https://help.obsidian.md/bases
