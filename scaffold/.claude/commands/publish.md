The user wants to publish drafts to the vault. This is Phase 2 — triggered only by the user.

1. Run `kb list drafts` — show everything pending in 00_Drafts/
2. If multiple drafts, ask: "Which ones should I publish? All of them, or specific ones?"
3. Pre-flight check on each draft before starting:
   - Feature with no linked_problems → "Which user problem does this solve?"
   - Feature with no figma_url → "Do you have a Figma link yet?"
   - Insight with no source → "Where did this come from?"
   - Insight with no linked_problems → "Which open problem does this relate to?"
4. Once confirmed, open a local session branch (no remote push yet):
   `kb branch --open [topic]`
5. For each draft: `kb publish [filename]`
   - Each accepted file is committed locally to the session branch
   - No push happens during this step — commits stay local
6. When all done: `kb branch --close`
   - This is where ALL remote operations happen, in sequence:
     1. `git push -u origin [branch]` — creates remote branch with all commits at once
     2. `gh pr create --title "feat: [topic]" --body "[artifact list + checklist]"` — opens PR
     3. `gh pr merge --squash --delete-branch` — merges on GitHub
     4. `git checkout main && git pull` — syncs local main
7. Confirm what landed: "Published and merged: [list of files]. Visible on GitHub."
