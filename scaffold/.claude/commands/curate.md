Run a weekly-ish vault health sweep. Surfaces orphan insights, stale initiatives, broken links, lingering drafts, and schema gaps.

1. Invoke the `vault-curator` subagent. It produces a prioritized report.
2. Walk through the top 3 actions with the user. For each, offer to fix it immediately:
   - Orphan insight → `/link` (invokes link-finder to propose linked_problems)
   - Stale initiative → `/roadmap` to reassess priority, or `kb retire` if it's dead
   - Broken wikilink → `kb edit` on the source to remove or correct the link
   - Old draft → publish via `/publish` or delete
3. For anything the user defers ("skip for now"), note it in the session log via `/compress`.

Cadence:
- Run weekly (suggested: Friday EOD or Monday start)
- Run before major ceremonies (sprint planning, grooming)
- Run after a big bulk import (if someone dumped 20 drafts, curate before merging)

Guardrails:
- **Don't fix silently.** Every fix goes through the user (kb link, kb retire, kb edit — all with confirmation).
- **The point is orientation, not perfectionism.** 10 orphan insights isn't a disaster — it's the normal backlog of a working vault. Focus on the top 3.
- **Respect "ignore" decisions.** If the user says "this experiment is old but we're keeping it unretired for historical record", don't re-flag it next run. (You can note it in CLAUDE.md via `/preserve` if it's a recurring exception.)
