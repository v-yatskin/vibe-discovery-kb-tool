Find disconnected knowledge in the vault. Run autonomously — no input needed.

1. `kb list problems --status open`
   → check each has at least one linked insight
   → flag any with empty linked_insights: []

2. `kb list problems --status open`
   → check each has at least one linked experiment or decision
   → flag problems that are validated with no linked decision

3. `kb list insights`
   → check each has at least one linked problem
   → flag any floating insights not connected to any problem

4. `kb list initiatives`
   → check each has at least one linked problem
   → flag initiatives with no clear problem basis

5. `kb list features`
   → check each has a linked initiative
   → check each has a non-empty figma_url (if status is spec or later)
   → flag features with no initiative or no Figma

6. Report gaps clearly:

```
GAP ANALYSIS — [date]

Problems with no insights: [N]
  - [filename] — no research linked yet

Insights with no problem: [N]
  - [filename] — floating, not connected to any open problem

Initiatives with no problem: [N]
  - [filename] — why does this initiative exist?

Features with no initiative: [N]
  - [filename] — what's the strategic context?

Features missing Figma: [N]
  - [filename] — needed before estimation
```

7. Ask: "Want me to draft the missing links, or flag them in the files for review?"
