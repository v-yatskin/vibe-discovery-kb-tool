import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Session } from './session';

export interface ArchiveEntryOptions {
  action: 'publish' | 'update';
  canonicalRel: string;        // e.g. "02_Insights/power-users-use-zapier.md"
  fm: Record<string, any>;
  changedFields?: string[];    // for 'update' action
  session: Session | null;
}

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

function buildBody(opts: ArchiveEntryOptions): string {
  const { action, canonicalRel, fm, changedFields, session } = opts;
  const type = String(fm.type || 'file');
  const title = String(fm.title || path.basename(canonicalRel, '.md'));
  const slug = path.basename(canonicalRel, '.md');

  const lines: string[] = [];

  if (action === 'publish') {
    lines.push(`Published **${type}**: ${title}.`);
  } else {
    const fields = changedFields && changedFields.length > 0
      ? ` — changed ${changedFields.join(', ')}`
      : '';
    lines.push(`Updated **${type}**: ${title}${fields}.`);
  }

  // Wikilink to the canonical file so Obsidian backlinks work
  lines.push('');
  lines.push(`[[${slug}]]`);

  if (session?.pr_url) {
    lines.push('');
    lines.push(`PR: ${session.pr_url}`);
  } else if (session?.branch) {
    lines.push('');
    lines.push(`Branch: ${session.branch}`);
  }

  return lines.join('\n');
}

export function writeArchiveEntry(
  vaultPath: string,
  opts: ArchiveEntryOptions
): string {
  const archiveDir = path.join(vaultPath, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const slug = path.basename(opts.canonicalRel, '.md');
  const date = today();
  const filename = `${date}-${opts.action}-${slug}.md`;
  const entryPath = path.join(archiveDir, filename);

  const frontmatter: Record<string, any> = {
    type: 'archive-entry',
    action: opts.action,
    canonical: opts.canonicalRel,
    title: String(opts.fm.title || slug),
    date,
  };
  if (opts.changedFields && opts.changedFields.length > 0) {
    frontmatter.changed_fields = opts.changedFields;
  }
  if (opts.session?.branch) frontmatter.session_branch = opts.session.branch;
  if (opts.session?.pr_url) frontmatter.pr_url = opts.session.pr_url;

  const body = buildBody(opts);
  fs.writeFileSync(entryPath, matter.stringify(body, frontmatter), 'utf-8');
  return path.relative(vaultPath, entryPath);
}
