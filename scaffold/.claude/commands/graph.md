Trace the link graph around one entity. Text-based summary — use Obsidian's graph view for the visual.

1. Ask which entity if not specified: "Which file? (e.g. `01_Problems/onboarding-drop-off.md` or just `onboarding-drop-off`)"
2. Find the file (search by slug across canonical folders if only the slug was given)
3. Read its frontmatter — collect every `linked_*` array
4. For each linked slug, find and read the target file
5. Also search the vault for files whose frontmatter links BACK to this one (inverse links — what Obsidian calls backlinks)
6. Output a compact text graph, 1–2 levels deep:

```
⚬ 02_Insights/power-users-use-zapier.md  (confidence: high)

  → links out:
    • 01_Problems/no-native-triggers (problem, open)
    • 04_Decisions/triggered-notifications-spec (decision, proposed)

  ← linked from (backlinks):
    • 05_Initiatives/triggered-notifications.md
    • 07_Meeting-Notes/2026-04-17-user-interview-sara.md

  ⚠ Gaps:
    • no linked_experiments — is this high-confidence insight validated with an experiment?
```

7. End with 1 sentence of synthesis ("This insight is well-anchored in problems and pulled into an initiative, but has no experiment backing the 'high' confidence.") and a follow-up question ("Want me to draft an experiment, or open Obsidian's graph view to this node?")

Guardrails:
- Don't invent links. If a frontmatter slug points at a file that doesn't exist, surface it as a broken link.
- Never go more than 2 hops — the purpose is orientation, not a full traversal.
- Always cite paths so the user can click them in Obsidian.
