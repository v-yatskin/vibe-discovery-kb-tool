The user wants to capture a new piece of knowledge. This is Phase 1 — capture only, no committing.

1. Ask what type if not clear: problem / insight / experiment / decision / initiative / feature / meeting-note / integration / ceremony
2. Run: `kb draft --type [type] --title "[title]"`
3. The file is now at `00_Drafts/YYYY-MM-DD-[slug].md` — write content into that file
4. Ask clarifying questions to fill in the fields properly:
   - For insight: what's the source? confidence level? which problem does it link to?
   - For feature: what user problem does it solve? is there a Figma link?
   - For decision: what options were considered? why this one?
5. Write the content into the draft file in 00_Drafts/ — nowhere else
6. Tell the user: "Draft saved at 00_Drafts/[filename] — review it in Obsidian. Say 'publish' when you're happy with it."
7. STOP. Do not open a branch. Do not run kb publish. Wait for the user to come back.
