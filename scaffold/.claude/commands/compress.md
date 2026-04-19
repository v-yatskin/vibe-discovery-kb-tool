Save a structured session log before closing.

1. Ask the user: "What topics should I tag this session with?"
2. Create Session-Logs/YYYY-MM-DD-HH-MM-[topic].md with:

```markdown
# Session: [date] [time] — [topic]

## Quick Reference
Topics: [tags]
Outcome: [1-line summary of what was accomplished]

## Decisions Made
- [list any decisions reached]

## Files Created or Modified
- [list files touched this session]

## Pending Tasks
- [ ] [things left to do]
```

3. Save to Session-Logs/ (this folder is gitignored — personal only, never shared)
4. Confirm: "Session saved. Run /resume next time to reload this context."
