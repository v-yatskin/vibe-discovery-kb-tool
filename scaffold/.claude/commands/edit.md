Update an existing canonical file safely — copy it back to 00_Drafts/, edit, publish in place.

1. If the user didn't specify which file, ask — or run `kb list [type]` / `kb search` to help narrow down.
2. Run `kb edit [path or slug]` — this copies the canonical file to `00_Drafts/YYYY-MM-DD-edit-[slug].md` and records the edit source internally.
3. Tell the user: "Edit-draft at 00_Drafts/[filename] — make your changes in Obsidian. Say 'publish' when ready and I'll update the canonical file in place (with a diff preview)."
4. STOP. Do not open a branch. Do not run kb publish. Wait for the user to finish editing.
5. When the user says publish, run `kb branch --open edit-[slug]` (if no session is already open), then `kb publish [draft-filename]`. `kb publish` detects it's an edit-draft and shows a frontmatter diff before committing. It commits as `update: ...` (not `publish: ...`).
6. `kb branch --close` to push + PR + merge as usual.

Guardrails:
- **Never edit canonical files directly.** Always go through `kb edit` so the change is tracked, diffed, and committed atomically.
- If the user asks you to change a single frontmatter field without editing the body, it's often simpler to use `kb link` (for linked_* arrays) or `kb retire` (for status → archived). Offer those as alternatives.
- If the edit-draft sits in 00_Drafts/ for more than a few sessions, remind the user: "You have an open edit on X from [days ago] — still want to publish it?"
