/**
 * Small helpers around @jeldon/schema-graph for this site's URL layout.
 * Jeldon publishes articles at /articles/; this site uses /blog/, so the
 * Article node is rebased. (Making that prefix configurable is an engine
 * change — noted in docs/JELDON.md.)
 */
import { articleGraph, breadcrumbList, extractFaqs, faqPage } from '@jeldon/schema-graph';
import { pack, authorEntries, categoryLabel } from './pack';
import type { Article } from './content';

const ARTICLE_PREFIX = '/blog/';

function rebase(node: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(node).replaceAll('/articles/', ARTICLE_PREFIX));
}

export function articleJsonLd(article: Article, body: string): Record<string, unknown>[] {
  const d = article.data;
  const nodes: Record<string, unknown>[] = [
    rebase(
      articleGraph(
        {
          title: d.title,
          slug: article.id,
          excerpt: d.excerpt,
          publishDate: d.publishDate,
          updatedDate: d.updatedDate,
          category: d.category,
          categoryLabel: categoryLabel(d.category),
          author: d.author,
          authorSlug: d.authorSlug,
          tags: d.tags,
          heroImage: d.heroImage,
          heroImageAlt: d.heroImageAlt,
          sourceEpisode: d.sourceEpisode,
        },
        authorEntries,
        pack,
      ) as Record<string, unknown>,
    ),
    breadcrumbList(
      [
        { name: 'Home', url: '/' },
        { name: 'Blog', url: ARTICLE_PREFIX },
        { name: d.title, url: `${ARTICLE_PREFIX}${article.id}/` },
      ],
      pack.brand.siteUrl,
    ) as Record<string, unknown>,
  ];
  const faqs = extractFaqs(body);
  if (faqs.length >= 2) nodes.push(faqPage(faqs) as Record<string, unknown>);
  return nodes;
}

export function crumbs(items: { name: string; url: string }[]): Record<string, unknown> {
  return breadcrumbList([{ name: 'Home', url: '/' }, ...items], pack.brand.siteUrl) as Record<string, unknown>;
}

export function faqJsonLd(faqs: { question: string; answer: string }[]): Record<string, unknown> | null {
  if (faqs.length < 2) return null;
  return faqPage(faqs.map((f) => ({ q: f.question, a: f.answer }))) as Record<string, unknown>;
}
