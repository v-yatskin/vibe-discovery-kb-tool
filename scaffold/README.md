# {{PRODUCT_NAME}} Product Discovery Vault

> The team's shared knowledge base for problems, insights, decisions, and roadmap.
> Runs on `kb` (a small CLI) + Claude Code + Obsidian. Nothing else to learn.

Start here: [Home.md](Home.md) — vault purpose, team, structure.

---

## What you'll install

| Tool | What it does | Required? |
|---|---|---|
| `kb` | CLI that manages this vault (drafts, publishing, git flow) | Yes |
| Claude Code | Desktop app — your primary interface. Talks to `kb` for you. | Yes |
| Obsidian | Markdown editor — browse + refine files visually | Yes |
| `gh` CLI | GitHub CLI — used by `kb` to open/merge PRs | Yes |
| Node.js 20+ | Runtime for `kb` | Auto-installed |

**You will never run a terminal command after setup.** Claude Code runs everything for you.

---

## Install (one time, ~10 minutes)

### 1. Install `kb`

```bash
curl -fsSL https://raw.githubusercontent.com/v-yatskin/vibe-discovery-kb-tool/main/scripts/install.sh | bash
```

### 2. Install `gh` CLI and log in

```bash
brew install gh
gh auth login
```

### 3. Install Claude Code and Obsidian

- Claude Code: https://claude.ai/code
- Obsidian: https://obsidian.md

### 4. Clone this vault

```bash
git clone [VAULT_REPO_URL] ~/Documents/{{VAULT_NAME}}
```

### 5. Open both apps on this folder

- **Claude Code:** drag the `{{VAULT_NAME}}` folder in as a project.
- **Obsidian:** "Open folder as vault" → pick `{{VAULT_NAME}}`.

### 6. (Optional) Sync `_files/` with OneDrive

`_files/` is where PDFs, decks, and other binaries live. It's gitignored — git is poor at binaries, so OneDrive handles sync instead. Run:

```bash
cd ~/Documents/{{VAULT_NAME}}
kb files --link
```

`kb` auto-detects OneDrive on your Mac, prompts to pick an account if there's more than one, asks for a folder name, and creates the symlink. One-time setup per teammate.

If a teammate already shared a specific OneDrive folder with you, pass the path:

```bash
kb files --link "$HOME/Library/CloudStorage/OneDrive-YourOrg/TheSharedFolder"
```

That's it. Put Claude Code on the left, Obsidian on the right.

---

## Your first session

Open Claude Code in the vault. Type `/resume`. Claude pulls the latest and tells you what's new.

---

## Daily slash commands

| Command | What it does |
|---|---|
| `/resume` | Pull latest, load last session. **Always run this first.** |
| `/draft` | Start a new draft — problem, insight, experiment, decision, feature, or initiative |
| `/publish` | Publish all pending drafts to the team |
| `/compress` | End the session — saves a session log |
| `/gap-analysis` | Find disconnected knowledge (orphan insights, initiatives without problems, etc.) |

You can also just talk. "What do we know about power users?" works.

---

## What you never have to do

- Open a terminal (after install)
- Run `git pull`, `git push`, or any git command
- Remember `kb` command syntax
- Copy-paste between Claude Code and Obsidian
- Configure anything

Claude handles all of it.

---

## When things go wrong

| Symptom | Fix |
|---|---|
| Claude Code doesn't know about `kb` | Check `.claude/CLAUDE.md` exists in this folder. If not, re-clone. |
| `kb: command not found` | New terminal tab, or `source ~/.zshrc`. |
| `gh auth status` says not logged in | `gh auth login`, pick GitHub.com, browser flow. |
| Obsidian shows raw markdown | `Cmd+E` toggles reading view. |
| Merge conflict | Claude will tell you which file and walk you through it. |

---

## Team conventions

- **One entity per file**
- **Confidence levels are honest** — `low` if it's a hunch, `high` only if validated
- **Every insight links to a problem** — orphan insights are noise
- **Decisions cite their evidence** — which insights/experiments drove them
- **Drafts stay in `00_Drafts/` until they're ready**
