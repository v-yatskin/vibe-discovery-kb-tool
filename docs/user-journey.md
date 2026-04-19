# kb-tool — Detailed User Journey

> **Persona:** Anna. Designer on the product team. Has a Mac, uses Obsidian, has a Claude.ai Pro subscription.
> **The two UIs:** Claude Code (for doing things) + Obsidian (for browsing files). Nothing else.

---

## Part 0 — Every Session Start

Anna opens Claude Code in `~/Documents/ProductVault`. Types:

> /resume

Claude reads the last 3 session logs from `Session-Logs/` + `CLAUDE.md`:

> Last session: April 18, you were structuring the Triggered Notifications feature spec. Pending: link it to the notification-fatigue problem. Viktor added 2 new insights yesterday (pulled). Vault: 8 open problems, 3 planned initiatives.

Then runs `git pull` silently. Anna is oriented in 5 seconds — no re-explaining context.

---

## Part 1 — Installation (one time, ~10 minutes)

Viktor sends Anna a Slack message:

> "Anna, two things to install, then you're set:"

---

### Step 1: Install kb and Claude Code

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/kb-tool/main/scripts/install.sh | bash
```

```
→ Checking Node.js... not found.
→ Installing nvm... ✓
→ Installing Node.js 20... ✓
→ Installing kb... ✓

Done. Now install Claude Code: https://claude.ai/code
```

Anna installs Claude Code (the desktop app, not the terminal). Signs in with her Claude.ai subscription.

---

### Step 2: Clone the vault

```bash
git clone https://github.com/your-org/product-vault.git ~/Documents/ProductVault
```

```
→ Cloning vault... ✓  (54 files)

The vault already contains .claude/ — Claude Code will
automatically know how to work with this vault.
```

---

### Step 3: Open Claude Code in the vault

Anna opens Claude Code. Drags the `ProductVault` folder into it as the project.

That's it. Claude Code reads `.claude/CLAUDE.md` automatically. It now knows:
- What the vault is
- All the `kb` commands
- The workflow rules (pull before answering, publish before pushing)
- All entity schemas

No configuration. No API keys. No onboarding doc to read.

---

### Step 4: Open Obsidian alongside

Anna opens Obsidian, points it at `~/Documents/ProductVault`. She puts Claude Code on the left half of her screen, Obsidian on the right.

This is her permanent workspace. She doesn't change it.

```
┌────────────────────────┬────────────────────────┐
│   Claude Code          │   Obsidian             │
│                        │                        │
│   (do things here)     │   (browse files here)  │
│                        │                        │
└────────────────────────┴────────────────────────┘
```

---

## Part 2 — Querying the Vault

Anna just talks to Claude Code. Claude runs `kb` commands and reads vault files directly — Anna never touches the terminal.

---

### "What's new since yesterday?"

Viktor opens Claude Code in the morning, runs:

> /updates

The post-merge hook already wrote `Updates-Log/2026-04-19-0900.md` when he pulled. Claude reads it:

> Yesterday Anna merged PR #12 (delayed-messages):
> - New feature page: delayed-messages
> - 2 new insights about async comms and admin panel timing
> - Added to grooming April 22
>
> Also: her Figma link is still empty — might be worth checking before grooming.

Viktor: *put the grooming on my task list and remind me to review the Figma when it's added*

Claude adds to Viktor's `/compress` pending tasks.

---

### "What's the next feature on our roadmap?"

Anna types in Claude Code:

> what's next on the roadmap?

Claude runs:
```bash
kb list initiatives --status planned
```

Reads the output, responds:

> Next up: **Triggered Notifications** (high priority, Viktor). Then Search Redesign (medium) and Mobile Push v2 (low). Triggered Notifications is linked to the notification fatigue problem and backed by the Zapier workaround insight Anna added last week.
>
> btw — Viktor updated the Triggered Notifications feature 2 days ago (Figma link added). Worth checking before your next estimation.

---

### "Why do we have a skip button on onboarding?"

A new engineer asks Anna this. She opens Claude Code and types:

> why does the skip onboarding button exist?

Claude reads relevant files in `04_Decisions/` and `03_Experiments/` directly, responds:

> Added after a March experiment showing 23% drop-off at onboarding step 3. Users who skipped had higher 7-day retention. The decision traded complete profile data for lower friction. Source: `04_Decisions/remove-mandatory-profile-step.md`

Anna forwards the answer. 20 seconds total.

---

### "What do we know about our power users?"

> what do we know about power users?

Claude searches the vault files, synthesizes across multiple documents:

> Three things in the vault:
> 1. **Insight** — power users use Zapier as a workaround for automated notifications (Anna, Apr 19, medium confidence)
> 2. **Insight** — power users skip tutorial step 3 and self-discover features (Viktor, Mar 12, high confidence)
> 3. **Problem** — no native trigger/automation system for rule-based workflows (open, high severity)
>
> Combined: your power users are self-directed, workaround-heavy, and blocked by missing automation. The Triggered Notifications initiative is the direct response.

---

## Part 3 — Creating a New Feature (Two-Phase Flow)

Anna is a designer. The PM told her to design a "Delayed Messages" feature for the admin panel. She opens Claude Code.

The workflow has two distinct phases: **capture** (no git, no branch) and **publish** (all git happens at once at close).

---

### Phase 1 — Capture (no git)

Anna types:

> I got a task from PM to design the delayed messages feature for the admin panel.

Claude creates a draft — no branch, no commit, nothing touches git:

```bash
kb draft --type feature --title "delayed-messages"
# → writes 00_Drafts/2026-04-19-delayed-messages.md
```

Claude responds:

> Draft created at `00_Drafts/2026-04-19-delayed-messages.md` — review it in Obsidian.
>
> Do you already have research insights to capture alongside this?

Anna pastes her interview transcripts. Claude creates 2 more drafts:

```bash
kb draft --type insight --title "users-want-async-timezone-comms"
kb draft --type insight --title "admin-panel-send-timing-bottleneck"
```

Claude responds:

> 3 drafts ready in 00_Drafts/. Review them in Obsidian — edit anything that needs adjusting.
>
> Say "publish" or "looks good" when you're ready to commit them.

Anna edits in Obsidian (fills in the feature's user story, links the insights to each other, sets confidence levels). Comes back:

> looks good, publish these

---

### Phase 2 — Publish (triggered by user)

Claude runs the pre-flight check first:

> Before I publish — the feature has no Figma link yet (`figma_url: ""`). Do you have one, or should I leave it blank?

Anna: *leave it blank, I'll add it later*

Claude opens a **local** branch and commits each file locally:

```bash
kb branch --open delayed-messages
# → git checkout -b kb/2026-04-19-delayed-messages  (local only)

kb publish 2026-04-19-delayed-messages.md
# → validates, moves to 06_Features/, git commit (local)

kb publish 2026-04-19-users-want-async-timezone-comms.md
# → validates, moves to 02_Insights/, git commit (local)

kb publish 2026-04-19-admin-panel-send-timing-bottleneck.md
# → validates, moves to 02_Insights/, git commit (local)
```

Then closes — this is where everything goes remote:

```bash
kb branch --close
# → git push -u origin kb/2026-04-19-delayed-messages
# → gh pr create --title "feat: delayed-messages" --body "[artifact list]"
# → gh pr merge --squash --delete-branch
# → git checkout main && git pull
```

Claude responds:

> Merged. PR contained:
> - 06_Features/delayed-messages.md
> - 02_Insights/users-want-async-timezone-comms.md
> - 02_Insights/admin-panel-send-timing-bottleneck.md
>
> Viktor and Max will see all of this on their next pull.

---

## Part 4 — Git Sync (How the Team Stays Up to Date)

### When does Claude pull?

**At the start of every Claude Code session.** CLAUDE.md instructs Claude to run `git pull` as its first action in any new conversation. This means:
- Anna opens Claude Code in the morning → vault is immediately up to date
- No manual `git pull` ever needed

The post-merge hook runs automatically on pull:
- `kb updates --generate` → writes `Updates-Log/` with what teammates merged
- `kb index --quiet` → re-embeds any new files for semantic search

```
Anna opens Claude Code
  └─ Claude runs: git pull
       └─ "Pulled 3 new files from Viktor. Viktor merged feat: triggered-notifications
           (Figma link added). Vault is up to date."
```

Once per session is enough. Not per-question — that would be slow and noisy.

---

### When does Claude push?

**Only when closing a publish session.** All work accumulates locally and goes remote in one shot:

```
User triggers publish: "publish these", "looks good", "commit it"
  └─ Claude runs: kb branch --open [topic]
       └─ git checkout -b kb/[date]-[topic]  (local only)

Each publish
  └─ Claude runs: kb publish [filename]
       └─ git commit  (local only — nothing on remote yet)

User confirms done
  └─ Claude runs: kb branch --close
       └─ git push -u origin [branch]  (all commits land at once)
       └─ gh pr create --title "feat: [topic]" --body "[full summary]"
       └─ gh pr merge --squash --delete-branch
       └─ git checkout main && git pull
```

Teammates see all of Anna's work on their next `git pull`. The PR shows exactly what changed and why.

**During capture (drafting), nothing is ever pushed.** Drafts stay in `00_Drafts/` (gitignored) until the user explicitly says to publish.

---

### What about conflicts?

**Near-impossible by design:**

- `00_Drafts/` is gitignored — personal workspace, never shared, never conflicts
- Canonical files (`01_Problems/` through `05_Initiatives/`) are one file per entity, named by slug
- Two people rarely touch the same file — they create new ones

**The only realistic conflict:** Viktor edits `01_Problems/onboarding-drop-off.md` while Anna is also editing it. This requires both people to open, edit, and push the *same file* at the same time — very unlikely in a 3-person team.

**If it does happen:**

`git pull` fails with conflict markers. Claude detects this, but **does not attempt to auto-resolve** — semantic content (frontmatter, link arrays, numbered reasoning) is too easy to corrupt with a wrong merge.

Claude responds:

> There's a conflict in `01_Problems/onboarding-drop-off.md`. Open that file in Obsidian — you'll see `<<<<<<<` markers showing your version and Viktor's version. Pick the right content by hand (or combine both), delete the `<<<<<<<`/`=======`/`>>>>>>>` marker lines, save. Then tell me "resolved" and I'll finish the merge commit for you.

The user decides what the content should say; Claude handles the git mechanics around it. This keeps canonical knowledge trustworthy — nothing merges into the vault that a human didn't explicitly approve.

---

## Part 5 — Ending a Session

Anna is done for the day. She types:

> /compress

Claude asks:

> What should I tag this session? (topics, e.g. "triggered-notifications, user-research")

Anna: *triggered, zapier insight, spec review*

Claude writes `Session-Logs/2026-04-19-1430-triggered.md`:

```markdown
# Session: 2026-04-19 14:30 — triggered-notifications

## Quick Reference
Topics: triggered-notifications, user-research, zapier-workaround
Outcome: captured insight from Marcus interview, linked to no-native-trigger problem

## Decisions Made
- Confidence set to medium pending quantitative validation

## Files Created
- 02_Insights/power-users-use-zapier-for-notification-triggers.md

## Pending Tasks
- [ ] Check how many users have Zapier connected (data request to Max)
- [ ] Link triggered-notifications initiative to this insight
```

> Session saved. Run /resume next time to reload this.

Anna closes Claude Code. Next time she opens it, `/resume` puts her right back here.

---

## Summary — The Complete Loop

```
Morning
  └─ Open Claude Code → Claude pulls, summarizes what teammates merged overnight

Question comes up in a meeting
  └─ Ask Claude Code → Claude runs kb search, reads relevant files → answers with citations

Learn something new (interview, data, observation)
  └─ Tell Claude Code what you learned
  └─ Claude opens branch + draft PR, runs kb draft, fills in Obsidian
  └─ Claude runs kb publish, links entities, merges PR when done

Weekly planning
  └─ /roadmap → Claude runs kb list commands + kb search, synthesizes priorities
  └─ Saves as new initiative file if asked

Check vault health
  └─ /gap-analysis → Claude finds disconnected knowledge, prompts to fix
  └─ Ask "what's open?" → Claude runs kb list
```

---

## What Anna never has to do

- Open a terminal
- Remember `kb` command syntax
- Run `git pull`, `git push`, or any git command
- Copy-paste anything between tools
- Configure anything after the initial install
- Think about the search index — it updates on every pull
- Remember which folder each entity type lives in

**She just talks to Claude Code and edits in Obsidian. Everything else is under the hood.**
