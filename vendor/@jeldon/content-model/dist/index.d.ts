import { z } from 'zod';
import { DomainPack } from '@jeldon/config';

/**
 * The ONE frontmatter codec.
 *
 * BoH had this logic implemented three times — `src/lib/admin/frontmatter.ts`
 * (the rich parser/serializer), the `astro.config.mjs` sitemap-scan filter, and
 * `scripts/publish-scheduled.mjs` (a lossy line-split that read raw string
 * values and re-stringified everything). The publish cron's variant is what
 * caused the `audioBodyLength: "10772"` round-trip bug that killed whole content
 * builds. This module is the single source; `publishScheduled()` and any sitemap
 * filter import it instead of re-implementing.
 *
 * Faithful port of `src/lib/admin/frontmatter.ts`. Supports strings, booleans,
 * numbers, ISO dates (as strings), and string arrays. No YAML dependency — the
 * source kept the Workers bundle small and we preserve that.
 *
 * The codec is value-preserving: unknown frontmatter keys round-trip unchanged,
 * which is how out-of-band writers (audio generation, newsletter automation)
 * can stamp fields the editor never models.
 */
type FrontmatterValue = string | boolean | number | string[];
type Frontmatter = Record<string, FrontmatterValue>;
interface ParsedDoc {
    frontmatter: Frontmatter;
    body: string;
}
/** Split a raw markdown document into typed frontmatter + body. */
declare function parse(raw: string): ParsedDoc;
/** Coerce a single raw scalar from the frontmatter source. Exposed so the
 *  publish cron and any other consumer heal numerics identically. */
declare function parseValue(v: string): FrontmatterValue;
/** Re-emit a parsed document. Numbers/booleans serialize bare; ISO dates and
 *  short lowercase enums stay bare; everything else is double-quoted. */
declare function serialize({ frontmatter, body }: ParsedDoc): string;

/**
 * The article lifecycle state machine.
 *
 * Ported from `src/lib/articles.ts::articleStatus` + `getStubArticles` +
 * `getPublishedArticles`, plus the canonical five-way table in BoH CLAUDE.md.
 * The combination of `draft` + `docReviewed` + `ready` + `scheduled` defines an
 * article's lifecycle:
 *
 *   draft | docReviewed | ready | scheduled | status
 *   ------+-------------+-------+-----------+------------
 *   true  | false       | false | false     | draft
 *   true  | true        | false | false     | docReviewed
 *   true  | (any)       | true  | false     | ready
 *   true  | (any)       | (any) | true      | scheduled
 *   false | (any)       | (any) | (any)     | live
 *
 * `docReviewed` is the editorial-handoff state. Whether it's surfaced at all is
 * a per-domain choice (`pack.content.lifecycle.docReviewed`) — a project with no
 * separate review role collapses it back into plain `draft`.
 */
type LifecycleStatus = 'draft' | 'docReviewed' | 'ready' | 'scheduled' | 'live';
/** The four lifecycle booleans an article carries in frontmatter. */
interface LifecycleFlags {
    draft?: boolean;
    docReviewed?: boolean;
    ready?: boolean;
    scheduled?: boolean;
}
interface LifecycleOptions {
    /** When false (default), `docReviewed: true` is reported as plain `draft`. */
    docReviewedEnabled?: boolean;
}
/**
 * Resolve an article's lifecycle status from its flags. Precedence mirrors
 * `articleStatus` (live > scheduled > ready) with the `docReviewed` rung
 * inserted between ready and draft when the domain enables it.
 */
declare function articleStatus(flags: LifecycleFlags, opts?: LifecycleOptions): LifecycleStatus;
/** Live = published. Mirrors `getPublishedArticles`'s `!draft` predicate. */
declare function isLive(flags: LifecycleFlags): boolean;
/**
 * A "stub" article isn't live yet but should still resolve to a real URL — a
 * "Coming soon" / "Coming on <date>" page so cross-links from live articles
 * don't 404. Mirrors `getStubArticles`: `draft && (ready || scheduled)`. Pure
 * drafts are excluded so work-in-progress titles/strategy never leak publicly.
 */
declare function isStub(flags: LifecycleFlags): boolean;
/** Should the hourly cron consider auto-publishing this article? Only an
 *  explicitly `scheduled` draft is eligible — a plain past-dated draft is
 *  user-managed forever. */
declare function isAutoPublishCandidate(flags: LifecycleFlags): boolean;
/**
 * Filter a list to publicly-published articles. `includeDrafts` unlocks drafts
 * for preview builds (the `INCLUDE_DRAFTS` env flag in BoH); when off in a
 * production context, drafts are dropped. Mirrors `getPublishedArticles`.
 */
declare function selectPublished<T extends LifecycleFlags>(articles: T[], opts?: {
    includeDrafts?: boolean;
}): T[];
/** Filter a list to stub articles (see `isStub`). Mirrors `getStubArticles`. */
declare function selectStubs<T extends LifecycleFlags>(articles: T[]): T[];

/**
 * The article frontmatter schema, built from the Domain Pack.
 *
 * Ported from `src/content/config.ts`. The single piece BoH hardcoded — the
 * `category` enum — is derived here from `content.categories`, killing the
 * "category enum in 4+ places" coupling (the schema, validate-article,
 * check-frontmatter, prompts, and the scorer all read one list now). Author
 * defaults come from `pack.authors[defaultAuthorSlug]`.
 *
 * Returns a Zod object. `z.coerce.date()` parses `YYYY-MM-DD` strings AND the
 * `Date` objects a content layer may already have coerced, so the schema is
 * usable both at parse time (string in) and post-coercion.
 */
interface BuildArticleSchemaOptions {
    /** Override the primary author display name. Defaults to the pack's default
     *  author's profile name. */
    defaultAuthorName?: string;
    /** Override the default author slug. Defaults to `content.defaultAuthorSlug`. */
    defaultAuthorSlug?: string;
}
declare function buildArticleSchema(pack: DomainPack, opts?: BuildArticleSchemaOptions): z.ZodObject<{
    title: z.ZodString;
    excerpt: z.ZodString;
    publishDate: z.ZodDate;
    updatedDate: z.ZodOptional<z.ZodDate>;
    category: z.ZodEnum<[string, ...string[]]>;
    author: z.ZodDefault<z.ZodString>;
    authorSlug: z.ZodDefault<z.ZodString>;
    readTime: z.ZodOptional<z.ZodString>;
    heroImage: z.ZodOptional<z.ZodString>;
    heroImageAlt: z.ZodOptional<z.ZodString>;
    draft: z.ZodDefault<z.ZodBoolean>;
    docReviewed: z.ZodDefault<z.ZodBoolean>;
    docNotes: z.ZodOptional<z.ZodString>;
    ready: z.ZodDefault<z.ZodBoolean>;
    scheduled: z.ZodDefault<z.ZodBoolean>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    series: z.ZodOptional<z.ZodString>;
    audioUrl: z.ZodOptional<z.ZodString>;
    audioBodyHash: z.ZodOptional<z.ZodString>;
    audioBodyLength: z.ZodOptional<z.ZodNumber>;
    audioFileSize: z.ZodOptional<z.ZodNumber>;
    audioGeneratedAt: z.ZodOptional<z.ZodDate>;
    sourceEpisode: z.ZodOptional<z.ZodString>;
    newsletterCampaignId: z.ZodOptional<z.ZodString>;
    newsletterScheduledAt: z.ZodOptional<z.ZodDate>;
    newsletterStatus: z.ZodOptional<z.ZodEnum<["queued", "sent", "cancelled", "error"]>>;
    newsletterError: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    draft: boolean;
    docReviewed: boolean;
    ready: boolean;
    scheduled: boolean;
    title: string;
    excerpt: string;
    publishDate: Date;
    category: string;
    author: string;
    authorSlug: string;
    tags: string[];
    updatedDate?: Date | undefined;
    readTime?: string | undefined;
    heroImage?: string | undefined;
    heroImageAlt?: string | undefined;
    docNotes?: string | undefined;
    series?: string | undefined;
    audioUrl?: string | undefined;
    audioBodyHash?: string | undefined;
    audioBodyLength?: number | undefined;
    audioFileSize?: number | undefined;
    audioGeneratedAt?: Date | undefined;
    sourceEpisode?: string | undefined;
    newsletterCampaignId?: string | undefined;
    newsletterScheduledAt?: Date | undefined;
    newsletterStatus?: "queued" | "sent" | "cancelled" | "error" | undefined;
    newsletterError?: string | undefined;
}, {
    title: string;
    excerpt: string;
    publishDate: Date;
    category: string;
    draft?: boolean | undefined;
    docReviewed?: boolean | undefined;
    ready?: boolean | undefined;
    scheduled?: boolean | undefined;
    updatedDate?: Date | undefined;
    author?: string | undefined;
    authorSlug?: string | undefined;
    readTime?: string | undefined;
    heroImage?: string | undefined;
    heroImageAlt?: string | undefined;
    docNotes?: string | undefined;
    tags?: string[] | undefined;
    series?: string | undefined;
    audioUrl?: string | undefined;
    audioBodyHash?: string | undefined;
    audioBodyLength?: number | undefined;
    audioFileSize?: number | undefined;
    audioGeneratedAt?: Date | undefined;
    sourceEpisode?: string | undefined;
    newsletterCampaignId?: string | undefined;
    newsletterScheduledAt?: Date | undefined;
    newsletterStatus?: "queued" | "sent" | "cancelled" | "error" | undefined;
    newsletterError?: string | undefined;
}>;
type ArticleSchema = ReturnType<typeof buildArticleSchema>;
type ArticleData = z.infer<ArticleSchema>;

interface ValidateArticleResult {
    ok: boolean;
    /** The parsed + defaulted frontmatter when `ok`. */
    data?: ArticleData;
    body?: string;
    errors: Array<{
        path: string;
        message: string;
    }>;
}
/**
 * Validate one article's frontmatter against the pack-derived schema.
 *
 * Consolidates the BoH `validate-article.ts` / `check-frontmatter.mjs` checks
 * that each independently re-stated the category enum. Accepts either a raw
 * markdown string (frontmatter is parsed via the shared codec) or an already
 * separated `{ frontmatter, body }`.
 */
declare function validateArticle(input: string | {
    frontmatter: Record<string, unknown>;
    body?: string;
}, pack: DomainPack, opts?: BuildArticleSchemaOptions): ValidateArticleResult;

/**
 * Auto-publish scheduled articles.
 *
 * Faithful port of `scripts/publish-scheduled.mjs`. The cron flips
 * `draft: true → false` and drops the `scheduled: true` line on any article
 * whose `publishDate` has arrived in the project timezone. The flip is done by
 * scoped regex on the raw text (NOT by re-serializing) so the body and all
 * unknown frontmatter are untouched byte-for-byte — re-emitting through the
 * codec here would needlessly reformat fields the cron has no business
 * rewriting.
 *
 * I/O is behind `ArticleSource` (DECOUPLING-NOTES: "put I/O behind an
 * interface"). `publishScheduled(articles, tz)` is the pure in-memory form; the
 * directory-driven `publishScheduledFromSource` wires it to an `FsArticleSource`
 * (Node) or any custom store.
 */
interface ArticleDoc {
    /** Stable id — a filename in the fs case, a slug or path otherwise. */
    id: string;
    /** Full raw markdown (frontmatter + body). */
    raw: string;
}
interface PublishedArticle {
    id: string;
    publishDate: string;
    /** The rewritten raw markdown to persist. */
    raw: string;
}
interface PublishResult {
    today: string;
    timezone: string;
    scanned: number;
    published: PublishedArticle[];
    /** ids skipped with a human-readable reason (diagnostic parity with the cron). */
    skipped: Array<{
        id: string;
        reason: string;
    }>;
}
/** Render today's date as YYYY-MM-DD in the given timezone so a publishDate of
 *  "2026-05-12" goes live at local midnight, not UTC midnight. */
declare function todayInZone(timezone: string, now?: Date): string;
/**
 * The named entry point. Pure: takes the articles already in memory and the
 * project timezone (`pack.content.timezone`), returns which ones flip to live
 * and their rewritten text. The caller persists the `published[].raw`.
 */
declare function publishScheduled(articles: ArticleDoc[], timezone: string, now?: Date): PublishResult;
/** Read/write source for articles. The default is `FsArticleSource`; a Store
 *  (GitHub, etc.) can implement the same shape. */
interface ArticleSource {
    list(): Promise<ArticleDoc[]> | ArticleDoc[];
    write(id: string, raw: string): Promise<void> | void;
}
/** In-memory source — the null default. Handy for tests and dry runs. */
declare class MemoryArticleSource implements ArticleSource {
    private docs;
    constructor(docs: ArticleDoc[]);
    list(): ArticleDoc[];
    write(id: string, raw: string): void;
}
/** Scan a source, publish due articles, persist the rewrites. */
declare function publishScheduledFromSource(source: ArticleSource, timezone: string, now?: Date): Promise<PublishResult>;

/**
 * Filesystem-backed `ArticleSource` — the default I/O adapter for the publish
 * cron, ported from `scripts/publish-scheduled.mjs`'s `readdir`/`readFile`/
 * `writeFile` against `src/content/articles`. Node-only.
 */
declare class FsArticleSource implements ArticleSource {
    private dir;
    constructor(dir: string);
    list(): Promise<ArticleDoc[]>;
    write(id: string, raw: string): Promise<void>;
}

export { type ArticleData, type ArticleDoc, type ArticleSchema, type ArticleSource, type BuildArticleSchemaOptions, type Frontmatter, type FrontmatterValue, FsArticleSource, type LifecycleFlags, type LifecycleOptions, type LifecycleStatus, MemoryArticleSource, type ParsedDoc, type PublishResult, type PublishedArticle, type ValidateArticleResult, articleStatus, buildArticleSchema, isAutoPublishCandidate, isLive, isStub, parse, parseValue, publishScheduled, publishScheduledFromSource, selectPublished, selectStubs, serialize, todayInZone, validateArticle };
