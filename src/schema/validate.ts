export interface ValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  problem: ['type', 'title', 'created', 'author'],
  insight: ['type', 'title', 'created', 'author', 'confidence', 'source'],
  experiment: ['type', 'title', 'created', 'author'],
  decision: ['type', 'title', 'created', 'author'],
  initiative: ['type', 'title', 'created', 'author'],
  feature: ['type', 'title', 'created', 'author'],
  'meeting-note': ['type', 'date', 'attendees'],
  integration: ['type', 'title', 'created', 'author', 'partner'],
  ceremony: ['type', 'ceremony_type', 'date'],
};

const VALID_ENUMS: Record<string, Record<string, string[]>> = {
  problem: {
    status: ['open', 'validated', 'solved'],
    severity: ['low', 'medium', 'high'],
  },
  insight: { confidence: ['low', 'medium', 'high'] },
  experiment: { status: ['planned', 'running', 'concluded'] },
  decision: { status: ['proposed', 'decided', 'superseded'] },
  initiative: {
    status: ['idea', 'planned', 'in_progress', 'done'],
    priority: ['low', 'medium', 'high'],
  },
  feature: { status: ['idea', 'spec', 'in-dev', 'shipped', 'archived'] },
  integration: { status: ['planned', 'in-dev', 'live', 'deprecated'] },
  ceremony: {
    ceremony_type: ['grooming', 'sprint-planning', 'retrospective', 'review'],
  },
};

function isEmpty(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function isTemplatePlaceholder(val: unknown): boolean {
  // e.g. "low | medium | high" — unedited template value
  return typeof val === 'string' && val.includes('|');
}

export function validate(
  type: string,
  frontmatter: Record<string, any>
): ValidationResult {
  const required = REQUIRED_FIELDS[type] || ['type', 'title'];
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of required) {
    const val = frontmatter[field];
    if (isEmpty(val) || isTemplatePlaceholder(val)) {
      missing.push(field);
    }
  }

  const enums = VALID_ENUMS[type] || {};
  for (const [field, allowed] of Object.entries(enums)) {
    const val = frontmatter[field];
    if (!val || isTemplatePlaceholder(val)) continue; // already caught above or not set
    if (!allowed.includes(String(val))) {
      invalid.push(`${field}: "${val}" — valid values: ${allowed.join(', ')}`);
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}
