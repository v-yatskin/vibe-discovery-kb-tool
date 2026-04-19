Review a feature spec from an engineering-feasibility perspective before it hits grooming.

1. If the user didn't specify a feature, run `kb list features` and ask which one
2. Read the feature file from `06_Features/`
3. Read every file referenced in `linked_problems`, `linked_insights`, `linked_decisions`, `linked_initiatives`
4. Read any linked data snapshots from `11_Data/` (if present)
5. Produce a critique in this structure:

```
FEATURE: [title]

## Understanding
[1-2 sentences — what the feature does, grounded in the linked problem]

## Technical assessment
- **Complexity:** low | medium | high — with 1-2 sentences why
- **Dependencies:** [services, data, integrations touched]
- **Unknowns:** [things that need a spike or prototype]

## Scope flags
- **Could cut:** [what's not essential to validate the hypothesis]
- **Should clarify:** [ambiguous acceptance criteria, missing edge cases]

## Evidence strength
- Linked problem: [is it well-validated? how many insights/experiments?]
- Any orphan claims in the spec that aren't backed by vault evidence?

## Risks
[sequencing risks, data migrations, auth/permissions gotchas, mobile/web parity]

## Questions for the engineering team
1. [...]
2. [...]
3. [...]
```

6. End by asking: "Want me to add the open questions to the feature file as a new section, or create a ceremony note for the next grooming?"

Guardrails:
- Don't guess at system architecture if `08_Integrations/` doesn't cover it — flag as unknown instead
- Cite source files for every claim
- If critical linked files are missing (e.g., feature has `figma_url: ""`), call it out at the top — grooming isn't useful without them
