// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadDomainPack } from '@jeldon/config';
import { parse, isStub } from '@jeldon/content-model';
import { sitemapExcludedArticleUrls, sitemapFilter } from '@jeldon/schema-graph';

// The Domain Pack (jeldon.config.ts) is the single source of the canonical
// host and every content-engine value. Loaded here with the same jiti loader
// the CLI uses, so no build step is needed to read the TS config.
const pack = await loadDomainPack();

/** Blog articles that must stay out of the sitemap: drafts and "coming soon" stubs. */
function articleStubs() {
  const dir = resolve('./src/content/articles');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const slug = file.replace(/\.md$/, '');
    const { frontmatter } = parse(readFileSync(resolve(dir, file), 'utf8'));
    const draft = frontmatter.draft === true;
    out.push({ slug, isDraft: draft || isStub(frontmatter) });
  }
  return out;
}

// Jeldon builds article URLs under /articles/; this site publishes at /blog/.
const excluded = new Set(
  [...sitemapExcludedArticleUrls(articleStubs(), pack.brand.siteUrl)].map((u) => u.replace('/articles/', '/blog/')),
);

export default defineConfig({
  site: pack.brand.siteUrl,
  trailingSlash: 'always',
  // Static site. The one server route (/api/contact) opts out with
  // `export const prerender = false` and runs on Cloudflare Workers.
  output: 'static',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [
    sitemap({
      filter: (page) =>
        sitemapFilter(excluded)(page) &&
        !['/api/', '/thanks/', '/members/', '/privacy/', '/terms/'].some((p) => page.includes(p)),
    }),
  ],
  // The site doesn't use sessions. Without this the Cloudflare adapter wires a
  // KV binding named SESSION and warns on every build.
  session: { driver: 'memory' },
  build: { inlineStylesheets: 'auto' },
  vite: {
    ssr: { external: ['node:fs', 'node:path', 'node:url'] },
  },
});
