import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface VaultFile {
  path: string;
  filename: string;
  folder: string;
  frontmatter: Record<string, any>;
  content: string;
}

export const FOLDER_MAP: Record<string, string> = {
  problem: '01_Problems',
  insight: '02_Insights',
  experiment: '03_Experiments',
  decision: '04_Decisions',
  initiative: '05_Initiatives',
  feature: '06_Features',
  'meeting-note': '07_Meeting-Notes',
  integration: '08_Integrations',
  ceremony: '10_Ceremonies',
  draft: '00_Drafts',
};

export const ALL_CANONICAL_FOLDERS = [
  '01_Problems',
  '02_Insights',
  '03_Experiments',
  '04_Decisions',
  '05_Initiatives',
  '06_Features',
  '07_Meeting-Notes',
  '08_Integrations',
  '10_Ceremonies',
];

export function readFolder(vaultPath: string, folder: string): VaultFile[] {
  const folderPath = path.join(vaultPath, folder);
  if (!fs.existsSync(folderPath)) return [];

  const files = fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'));

  return files.map((filename) => {
    const filePath = path.join(folderPath, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    return {
      path: filePath,
      filename,
      folder,
      frontmatter: data,
      content,
    };
  });
}

export function readAllCanonical(vaultPath: string): VaultFile[] {
  return ALL_CANONICAL_FOLDERS.flatMap((folder) =>
    readFolder(vaultPath, folder)
  );
}
