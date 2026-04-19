# {{PRODUCT_NAME}} — Product Discovery Vault

> The single source of truth for what we're building, why, and what we've learned.
> Talk to Claude Code. Browse in Obsidian. Never open a terminal.

---

## What this vault is

This is the **product discovery knowledge base** for {{PRODUCT_NAME}}. Everything the team learns — problems, insights, experiments, decisions, features, roadmap — lives here as structured markdown.

It exists because:
- Insights from interviews and data used to scatter across Notion, Slack, and local docs
- Roadmaps drifted out of sync with the research that justified them
- Newcomers had no single place to learn *why* past decisions were made

The vault is **append-only knowledge**. Nothing is lost. Every decision links back to the evidence that drove it.

---

## The team

{{TEAM_TABLE}}

All teammates write to this vault. All teammates query it through Claude Code.

---

## How knowledge flows

```
Chat with Claude  →  Draft  →  Edit in Obsidian  →  Publish (commit)  →  Canonical knowledge
```

1. **Capture** — tell Claude what you learned. It creates a draft in `00_Drafts/`.
2. **Refine** — edit the draft in Obsidian until it's right.
3. **Publish** — say "publish" to Claude. It validates, commits, opens a PR, merges.
4. **Retrieve** — ask Claude anything. It reads the vault and answers with citations.

You never touch git. You never run a `kb` command yourself. Claude does both.

Full workflow walkthrough: [[README]].

---

## Vault structure

| Folder | Contains |
|---|---|
| `00_Drafts/` | Work-in-progress (gitignored, personal) |
| `01_Problems/` | User or business problems we want to solve |
| `02_Insights/` | Validated learnings from research or data |
| `03_Experiments/` | Hypotheses we tested + results |
| `04_Decisions/` | Explicit choices + reasoning |
| `05_Initiatives/` | Roadmap units (planned work) |
| `06_Features/` | Feature specs ready for engineering |
| `07_Meeting-Notes/` | Raw notes from team meetings |
| `08_Integrations/` | External tool / API specs |
| `09_Templates/` | Entity templates used by `kb draft` |
| `10_Ceremonies/` | Planning / retro / grooming docs |
| `archive/` | Retired entities (not deleted, just moved) |

---

## Conventions

- **One entity per file.** Filename is the slug of the title.
- **Frontmatter is the schema.** Every canonical file has typed fields (type, status, confidence, links).
- **Confidence is explicit.** `low / medium / high` on every insight.
- **Links are explicit.** Problems link to insights, initiatives link to problems, features link to initiatives.
- **Nothing is deleted.** Retired entities move to `archive/`.

---

## Getting started

New teammate? Read [[README]] — it covers install, the two-phase workflow, and what you never have to do.

Returning? Open Claude Code and type `/resume`.
