Preserve an important learning in `.claude/CLAUDE.md` under "Product context (always-on memory)" so it's loaded in every session.

1. Ask: "What should I preserve?" (if not already clear from context)
2. Rephrase the user's answer into a terse, factual bullet — one line, past-tense or present, no hedging:
   - Good: "Key insight: Users who create subtasks have 40% higher 7-day retention"
   - Bad: "It seems like maybe users who do subtasks are retained more"
3. Show the proposed bullet and where it will go:
   > I'll add this under "Product context (always-on memory)" in .claude/CLAUDE.md:
   > - **Key insight:** [...]
4. On confirm, commit the change through the normal publish flow:
   - `kb branch --open preserve-[short-slug]`
   - Edit `.claude/CLAUDE.md` — append or update the bullet under the right subheading
   - `kb branch --close` → push + PR + merge

5. Confirm: "Preserved. Everyone will see this on their next `git pull` / `/resume`."

Good memories to preserve:
- Biggest open problem (the #1 thing the team is trying to solve)
- Key insight (something validated that changes how the team thinks)
- Active initiative (what's shipping next and why)
- Upcoming ceremony (grooming, planning, retro dates)
- Long-standing decisions that affect daily choices ("we're web-first until Q3")

Keep the memory section under ~10 bullets. If it's getting long, prune outdated ones — ask the user which bullets have gone stale before removing.

Never preserve:
- Transient task lists
- Session-specific context (use /compress instead)
- Personal notes or sensitive info (use `_private/` once Phase 8 ships)
