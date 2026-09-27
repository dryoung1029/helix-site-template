import { CitationConfig } from '@jeldon/config';

/**
 * Citation-verification contracts. Domain-agnostic: the BoH `Cite8Report`,
 * `Cite8ClaimResult`, `Cite8Source` shapes are lifted here as `VerificationReport`,
 * `ClaimResult`, `ClaimSource` — verbatim in structure, generic in name — so a
 * health domain (cite8/PubMed) and a non-health domain (RFCs, CVEs, primary
 * sources) flow through the same interface.
 *
 * Ported from Body of Health `src/lib/admin/cite8.ts` (the `Cite8*` type block).
 */
/** Per-claim verdict. `unverified` covers unrelated/unknown/nothing-returned. */
type Verdict = 'supports' | 'partial' | 'contradicts' | 'unrelated' | 'unverified';
/** A single resolved source backing (or contradicting) a claim. */
interface ClaimSource {
    url: string;
    title?: string;
    /** Health-domain identifiers — optional, never required by the engine. */
    pmid?: string;
    doi?: string;
    quote?: string;
}
interface ClaimResult {
    claim: string;
    verdict: Verdict;
    confidence?: number;
    sources: ClaimSource[];
    notes?: string;
}
interface VerdictCounts {
    supports: number;
    partial: number;
    contradicts: number;
    unrelated: number;
    unverified: number;
}
/**
 * The aggregate report `verifyClaims` returns. Three terminal shapes, lifted
 * verbatim from BoH `Cite8Report`:
 *   - `disabled` — no verifier configured / no claims (the NullVerifier path)
 *   - `error`    — the verifier was reachable-and-tried but every lookup failed
 *   - `verified` — at least one claim resolved; `verdict` rolls up severity
 */
type VerificationReport = {
    status: 'disabled';
    reason: string;
} | {
    status: 'error';
    reason: string;
} | {
    status: 'verified';
    verifiedAt: string;
    claims: ClaimResult[];
    counts: VerdictCounts;
    /** ok = all supports/partial · warn = some unverified/unrelated · bad = some contradicts. */
    verdict: 'ok' | 'warn' | 'bad';
};
interface VerifyOptions {
    /** How many candidate sources to request per claim. */
    k?: number;
    includeQuotes?: boolean;
}
/**
 * The portable contract every verifier implements. The drafting/editor flows
 * extract discrete claims (an LLM job — kept OUT of this package so it stays
 * free of provider coupling) and hand the list here.
 */
interface ClaimVerifier {
    /** Stable id for logging/UX (`none` | `cite8` | `primary-source`). */
    readonly kind: string;
    verifyClaims(claims: string[], opts?: VerifyOptions): Promise<VerificationReport>;
}
interface HttpResponse {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
}
interface HttpClient {
    fetch(url: string, init: {
        method: string;
        headers: Record<string, string>;
        body?: string;
    }): Promise<HttpResponse>;
}
/** Default HttpClient over the platform `fetch` (Workers, Node 18+, browser). */
declare const defaultHttpClient: HttpClient;

/**
 * The default verifier: verifies nothing, never blocks. Returns the same
 * `{ status: 'disabled' }` signal BoH's cite8 client returned when
 * `CITE8_API_KEY` was unset, so the drafting flow proceeds unchanged. A domain
 * with no verification service gets this and the linter does all the work.
 *
 * Ported from the `if (!apiKey) return { status: 'disabled' }` branches in
 * Body of Health `src/lib/admin/cite8.ts`.
 */
declare class NullVerifier implements ClaimVerifier {
    readonly kind = "none";
    verifyClaims(): Promise<VerificationReport>;
}

interface Cite8VerifierOptions {
    /** Bearer token. Without it, verifyClaims returns `{ status: 'disabled' }`. */
    apiKey?: string;
    /** API base URL. Defaults to https://cite8.dev (apex — api.cite8.dev has no DNS). */
    baseUrl?: string;
    /** Injectable HTTP client; defaults to platform `fetch`. */
    http?: HttpClient;
}
declare class Cite8Verifier implements ClaimVerifier {
    readonly kind = "cite8";
    private readonly apiKey?;
    private readonly baseUrl;
    private readonly http;
    constructor(opts?: Cite8VerifierOptions);
    verifyClaims(claims: string[], opts?: VerifyOptions): Promise<VerificationReport>;
    private verifyOne;
}

/**
 * Generic, network-free verifier for non-health domains: a claim is `supports`
 * if it carries (or resolves to) a linked primary source whose URL matches one
 * of the configured `sourcePatterns`; otherwise it's `unverified`. No external
 * API — this is the "every claim must cite a resolvable source" discipline made
 * mechanical, suitable when there's no domain-specific RAG service like cite8.
 *
 * This is the generic counterpart to Cite8Verifier (DECOUPLING-NOTES row:
 * "PrimarySourceVerifier generic"). It has no BoH source line — BoH only ever
 * had the health/cite8 path — so it's a faithful new implementation of the
 * resolvable-link contract, not a stub.
 *
 * A claim string may embed its source inline:
 *   - a markdown link:  "QUIC ships in [RFC 9000](https://datatracker.ietf.org/doc/rfc9000)"
 *   - a bare URL:       "QUIC ships in RFC 9000 https://datatracker.ietf.org/doc/rfc9000"
 */
interface PrimarySourceVerifierOptions {
    /**
     * Regex sources (compiled with the `i` flag) that an extracted URL must match
     * to count as a primary source. Empty => any http(s) URL counts.
     * e.g. ['datatracker\\.ietf\\.org', 'nvd\\.nist\\.gov'].
     */
    sourcePatterns?: string[];
}
declare class PrimarySourceVerifier implements ClaimVerifier {
    readonly kind = "primary-source";
    private readonly matchers;
    constructor(opts?: PrimarySourceVerifierOptions);
    verifyClaims(claims: string[], _opts?: VerifyOptions): Promise<VerificationReport>;
    private isPrimarySource;
    private extractSources;
}

interface VerifierFactoryOptions {
    /** Bearer token for network verifiers (e.g. cite8). Read from env by the host. */
    apiKey?: string;
    /** Source-pattern allow-list for PrimarySourceVerifier. Defaults to the GEO
     *  citation patterns when omitted by the caller. */
    sourcePatterns?: string[];
    /** Injectable HTTP client (tests / non-network hosts). */
    http?: HttpClient;
}
/**
 * Resolve the configured `ClaimVerifier` from a Domain Pack's citation config.
 * `none` → NullVerifier (default, never blocks); `cite8` → health plugin;
 * `primary-source` → generic resolvable-link verifier.
 *
 * Mirrors how BoH chose its path by env presence, but the choice is now an
 * explicit config field (`citation.verifier.kind`) instead of "is CITE8_API_KEY
 * set". A missing apiKey on a `cite8` pack still degrades to disabled at call
 * time — the verifier returns `{ status: 'disabled' }`, exactly as BoH did.
 */
declare function createVerifier(citation: CitationConfig, opts?: VerifierFactoryOptions): ClaimVerifier;

/**
 * Roll a list of per-claim results into a `verified` report. The severity
 * ordering is lifted verbatim from BoH `verifyClaims`:
 *   bad  = at least one `contradicts`
 *   warn = at least one `unverified` or `unrelated`
 *   ok   = everything else (all supports/partial)
 */
declare function buildReport(results: ClaimResult[]): VerificationReport;
/**
 * Tiny human-readable summary appended to an assistant reply so the editor sees
 * the verification state inline. Ported from BoH `formatReport`, generalized
 * (no "cite8" literal — takes the verifier name).
 */
declare function formatReport(report: VerificationReport, verifierName?: string): string;

/**
 * Citation linter. Faithful port of Body of Health `scripts/lint-citations.mjs`,
 * with the two hardcoded health regexes (PMID, DOI) lifted into
 * `pack.citation.forbiddenPatterns` so the engine is domain-agnostic.
 *
 * THE POLICY ENUM RESOLVES THE LINT-VS-CITE8 CONTRADICTION
 * (DECOUPLING-NOTES: "Citation-policy contradiction"):
 *   - 'search-urls-only'   — fabricated-citation guard ON. Authors must use
 *                            search URLs; bare PMIDs/DOIs are forbidden. This is
 *                            the original BoH lint behavior.
 *   - 'direct-source-urls' — a verifier (e.g. cite8) supplies VERIFIED PMIDs/DOIs,
 *                            so flagging them would fight the verifier. Lint is a
 *                            no-op for the forbidden patterns under this policy.
 *   - 'verifier-required'  — same as direct-source-urls for linting purposes; the
 *                            verifier is the gate, not the linter.
 *
 * The mechanics (scan each file's text for every forbidden pattern, report
 * file:line:hit) are lifted verbatim; only the pattern source and the
 * policy gate are config-driven now.
 */
interface LintFinding {
    /** Optional source label (e.g. a file path) when linting a named document. */
    file?: string;
    line: number;
    /** Which forbidden pattern matched (its index + the raw source). */
    patternIndex: number;
    pattern: string;
    hit: string;
}
interface LintResult {
    ok: boolean;
    findings: LintFinding[];
}
/**
 * Lint a single markdown document against the citation policy.
 *
 * @param md     the markdown body to scan
 * @param policy the Domain Pack's `citation` config
 * @param file   optional label attached to each finding (a path, slug, etc.)
 */
declare function lintCitations(md: string, policy: CitationConfig, file?: string): LintResult;
/**
 * Lint many documents at once. Mirrors the CLI shape of `lint-citations.mjs`
 * (a list of files → a single pass/fail with per-file findings). Reading the
 * files is the caller's job — this package does no fs I/O (DECOUPLING-NOTES:
 * I/O behind an interface; here the document text is just passed in).
 */
declare function lintDocuments(docs: Array<{
    file?: string;
    md: string;
}>, policy: CitationConfig): LintResult;
/** Render findings as a human-readable report (the `console.error` block in the
 *  original script), returned as a string so the host owns the I/O. */
declare function formatLintReport(result: LintResult, policy: CitationConfig): string;

/**
 * A sensible default citation policy for projects that don't override it. Lives
 * here (not in @jeldon/config's defaults.ts, which has no citation default) to
 * keep this package self-sufficient — `createVerifier(defaultCitationConfig)`
 * and `lintCitations(md, defaultCitationConfig)` both work out of the box.
 *
 * Defaults to the SAFE, no-service posture:
 *   - policy 'search-urls-only' — the fabricated-citation guard is ON
 *   - forbiddenPatterns — the two BoH regexes (PMID, DOI), lifted verbatim from
 *     `scripts/lint-citations.mjs`
 *   - verifier 'none' — NullVerifier; a domain wires cite8/primary-source in
 *     its own pack.
 */
declare const defaultCitationConfig: CitationConfig;

export { Cite8Verifier, type Cite8VerifierOptions, type ClaimResult, type ClaimSource, type ClaimVerifier, type HttpClient, type HttpResponse, type LintFinding, type LintResult, NullVerifier, PrimarySourceVerifier, type PrimarySourceVerifierOptions, type Verdict, type VerdictCounts, type VerificationReport, type VerifierFactoryOptions, type VerifyOptions, buildReport, createVerifier, defaultCitationConfig, defaultHttpClient, formatLintReport, formatReport, lintCitations, lintDocuments };
