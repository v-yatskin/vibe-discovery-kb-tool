Create a dated data snapshot — captures the numbers that justified a decision so they're reproducible a year later.

1. Ask what to snapshot if not clear: "What data? (e.g. 'monthly retention by cohort', 'feature adoption — April')"
2. Ask for the date if different from today (default: today)
3. Run `kb snapshot --title "[title]" --date [YYYY-MM-DD]` — creates `11_Data/YYYY-MM-DD-[slug]/snapshot.md`
4. Tell the user: "Snapshot folder created at 11_Data/[dir]/ — drop your data file in there (data.csv or similar). Then edit snapshot.md to fill in Source + What this shows + Caveats."
5. Offer: "Want me to help populate snapshot.md once the data is in place? Just paste the table and I'll draft the metadata."

Guardrails:
- Never invent data values. The snapshot's purpose is preservation — if the user doesn't have the numbers, don't write them.
- Always ask about the source (Amplitude query, Looker URL, CSV export path) — a snapshot without a source is worthless a year from now.
- Default confidence to `medium` unless the user specifies otherwise; bump to `high` only if the data is from a system of record, not a one-off export.
- When the user later links a snapshot to an insight or decision, add the path to that entity's frontmatter: `linked_data: [11_Data/2026-04-19-monthly-retention]` (the folder, not the .md inside).
