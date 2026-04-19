Propose and apply links between vault entities.

1. If the user has a specific pair in mind ("link onboarding-drop-off to no-native-triggers"), skip to step 4.
2. Otherwise, invoke the `link-finder` subagent on the file the user specifies (or asks about). It searches the vault for candidate related entities and proposes additions.
3. Walk through proposals with the user — highest match first. For each, ask: "Add this link?"
4. For each confirmed pair, run: `kb link [source] [target]` — this updates the source's `linked_*` frontmatter, regenerates the `## Links` section, and commits locally.
5. If multiple links are added in one session, they accumulate as local commits. Say "publish" or "let's push" when done, and run `kb branch --close`.

When the user asks "what links are missing on X?":
- Invoke `link-finder` on X
- Present proposals
- Don't apply anything until confirmed

Guardrails:
- **Never add a link without confirmation.** `kb link` writes to canonical files; user approves each.
- **Don't link files to themselves.** The tool refuses, but don't even propose it.
- **Match target type to the right field.** `kb link` handles this automatically, but if you're writing frontmatter by hand (don't — use `kb link`), remember: linking to a problem means adding to `linked_problems`, etc.
- **Broken-link cleanup:** if the user asks to remove a link (target was retired, target doesn't exist), currently you'd do this via `kb edit` — open the source, delete the slug from the frontmatter array, publish. (A `kb unlink` may come later.)
