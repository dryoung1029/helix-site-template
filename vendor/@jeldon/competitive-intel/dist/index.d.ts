import * as _jeldon_config from '@jeldon/config';
import { CompetitorsConfig, GeoConfig, DomainPack, DraftingConfig } from '@jeldon/config';
export { CompetitorEntry, CompetitorsConfig } from '@jeldon/config';

/**
 * Scanner tuning resolved from the Domain Pack's `competitors` block, with
 * package-local defaults for the knobs the pack contract doesn't carry. Every
 * regex here was a literal in BoH `competitor-scanner.ts` (the HIGH_VALUE_PATTERNS,
 * SKIP_PATTERNS, the vendor fingerprints, the thin-page floor). A non-clinic
 * domain re-points `highValuePatterns` / `skipPatterns` / `templateVendors` via
 * `pack.competitors` and gets the same engine.
 */
interface ScannerConfig {
    /** Regex sources: URL paths where a competitor's marketing positioning lives
     *  (service/treatment/condition/blog pages). Compiled case-insensitively. */
    highValuePatterns: string[];
    /** Regex sources: URL paths to skip when sampling (contact/legal/assets/homepage). */
    skipPatterns: string[];
    /** Named vendor template fingerprints. Each fingerprint is a regex source
     *  matched against the homepage HTML; any hit labels the competitor with the
     *  vendor name. The generic structural heuristic is built-in, not here. */
    templateVendors: Array<{
        name: string;
        fingerprints: string[];
    }>;
    /** Word count below which a sampled page counts as a thin stub. Default 300. */
    thinPageWordFloor: number;
    /** Generic-template heuristic: homepage must be >= this multiple of the
     *  service-page average word count. Default 3. */
    genericHomepageWordRatio: number;
    /** Generic-template heuristic: this fraction of sampled pages must be thin
     *  stubs. Default 0.5. */
    genericThinPageFraction: number;
    /** Min sampled pages before the generic-template heuristic can fire. Default 4. */
    genericMinSampledPages: number;
}
declare function resolveScannerConfig(competitors?: CompetitorsConfig): ScannerConfig;
declare const defaultScannerConfig: ScannerConfig;

/** What `fetchHtml` returns. `via` records whether a JS-rendering proxy
 *  (ScrapingBee) served the page or it came back via plain fetch. */
interface FetchResult {
    ok: boolean;
    status: number;
    finalUrl: string;
    html: string;
    error?: string;
    via: 'proxy' | 'plain';
    /** Proxy error reason when the proxy was tried but fell back to plain fetch. */
    proxyError?: string;
}
/**
 * The network boundary. The scanner never calls `fetch` directly — it reaches
 * through a `Fetcher` so a host can swap in a rendering proxy, a cache, or a
 * test double. `defaultFetcher` (in `fetcher.ts`) wraps global `fetch` with the
 * optional ScrapingBee path, faithfully porting BoH `competitor-scanner.ts::fetchHtml`.
 */
interface Fetcher {
    fetchHtml(url: string): Promise<FetchResult>;
}
type HomepageAudit = {
    url: string;
    finalUrl: string;
    status: number;
    fetchedVia?: 'proxy' | 'plain';
    proxyError?: string;
    htmlBytes: number;
    title: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    lang: string | null;
    viewport: boolean;
    h1: string[];
    h2Count: number;
    wordCount: number;
    imageCount: number;
    imagesWithAlt: number;
    internalLinks: number;
    externalLinks: number;
    ogTags: {
        title: boolean;
        description: boolean;
        image: boolean;
        url: boolean;
        type: boolean;
    };
    twitterTags: {
        card: boolean;
        title: boolean;
        image: boolean;
    };
    favicon: boolean;
    hasBlogHint: boolean;
    hasFaqHint: boolean;
    hasTeamHint: boolean;
    /** GEO ("citability") score for the homepage, computed via @jeldon/core-scoring's
     *  `calculateGeo()` against a markdown-ish projection of the HTML. Same checks
     *  the article scorer uses; same 0-100 scale, driven by `pack.scoring.geo`. */
    geoScore: number;
    geoBadCount: number;
    geoMehCount: number;
};
type SchemaAudit = {
    types: string[];
    raw: unknown[];
    count: number;
    /** Per-type set of populated top-level field names — lets the gap report tell
     *  "Organization exists with full NAP" from "Organization exists but bare". */
    fieldsByType?: Record<string, string[]>;
};
type SitemapAudit = {
    found: boolean;
    url: string | null;
    urlCount: number;
    lastmod: string | null;
};
type RobotsAudit = {
    found: boolean;
    blocksRoot: boolean;
};
type PageSpeedScores = {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
};
type PageSpeedAudit = {
    mobile: PageSpeedScores | null;
    desktop: PageSpeedScores | null;
    lcp: number | null;
    cls: number | null;
    fcp: number | null;
    error?: string;
    partial?: string;
};
type GbpAudit = {
    rating: number | null;
    reviewCount: number | null;
    responseRate: number | null;
    photoCount: number | null;
    hoursComplete: boolean | null;
    category: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    lastReviewAt: string | null;
    error?: string;
};
type SampledPage = {
    url: string;
    title: string | null;
    h1: string[];
    h2: string[];
    excerpt: string;
    schemaTypes: string[];
    wordCount: number;
    h2Count: number;
    internalLinks: number;
    externalLinks: number;
};
/** Aggregate structural signals across the sampled pages. */
type PageStats = {
    count: number;
    avgWordCount: number;
    medianWordCount: number;
    minWordCount: number;
    maxWordCount: number;
    /** Pages < `thinPageWordFloor` words — template-stub signal. */
    thinPageCount: number;
    avgH2Count: number;
    avgInternalLinks: number;
    /** Union of schema types from all sampled pages. */
    sitewideSchemaTypes: string[];
};
/** Detected template/CMS fingerprint, or null. The vendor names come from
 *  config (`pack.competitors.templateVendors`); `generic-template` is the
 *  built-in structural heuristic (polished homepage + thin service pages). */
type TemplateVendor = string | null;
type Positioning = {
    generatedAt: string;
    model: string;
    keywords: Array<{
        phrase: string;
        weight: number;
        intent: 'commercial' | 'informational' | 'navigational' | 'local';
    }>;
    marketingSegments: string[];
    differentiators: string[];
    contentThemes: string[];
    summary: string;
};
type CompetitorAudit = {
    fetchedAt: string;
    homepage: HomepageAudit | null;
    homepageText: string | null;
    schemaOrg: SchemaAudit | null;
    sitemap: SitemapAudit | null;
    robots: RobotsAudit | null;
    pageSpeed: PageSpeedAudit | null;
    gbp: GbpAudit | null;
    pages: SampledPage[];
    pageStats: PageStats | null;
    templateVendor: TemplateVendor;
    positioning: Positioning | null;
    errors: string[];
};
type GapSignal = {
    label: string;
    us: string;
    them: string;
    advantage: 'us' | 'them' | 'tie';
};
type GapReport = {
    summary: string;
    quickWins: Array<{
        action: string;
        rationale: string;
        effort: 'low' | 'medium' | 'high';
    }>;
    contentGaps: Array<{
        suggestedTitle: string;
        targetQuery: string;
        keyPoints: string[];
        category: string;
        priority: 'high' | 'medium' | 'low';
        rationale: string;
    }>;
    gbpGaps: Array<{
        action: string;
        rationale: string;
    }>;
    ourAdvantages: Array<{
        advantage: string;
        howToLeanIn: string;
    }>;
    generatedAt: string;
    model: string;
};
type RankMethod = 'serpapi-local' | 'places';
type KeywordRank = {
    keyword: string;
    /** 1-based position in the results, or null if not in the returned top N. */
    rank: number | null;
    totalReturned: number;
    topCompetitors: Array<{
        name: string;
        rank: number;
        isUs: boolean;
    }>;
    /** Maps competitor id → 1-based rank if seen in the top N, else null. */
    competitorRanks?: Record<string, number | null>;
    sampledAt: string;
    method?: RankMethod;
};
type RanksFile = {
    ranks: Record<string, KeywordRank>;
    lastRun: string | null;
    method?: RankMethod;
    /** The local-pack location string used (SerpApi runs). */
    location?: string;
};
/** I/O boundary for the rolling rank cache (the `keyword-ranks.json` file in
 *  BoH). `FsRanksStore` is the cron default, `NullRanksStore` for tests/dry-runs;
 *  a host backed by GitHub/S3 implements the same two methods. */
interface RanksStore {
    read(): Promise<RanksFile>;
    write(data: RanksFile): Promise<void>;
}
/** API keys + the localized search location for rank tracking. */
interface RankKeys {
    serpapi?: string;
    places?: string;
}

/** Score a competitor HTML page on the same weighted GEO checks articles use.
 *  Reuses @jeldon/core-scoring — we do NOT re-implement the scorer here (the #1
 *  hazard the catalog calls out). `geo` defaults to the canonical health pack
 *  but a host threads `pack.scoring.geo` so a different vertical scores its own way. */
declare function geoScoreHtml(html: string, geo?: GeoConfig): {
    score: number;
    badCount: number;
    mehCount: number;
};
declare function auditHomepage(rawUrl: string, opts: {
    fetcher: Fetcher;
    geo?: GeoConfig;
}): Promise<HomepageAudit | {
    error: string;
}>;
declare function auditSitemap(siteUrl: string): Promise<SitemapAudit>;
declare function auditRobots(siteUrl: string): Promise<RobotsAudit>;
declare function auditPageSpeed(siteUrl: string, apiKey?: string): Promise<PageSpeedAudit>;
declare function auditGbp(placeId: string, apiKey?: string): Promise<GbpAudit>;
declare function samplePages(sitemapUrl: string | null, opts: {
    fetcher: Fetcher;
    cfg: ScannerConfig;
    limit?: number;
    targetOrigin?: string;
}): Promise<SampledPage[]>;
declare function computePageStats(pages: SampledPage[], thinPageWordFloor?: number): PageStats | null;
/**
 * Identify a vendor template from the homepage HTML + sampled page stats. The
 * named vendor fingerprints come from config (`cfg.templateVendors`); the
 * `generic-template` heuristic (polished homepage + thin/repetitive service
 * pages) is the built-in structural tell. When detected, the host should cap
 * threat ceilings and steer gap-report strategy toward depth/originality.
 */
declare function detectTemplateVendor(homepageHtml: string, pages: SampledPage[], homepage: HomepageAudit | null, cfg?: ScannerConfig): TemplateVendor;
interface RunAuditOptions {
    url: string;
    placeId?: string;
    pageSpeedKey?: string;
    placesKey?: string;
    skipPageSpeed?: boolean;
    skipPageSampling?: boolean;
    pageSampleLimit?: number;
    /** GEO scoring config (e.g. `pack.scoring.geo`). Defaults to the health pack. */
    geo?: GeoConfig;
    /** Scanner tuning (`resolveScannerConfig(pack.competitors)`). */
    scannerConfig?: ScannerConfig;
    /** Network boundary. Defaults to `defaultFetcher()` (global fetch). */
    fetcher?: Fetcher;
}
/**
 * Audit one target site end-to-end. The signature collapses BoH's
 * `runAudit(opts)` — same orchestration, with `keys` and tuning carried in
 * `opts`. The `(target, keys)` calling convention the catalog names is
 * `runAudit({ url: target, ...keys })`.
 */
declare function runAudit(opts: RunAuditOptions): Promise<CompetitorAudit>;
declare function compareAudits(us: CompetitorAudit | null, them: CompetitorAudit): GapSignal[];

declare function pick(re: RegExp, html: string): string | null;
declare function decode(s: string): string;
declare function stripTags(html: string): string;
declare function originOf(u: string): string;
/**
 * Convert HTML to a markdown-ish projection that the GEO scorer can read
 * correctly. The article scorer detects question-style H2s via `^## ...`
 * (markdown convention), but competitor pages are HTML — so we promote heading
 * tags to markdown headings before stripping. Nav/footer/aside are dropped to
 * cut boilerplate noise, and `<a href>` becomes `[text](URL)` BEFORE the
 * generic tag-strip so the citation-density regex still finds source URLs.
 */
declare function htmlToScorableMarkdown(html: string): string;
type SchemaAuditResult = {
    types: string[];
    raw: unknown[];
    count: number;
    fieldsByType?: Record<string, string[]>;
};
/** Extract every JSON-LD block's @types and per-type populated field names. */
declare function extractSchema(html: string): SchemaAuditResult;

/**
 * The default network boundary. Wraps global `fetch` with an optional
 * JS-rendering proxy (ScrapingBee) path — many competitor sites (vendor
 * templates, site builders) render content client-side and come back
 * near-empty via plain fetch, so a render proxy is the difference between a
 * scorable page and a blank one. Falls back to plain fetch on any proxy
 * error/empty result, or when no proxy key is configured.
 *
 * Ported verbatim from Body of Health `competitor-scanner.ts::fetchHtml`, with
 * the User-Agent and proxy key lifted into constructor options so a host
 * re-brands the crawler without touching engine code. A host that needs a
 * different rendering proxy, a cache, or a test double implements `Fetcher`.
 */
interface FetcherOptions {
    /** User-Agent for plain fetches. Defaults to a generic Jeldon crawler UA. */
    userAgent?: string;
    /** ScrapingBee API key. When set, pages route through it with JS rendering. */
    scrapingBeeKey?: string;
    /** Plain-fetch abort timeout (ms). Default 15000. */
    plainTimeoutMs?: number;
    /** Proxy abort timeout (ms). Default 32000. */
    proxyTimeoutMs?: number;
    /**
     * Circuit breaker: when true and a proxy call fails once, the proxy is
     * disabled for the lifetime of this fetcher (the cron behavior — stop
     * burning credits + extra subrequests after the key proves bad). Default
     * false (per-call fallback, the on-demand Astro behavior).
     */
    disableProxyAfterFailure?: boolean;
}
declare class DefaultFetcher implements Fetcher {
    private readonly userAgent;
    private readonly scrapingBeeKey?;
    private readonly plainTimeoutMs;
    private readonly proxyTimeoutMs;
    private readonly disableProxyAfterFailure;
    private proxyDisabled;
    constructor(opts?: FetcherOptions);
    fetchHtml(url: string): Promise<FetchResult>;
}
declare function defaultFetcher(opts?: FetcherOptions): Fetcher;

/**
 * Build the system prompts for the AI-backed surfaces (positioning extraction +
 * gap report) from the Domain Pack. In BoH these strings hardcoded "Dr. Jason
 * Young's Body of Health chiropractic clinic in Corvallis, Oregon" and the
 * voice rules inline; per docs/DECOUPLING-NOTES.md ("Voice block duplicated ×4")
 * the voice now lives once in `pack.voice` and the brand identity in `pack.brand`.
 *
 * The strategic *craft* of each prompt (how to read a geoScore, the template-site
 * playbook, the METRIC PARITY hard rule, the keyword-intent taxonomy) is
 * domain-general and stays verbatim from the BoH source — that's the part worth
 * porting. Only the identity framing + voice constraints are interpolated.
 */
type PromptBrand = Pick<DomainPack, 'brand' | 'voice' | 'content'>;
/** SYSTEM prompt for the positioning extractor. Ported from BoH
 *  competitor-positioning.ts::SYSTEM with the clinic identity interpolated. */
declare function buildPositioningSystem(pack: PromptBrand): string;
/** SYSTEM prompt for the gap report. Ported from BoH
 *  competitor-gap-report.ts::SYSTEM with brand/voice interpolated and the
 *  category list read from `pack.content.categories`. */
declare function buildGapReportSystem(pack: PromptBrand): string;

interface ExtractPositioningOptions {
    apiKey: string;
    competitorName: string;
    homepageText: string | null;
    pages: SampledPage[];
    /** Domain Pack slice for the SYSTEM-prompt identity + voice. */
    pack: PromptBrand;
    /** Model alias (key into `drafting.models`). Defaults to `drafting.defaultModel`. */
    model?: string;
    /** Drafting config for the model map. Defaults to `defaultDraftingConfig`. */
    drafting?: DraftingConfig;
}
declare function extractPositioning(opts: ExtractPositioningOptions): Promise<Positioning>;

interface GapReportOptions {
    apiKey: string;
    competitorName: string;
    competitorAudit: CompetitorAudit;
    ourAudit: CompetitorAudit | null;
    articleInventory: Array<{
        slug: string;
        title: string;
        category: string;
        excerpt: string;
    }>;
    targetKeywords: string[];
    /** Domain Pack slice for the SYSTEM prompt + the content-category enum. */
    pack: PromptBrand;
    /** Model alias. Defaults to `drafting.defaultModel`. */
    model?: string;
    /** Drafting config for the model map. Defaults to `defaultDraftingConfig`. */
    drafting?: DraftingConfig;
    /** Internal-link path prefix for inventory rendering (e.g. "articles"). Default "articles". */
    inventoryPathPrefix?: string;
}
declare function gapReport(opts: GapReportOptions): Promise<GapReport>;

declare function rankOneSerpApi(keyword: string, location: string, ourPlaceId: string, ourName: string, serpApiKey: string, competitorPlaceIds: Record<string, string>, competitorNames: Record<string, string>): Promise<KeywordRank>;
declare function rankOnePlaces(keyword: string, center: {
    latitude: number;
    longitude: number;
}, ourPlaceId: string, placesKey: string, competitorPlaceIds: Record<string, string>): Promise<KeywordRank>;
interface TrackLocalRanksOptions {
    /** Keywords to rank. Resolve from priority keywords at the host (see
     *  `aggregatePriorityKeywords`) or pass an explicit list. */
    keywords: string[];
    competitors: CompetitorsConfig;
    keys: RankKeys;
    store: RanksStore;
    /** Resolved center coords for the Places fallback (best-effort for SerpApi). */
    center?: {
        latitude: number;
        longitude: number;
    } | null;
    /** Default local-pack location when `competitors.localPackLocation` is unset. */
    defaultLocation?: string;
    batchSize?: number;
}
interface TrackLocalRanksResult {
    ok: boolean;
    refreshed: number;
    method: 'serpapi-local' | 'places';
    location?: string;
    errors: string[];
    ranks: Record<string, KeywordRank>;
}
/**
 * Refresh local-pack ranks for a keyword list and persist via the store. Prefers
 * SerpApi's real local pack; falls back to self-centered Places Text Search when
 * only a Places key is present. Mirrors `keyword-ranks.ts::POST`.
 */
declare function trackLocalRanks(opts: TrackLocalRanksOptions): Promise<TrackLocalRanksResult>;
interface PriorityKeyword {
    phrase: string;
    totalWeight: number;
}
/**
 * Aggregate priority keywords across competitor audits: sum positioning weights
 * (deduped, lowercased), drop terms our own positioning already surfaces, and
 * drop terms a `covered` predicate marks as already-covered by our content.
 * Pure — the host supplies the audits + the coverage check (which is store I/O).
 * Mirrors `keyword-ranks.ts::loadPriorityKeywords` minus the GitHub reads.
 */
declare function aggregatePriorityKeywords(opts: {
    competitorAudits: CompetitorAudit[];
    ourPositioningKeywords?: Array<{
        phrase: string;
    }>;
    covered?: (phrase: string) => boolean;
    limit?: number;
}): PriorityKeyword[];
/** JSON-file store (the cron default — `keyword-ranks.json` in BoH). */
declare class FsRanksStore implements RanksStore {
    private readonly path;
    constructor(path: string);
    read(): Promise<RanksFile>;
    write(data: RanksFile): Promise<void>;
}
/** In-memory store — holds the last write, persists nothing. */
declare class NullRanksStore implements RanksStore {
    private data;
    constructor(seed?: RanksFile);
    read(): Promise<RanksFile>;
    write(data: RanksFile): Promise<void>;
}

/**
 * Derive competitive-intel runtime inputs from a loaded Domain Pack. Keeps every
 * domain literal (roster, target keywords, our place id, local-pack location,
 * vendor fingerprints, the GEO scoring weights) read from `pack` rather than
 * hardcoded — the point of the port.
 */
/** Resolve the scanner tuning (URL patterns, vendor fingerprints, thresholds). */
declare function scannerConfigFromPack(pack: Pick<DomainPack, 'competitors'>): ScannerConfig;
/** The GEO scoring config the homepage citability score uses. */
declare function geoConfigFromPack(pack: Pick<DomainPack, 'scoring'>): _jeldon_config.GeoConfig;
/** The competitors block, or null when the capability is off / unconfigured. */
declare function competitorsFromPack(pack: Pick<DomainPack, 'competitors'>): CompetitorsConfig | null;
/** Read rank-tracking API keys from a process-env-like record (no direct
 *  process coupling — pass `process.env` at the host). Mirrors the BoH env names. */
declare function rankKeysFromEnv(env: Record<string, string | undefined>): RankKeys;
/** Read scanner API keys (PageSpeed + Places + ScrapingBee) from env. */
declare function scannerKeysFromEnv(env: Record<string, string | undefined>): {
    pageSpeedKey?: string;
    placesKey?: string;
    scrapingBeeKey?: string;
};

export { type CompetitorAudit, DefaultFetcher, type ExtractPositioningOptions, type FetchResult, type Fetcher, type FetcherOptions, FsRanksStore, type GapReport, type GapReportOptions, type GapSignal, type GbpAudit, type HomepageAudit, type KeywordRank, NullRanksStore, type PageSpeedAudit, type PageSpeedScores, type PageStats, type Positioning, type PriorityKeyword, type PromptBrand, type RankKeys, type RankMethod, type RanksFile, type RanksStore, type RobotsAudit, type RunAuditOptions, type SampledPage, type ScannerConfig, type SchemaAudit, type SchemaAuditResult, type SitemapAudit, type TemplateVendor, type TrackLocalRanksOptions, type TrackLocalRanksResult, aggregatePriorityKeywords, auditGbp, auditHomepage, auditPageSpeed, auditRobots, auditSitemap, buildGapReportSystem, buildPositioningSystem, compareAudits, competitorsFromPack, computePageStats, decode, defaultFetcher, defaultScannerConfig, detectTemplateVendor, extractPositioning, extractSchema, gapReport, geoConfigFromPack, geoScoreHtml, htmlToScorableMarkdown, originOf, pick, rankKeysFromEnv, rankOnePlaces, rankOneSerpApi, resolveScannerConfig, runAudit, samplePages, scannerConfigFromPack, scannerKeysFromEnv, stripTags, trackLocalRanks };
