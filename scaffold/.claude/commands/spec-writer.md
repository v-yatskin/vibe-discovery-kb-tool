Draft a full feature spec from an initiative + its linked problems/insights.

1. If the user didn't specify, run `kb list initiatives --status planned` and ask which to spec
2. Read the initiative file and every file in its `linked_problems` / `linked_insights`
3. Synthesize what the spec needs to cover before running the draft command:
   - The user problem (cite the linked problem file)
   - The insight(s) that motivate the feature (cite them)
   - The user story
   - Candidate scope (v1 that actually validates the insight, not the full vision)
4. Run `kb draft --type feature --title "[slug]"` — creates `00_Drafts/YYYY-MM-DD-[slug].md`
5. Write the feature content into that draft file. Fill:
   - `linked_problems`, `linked_insights`, `linked_initiatives` — pull from the source initiative + evidence
   - `figma_url: ""` (leave blank unless provided)
   - `## Overview` — 2-3 sentences, what and why (grounded in the linked problem)
   - `## User Story` — classic "As a [persona], I want [capability] so that [outcome]"
   - `## Acceptance Criteria` — 3-5 testable criteria that prove the feature works for the linked insight
   - `## Technical Notes` — only if some came up in linked files (e.g. integration spec, data constraints); otherwise "TBD — see /engineer-critique before grooming"
   - `## Open Questions` — anything the linked evidence doesn't answer; prefer being explicit about unknowns over guessing

6. Tell the user: "Draft ready at `00_Drafts/[filename]` — review it in Obsidian. When it's right, say 'publish' and I'll run `kb publish`. You may also want to run `/engineer-critique` first."

Guardrails:
- Every spec claim must cite a linked file. No hallucinated user research.
- If the initiative has no linked problems → stop, ask the user to link one first. A feature without a problem is vanity.
- If two or more insights conflict → flag the conflict in `## Open Questions`, don't paper over
- Keep the spec terse — engineering reads prose, doesn't skim walls of text
