// src/types.ts
var defaultHttpClient = {
  fetch: (url, init) => fetch(url, init)
};

// src/null-verifier.ts
var NullVerifier = class {
  kind = "none";
  async verifyClaims() {
    return {
      status: "disabled",
      reason: 'No claim verifier configured (citation.verifier.kind = "none").'
    };
  }
};

// src/report.ts
function buildReport(results) {
  const counts = {
    supports: 0,
    partial: 0,
    contradicts: 0,
    unrelated: 0,
    unverified: 0
  };
  for (const c of results) counts[c.verdict] += 1;
  const verdict = counts.contradicts > 0 ? "bad" : counts.unrelated + counts.unverified > 0 ? "warn" : "ok";
  return {
    status: "verified",
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
    claims: results,
    counts,
    verdict
  };
}
function formatReport(report, verifierName = "verifier") {
  if (report.status === "disabled") return "";
  if (report.status === "error") {
    return `

---
**${verifierName} verification: error** \u2014 ${report.reason}
_(Drafted anyway. Re-verify after editing.)_`;
  }
  const { counts, verdict, claims } = report;
  const total = claims.length;
  const head = verdict === "ok" ? `\u2705 **${verifierName}: all ${total} claims supported**` : verdict === "warn" ? `\u26A0\uFE0F **${verifierName}: ${counts.unverified + counts.unrelated} of ${total} claims need review**` : `\u274C **${verifierName}: ${counts.contradicts} of ${total} claims contradicted \u2014 fix before publishing**`;
  const flagged = claims.filter((c) => c.verdict !== "supports").slice(0, 5);
  const detail = flagged.length ? "\n" + flagged.map(
    (c) => `- _${c.verdict}_: "${c.claim.slice(0, 140)}${c.claim.length > 140 ? "\u2026" : ""}"${c.notes ? ` \u2014 ${c.notes}` : ""}`
  ).join("\n") : "";
  return `

---
${head}${detail}`;
}

// src/cite8-verifier.ts
var CITE8_DEFAULT_BASE = "https://cite8.dev";
var Cite8Verifier = class {
  kind = "cite8";
  apiKey;
  baseUrl;
  http;
  constructor(opts = {}) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || CITE8_DEFAULT_BASE).replace(/\/$/, "");
    this.http = opts.http ?? defaultHttpClient;
  }
  async verifyClaims(claims, opts) {
    if (!this.apiKey) {
      return {
        status: "disabled",
        reason: "cite8 API key not configured. Set it to activate verification."
      };
    }
    const list = claims.map((c) => c.trim()).filter(Boolean);
    if (!list.length) {
      return { status: "disabled", reason: "No verifiable research claims found in the draft." };
    }
    const results = [];
    let errored = 0;
    let lastError = "";
    for (const claim of list) {
      const r = await this.verifyOne(claim, opts);
      if (r.kind === "error") {
        errored += 1;
        lastError = r.reason;
        results.push({
          claim,
          verdict: "unverified",
          sources: [],
          notes: `cite8 lookup failed: ${r.reason}`
        });
        continue;
      }
      const { verdict, sources, notes } = summarizeVerifications(r.verifications, r.strength);
      results.push({ claim, verdict, sources, notes });
    }
    if (errored === list.length) {
      return { status: "error", reason: lastError || "All cite8 lookups failed." };
    }
    return buildReport(results);
  }
  async verifyOne(claim, opts) {
    const k = opts?.k ?? 4;
    const include_quotes = opts?.includeQuotes ?? true;
    try {
      const res = await this.http.fetch(`${this.baseUrl}/api/v1/verify-claim`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ claim, k, include_quotes })
      });
      if (!res.ok) {
        const text = await res.text();
        return { kind: "error", reason: `cite8 ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json();
      return {
        kind: "ok",
        verifications: Array.isArray(data.verifications) ? data.verifications : [],
        strength: data.strength
      };
    } catch (err) {
      return { kind: "error", reason: err.message };
    }
  }
};
function summarizeVerifications(verifications, strength) {
  const norm = (v) => (v || "").toLowerCase();
  const has = (v) => verifications.some((x) => norm(x.verdict) === v);
  const verdict = has("supports") ? "supports" : has("partial") ? "partial" : has("contradicts") ? "contradicts" : "unverified";
  const rank = {
    supports: 0,
    partial: 1,
    contradicts: 2,
    unrelated: 3,
    unknown: 4
  };
  const sources = [...verifications].sort((a, b) => (rank[norm(a.verdict)] ?? 9) - (rank[norm(b.verdict)] ?? 9)).slice(0, 3).map((v) => ({
    url: v.pubmed_url || v.doi_url || (v.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${v.pmid}/` : ""),
    title: v.title,
    pmid: v.pmid,
    doi: v.doi,
    quote: v.quote
  })).filter((s) => s.url || s.title);
  const notes = strength?.label || (strength?.direction && strength?.strength ? `${strength.direction} / ${strength.strength}` : void 0);
  return { verdict, sources, notes };
}

// src/primary-source-verifier.ts
var MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
var BARE_URL_RE = /https?:\/\/[^\s<>")\]]+/g;
var PrimarySourceVerifier = class {
  kind = "primary-source";
  matchers;
  constructor(opts = {}) {
    this.matchers = (opts.sourcePatterns ?? []).map((p) => new RegExp(p, "i"));
  }
  async verifyClaims(claims, _opts) {
    const list = claims.map((c) => c.trim()).filter(Boolean);
    if (!list.length) {
      return { status: "disabled", reason: "No claims supplied to verify." };
    }
    const results = list.map((claim) => {
      const urls = this.extractSources(claim);
      const matching = urls.filter((s) => this.isPrimarySource(s.url));
      if (matching.length > 0) {
        return {
          claim,
          verdict: "supports",
          sources: matching,
          notes: `${matching.length} resolvable primary source(s)`
        };
      }
      if (urls.length > 0) {
        return {
          claim,
          verdict: "unrelated",
          sources: urls,
          notes: "linked source does not match an allowed primary-source pattern"
        };
      }
      return {
        claim,
        verdict: "unverified",
        sources: [],
        notes: "no linked primary source"
      };
    });
    return buildReport(results);
  }
  isPrimarySource(url) {
    if (this.matchers.length === 0) return true;
    return this.matchers.some((re) => re.test(url));
  }
  extractSources(claim) {
    const sources = [];
    const seen = /* @__PURE__ */ new Set();
    MD_LINK_RE.lastIndex = 0;
    let m;
    while ((m = MD_LINK_RE.exec(claim)) !== null) {
      const url = m[2];
      const title = m[1];
      if (url && !seen.has(url)) {
        seen.add(url);
        sources.push({ url, title });
      }
    }
    const withoutMdLinks = claim.replace(MD_LINK_RE, " ");
    BARE_URL_RE.lastIndex = 0;
    while ((m = BARE_URL_RE.exec(withoutMdLinks)) !== null) {
      const url = m[0].replace(/[.,;:)]+$/, "");
      if (url && !seen.has(url)) {
        seen.add(url);
        sources.push({ url });
      }
    }
    return sources;
  }
};

// src/factory.ts
function createVerifier(citation, opts = {}) {
  switch (citation.verifier.kind) {
    case "cite8":
      return new Cite8Verifier({
        apiKey: opts.apiKey,
        baseUrl: citation.verifier.baseUrl,
        http: opts.http
      });
    case "primary-source":
      return new PrimarySourceVerifier({ sourcePatterns: opts.sourcePatterns });
    case "none":
    default:
      return new NullVerifier();
  }
}

// src/lint.ts
function lintCitations(md, policy, file) {
  if (policy.policy !== "search-urls-only") {
    return { ok: true, findings: [] };
  }
  const findings = [];
  policy.forbiddenPatterns.forEach((source, patternIndex) => {
    const re = compile(source);
    if (!re) return;
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(md)) !== null) {
      const line = md.slice(0, match.index).split("\n").length;
      findings.push({ file, line, patternIndex, pattern: source, hit: match[0] });
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  });
  return { ok: findings.length === 0, findings };
}
function lintDocuments(docs, policy) {
  const findings = [];
  for (const doc of docs) {
    findings.push(...lintCitations(doc.md, policy, doc.file).findings);
  }
  return { ok: findings.length === 0, findings };
}
function formatLintReport(result, policy) {
  if (result.ok) {
    return "Citation linter: no forbidden citation patterns found.";
  }
  const lines = result.findings.map((f) => {
    const loc = f.file ? `${f.file}:${f.line}` : `line ${f.line}`;
    return `  ${loc}  [pattern ${f.patternIndex}]  "${f.hit}"`;
  });
  return [
    `Citation linter: ${result.findings.length} forbidden citation pattern(s) found.`,
    "",
    ...lines,
    "",
    `Citation policy: "${policy.policy}". Reference format: ${policy.referenceFormat}`,
    "A human reviewer can override by merging anyway \u2014 the failure is the",
    "discussion trigger, not the verdict."
  ].join("\n");
}
function compile(source) {
  try {
    return new RegExp(source, "gi");
  } catch {
    return null;
  }
}

// src/defaults.ts
var defaultCitationConfig = {
  policy: "search-urls-only",
  forbiddenPatterns: [
    // PMID_RE from lint-citations.mjs
    "\\bPMID:?\\s*\\d{4,9}\\b",
    // DOI_RE from lint-citations.mjs
    `\\b10\\.\\d{4,9}\\/[^\\s,)\\]<>"']+`
  ],
  referenceFormat: "Author lastname, year. Brief description. [Source](https://example.org/search?q=author+topic)",
  verifier: { kind: "none" }
};
export {
  Cite8Verifier,
  NullVerifier,
  PrimarySourceVerifier,
  buildReport,
  createVerifier,
  defaultCitationConfig,
  defaultHttpClient,
  formatLintReport,
  formatReport,
  lintCitations,
  lintDocuments
};
