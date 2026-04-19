// Auto-generates the `## Links` section at the bottom of a canonical file
// from its frontmatter `linked_*` fields. Shared between `kb publish`
// (new entities), `kb init --upgrade` (backfill existing files), and
// `kb link` (add/remove a single link).

export const LINKED_FIELD_LABELS: Record<string, string> = {
  linked_problems: 'Linked problems',
  linked_insights: 'Linked insights',
  linked_experiments: 'Linked experiments',
  linked_decisions: 'Linked decisions',
  linked_initiatives: 'Linked initiatives',
  linked_features: 'Linked features',
  linked_data: 'Linked data',
};

export function buildLinksSection(fm: Record<string, any>): string {
  const lines: string[] = [];
  for (const [field, label] of Object.entries(LINKED_FIELD_LABELS)) {
    const arr = fm[field];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const links = arr
      .map((v) => String(v).trim().replace(/\.md$/, ''))
      .filter(Boolean)
      .map((slug) => `[[${slug}]]`)
      .join(', ');
    if (links) lines.push(`- ${label}: ${links}`);
  }
  if (lines.length === 0) return '';
  return ['## Links', '', ...lines, ''].join('\n');
}

// Append or replace an auto-generated `## Links` block at the end of body.
// Removes any existing `## Links` section (and everything after it) first
// so re-running doesn't duplicate.
export function upsertLinksSection(body: string, fm: Record<string, any>): string {
  const stripped = body.replace(/\n##\s+Links\s*\n[\s\S]*$/m, '\n');
  const newSection = buildLinksSection(fm);
  if (!newSection) return stripped;
  const joiner = stripped.endsWith('\n\n') ? '' : stripped.endsWith('\n') ? '\n' : '\n\n';
  return stripped + joiner + newSection;
}
