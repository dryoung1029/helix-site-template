/**
 * Collection helpers. Lifecycle rules (draft / stub / live) come from
 * @jeldon/content-model so the site never re-implements them.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { isLive, isStub } from '@jeldon/content-model';

export type Article = CollectionEntry<'articles'>;
export type Program = CollectionEntry<'programs'>;
export type Coach = CollectionEntry<'coaches'>;
export type Faq = CollectionEntry<'faqs'>;

const includeDrafts = process.env.INCLUDE_DRAFTS === 'true';

function flags(a: Article) {
  return { draft: a.data.draft, docReviewed: a.data.docReviewed, ready: a.data.ready, scheduled: a.data.scheduled };
}

export async function getPublishedArticles(): Promise<Article[]> {
  const all = await getCollection('articles');
  return all
    .filter((a) => includeDrafts || isLive(flags(a)))
    .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());
}

export async function getStubArticles(): Promise<Article[]> {
  const all = await getCollection('articles');
  return all.filter((a) => isStub(flags(a)));
}

export async function getPrograms(): Promise<Program[]> {
  const all = await getCollection('programs');
  return all.filter((p) => includeDrafts || !p.data.draft).sort((a, b) => a.data.order - b.data.order);
}

export async function getCoaches(): Promise<Coach[]> {
  const all = await getCollection('coaches');
  return all.filter((c) => includeDrafts || !c.data.draft).sort((a, b) => a.data.order - b.data.order);
}

export async function getFaqsFor(page: string): Promise<Faq[]> {
  const all = await getCollection('faqs');
  return all.filter((f) => f.data.pages.includes(page)).sort((a, b) => a.data.order - b.data.order);
}

export function estimateReadTime(body: string | undefined): string {
  const words = (body ?? '').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });
}
