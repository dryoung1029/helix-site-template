/**
 * The Domain Pack (jeldon.config.ts), loaded once at build time. Every page
 * reads content-engine values from here — never a literal.
 */
import { loadDomainPack, type DomainPack } from '@jeldon/config';

export const pack: DomainPack = await loadDomainPack();

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Author entries in the shape the schema-graph builders consume. */
export const authorEntries = pack.authors.map((a) => ({
  slug: a.slug,
  name: a.name,
  schemaId: a.schemaId,
}));
