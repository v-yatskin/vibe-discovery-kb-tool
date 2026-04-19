Load context at the start of a session.

1. Run: `git pull` (get latest from teammates)
2. Read Session-Logs/ — load the last 3 session summaries (if any exist)
3. Read .claude/CLAUDE.md — load vault context and product memory
4. Brief the user in plain language:
   - What was happening in the last session (if session log exists)
   - Any pending tasks from last session
   - Current vault state: open problems, planned initiatives, upcoming ceremonies
5. If git pull brought in new commits: summarize what changed ("Viktor added 2 new insights")
6. Ready to work.

Usage:
  /resume       — last 3 sessions
  /resume 10    — last 10 sessions
  /resume recurring  — last 3 sessions + search vault for "recurring"
