Synthesize the team's roadmap from initiatives + linked problems/insights.

1. Run `kb list initiatives --status in_progress` and `kb list initiatives --status planned`
2. Run `kb list problems --status open`
3. For each in-progress / planned initiative, read the file and its `linked_problems` / `linked_insights`
4. For each linked problem, check how many insights/experiments support it — this is the evidence strength
5. Produce a prioritized view:

```
NOW (in progress)
  1. [initiative-title] — [linked problem, 1-line] — [evidence: N insights, M experiments]
      ⚠ Gap: [what's missing — Figma link? data snapshot? blocker insight?]

NEXT (planned, high priority)
  ...

LATER (planned, medium/low)
  ...

OPEN PROBLEMS WITH NO INITIATIVE
  - [problem-title] — no initiative yet — [severity]
```

6. End with: what's the most important thing the team should decide next? (e.g. "The Triggered Notifications initiative has the strongest evidence but no Figma — worth prioritizing that before grooming.")

7. Ask: "Want me to dig into any of these, or draft a new initiative for one of the orphan problems?"

Guardrails:
- Cite source files in the output: `05_Initiatives/xxx.md`
- Don't invent priority — use what's in frontmatter, then explain
- Flag inconsistencies (e.g., "in_progress" initiative with no linked problems)
