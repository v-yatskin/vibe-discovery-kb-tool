Summarize what teammates merged since the user's last pull.

1. Read the most recent file in `Updates-Log/` (files are named `YYYY-MM-DD-HHMM.md`)
2. If the user asks for more context ("since last week", "everything today"), read several
3. Summarize in plain language, not by dumping the raw log:
   - How many new commits and from whom
   - Which entities were added vs updated (group by folder / type)
   - Anything notable: new high-severity problems, initiatives that changed status, features that got Figma links

Example output:

> Since your last pull (2h ago), Anna merged 3 commits:
> - Added the **delayed-messages** feature spec (06_Features/)
> - Added 2 new insights about async communication and admin-panel timing
> - The Figma link on delayed-messages is still empty — might be worth checking before grooming.

4. Ask: "Want to dig into any of these?"

If `Updates-Log/` is empty or missing, say "No updates logged yet — either this is your first session, or you haven't pulled since the post-merge hook was installed." Don't fabricate.
