# _private/

Your personal workspace alongside the vault. **Anything you drop here stays local — it never ships to the team.**

Good uses:
- Stakeholder emails and threads you want to reference
- Personal scratch notes, meeting prep, 1:1 notes
- Financials, salary discussions, or anything sensitive
- Draft thoughts you may never publish
- WIP Claude agent configs before promoting to `.claude/agents/`

Organize this folder however you like — no imposed structure.

## Rules

- **Contents never get committed.** The `.gitignore` excludes everything in here except this README.
- **Never promoted to canonical knowledge directly.** If something in here should become an insight, problem, decision, etc., ask Claude to draft it — then it goes through `kb publish` like any other entity (with schema validation and team review).
- **Not synced across devices.** Unlike `_files/` (which syncs via OneDrive), `_private/` lives only on the machine where you wrote it. If you want it on another device, copy manually.
