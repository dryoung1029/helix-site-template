// src/scanner.ts
import { defaultGeoConfig } from "@jeldon/config";
import { calculateGeo } from "@jeldon/core-scoring";

// src/config.ts
var DEFAULT_HIGH_VALUE_PATTERNS = [
  "/(services?|treatments?|conditions?|specialt(?:y|ies)|care|therapy|therapies)/",
  "/(chiropractic|massage|acupuncture|adjust|spinal|spine|rehab|wellness|injury|pain)\\b",
  "/(back-?pain|neck-?pain|headache|migraine|sciatica|whiplash|sports?-?injur|auto-?accident|pregnan|prenatal|webster|extremit|shoulder|knee|hip|tmj|carpal|plantar|posture)",
  "/(blog|articles?|news|posts?|resources?|education)/"
];
var DEFAULT_SKIP_PATTERNS = [
  "/(contact|location|hours|appointment|book|schedule|privacy|terms|sitemap|search|tag|category|author|404|test)",
  "\\.(pdf|jpg|jpeg|png|gif|webp|svg|xml|css|js|ico)(\\?|$)",
  "^https?://[^/]+/?$"
  // homepage itself
];
var DEFAULT_TEMPLATE_VENDORS = [
  { name: "chiromatrix", fingerprints: ["cdcssl\\.ibsrv\\.net", "chiromatrix"] },
  {
    name: "solutionreach",
    fingerprints: [
      `<meta[^>]+(?:name|property)=["']generator["'][^>]+(?:solutionreach|sr-pulse)`,
      "solutionreach\\.com",
      "sr-cdn"
    ]
  },
  { name: "ihealth-spot", fingerprints: ["ihealthspot\\.com", "ihealthspot-cdn"] }
];
function resolveScannerConfig(competitors) {
  return {
    highValuePatterns: competitors?.highValuePatterns ?? DEFAULT_HIGH_VALUE_PATTERNS,
    skipPatterns: competitors?.skipPatterns ?? DEFAULT_SKIP_PATTERNS,
    templateVendors: competitors?.templateVendors ?? DEFAULT_TEMPLATE_VENDORS,
    thinPageWordFloor: 300,
    genericHomepageWordRatio: 3,
    genericThinPageFraction: 0.5,
    genericMinSampledPages: 4
  };
}
var defaultScannerConfig = resolveScannerConfig();

// src/fetcher.ts
var DEFAULT_UA = "Mozilla/5.0 (compatible; JeldonCompetitiveIntelBot/1.0)";
var DefaultFetcher = class {
  userAgent;
  scrapingBeeKey;
  plainTimeoutMs;
  proxyTimeoutMs;
  disableProxyAfterFailure;
  proxyDisabled = false;
  constructor(opts = {}) {
    this.userAgent = opts.userAgent ?? DEFAULT_UA;
    this.scrapingBeeKey = opts.scrapingBeeKey;
    this.plainTimeoutMs = opts.plainTimeoutMs ?? 15e3;
    this.proxyTimeoutMs = opts.proxyTimeoutMs ?? 32e3;
    this.disableProxyAfterFailure = opts.disableProxyAfterFailure ?? false;
  }
  async fetchHtml(url) {
    let proxyError;
    if (this.scrapingBeeKey && !this.proxyDisabled) {
      try {
        const api = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(this.scrapingBeeKey)}&url=${encodeURIComponent(url)}&render_js=true&block_resources=false&timeout=20000`;
        const ctrl2 = new AbortController();
        const to2 = setTimeout(() => ctrl2.abort(), this.proxyTimeoutMs);
        const r = await fetch(api, { signal: ctrl2.signal });
        clearTimeout(to2);
        if (r.ok) {
          const html = await r.text();
          if (html && html.length > 200) {
            return {
              ok: true,
              status: 200,
              finalUrl: r.headers.get("spb-resolved-url") || url,
              html,
              via: "proxy"
            };
          }
          proxyError = `empty/short response (${html.length} bytes)`;
        } else {
          proxyError = `HTTP ${r.status}`;
          try {
            const t = await r.text();
            if (t) proxyError += `: ${t.slice(0, 120)}`;
          } catch {
          }
        }
      } catch (e) {
        proxyError = `request failed: ${e.message}`;
      }
      if (this.disableProxyAfterFailure) this.proxyDisabled = true;
    }
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), this.plainTimeoutMs);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": this.userAgent, Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: ctrl.signal
      });
      clearTimeout(to);
      return { ok: r.ok, status: r.status, finalUrl: r.url || url, html: await r.text(), via: "plain", proxyError };
    } catch (err) {
      clearTimeout(to);
      return { ok: false, status: 0, finalUrl: url, html: "", error: err.message, via: "plain", proxyError };
    }
  }
};
function defaultFetcher(opts = {}) {
  return new DefaultFetcher(opts);
}

// src/html.ts
function pick(re, html) {
  const m = html.match(re);
  return m && m[1] != null ? decode(m[1].trim()) : null;
}
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function originOf(u) {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
}
function htmlToScorableMarkdown(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<nav\b[\s\S]*?<\/nav>/gi, " ").replace(/<footer\b[\s\S]*?<\/footer>/gi, " ").replace(/<aside\b[\s\S]*?<\/aside>/gi, " ").replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `

# ${stripTags(c)}

`).replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `

## ${stripTags(c)}

`).replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `

### ${stripTags(c)}

`).replace(
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, content) => `[${stripTags(content)}](${href})`
  ).replace(/<\/p>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function extractSchema(html) {
  const blocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  const types = /* @__PURE__ */ new Set();
  const raw = [];
  const fieldsByType = {};
  for (const m of blocks) {
    try {
      const parsed = JSON.parse((m[1] ?? "").trim());
      raw.push(parsed);
      const arr = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      for (const node of arr) {
        if (!node || typeof node !== "object") continue;
        const t = node["@type"];
        const typeNames = typeof t === "string" ? [t] : Array.isArray(t) ? t.filter((x) => typeof x === "string") : [];
        for (const tn of typeNames) {
          types.add(tn);
          const set = fieldsByType[tn] ??= /* @__PURE__ */ new Set();
          for (const key of Object.keys(node)) {
            if (key === "@type" || key === "@context" || key === "@id" || key === "@graph") continue;
            const v = node[key];
            const populated = v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
            if (populated) set.add(key);
          }
        }
      }
    } catch {
    }
  }
  const fieldsByTypeArr = {};
  for (const [t, set] of Object.entries(fieldsByType)) fieldsByTypeArr[t] = Array.from(set).sort();
  return { types: Array.from(types).sort(), raw, count: blocks.length, fieldsByType: fieldsByTypeArr };
}

// src/scanner.ts
var RANK_UA = "Mozilla/5.0 (compatible; JeldonCompetitiveIntelBot/1.0)";
function geoScoreHtml(html, geo = defaultGeoConfig) {
  const body = htmlToScorableMarkdown(html);
  const r = calculateGeo(
    { title: "", excerpt: "", tags: [], body, slug: "competitor-homepage" },
    geo
  );
  return { score: r.score, badCount: r.badCount, mehCount: r.mehCount };
}
async function auditHomepage(rawUrl, opts) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const fetched = await opts.fetcher.fetchHtml(url);
  if (!fetched.html)
    return {
      error: fetched.error ? `Fetch failed: ${fetched.error}` : `Fetch failed (status ${fetched.status})`
    };
  const finalUrl = fetched.finalUrl || url;
  const html = fetched.html;
  const ogTag = (prop) => new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i").test(html);
  const twTag = (name) => new RegExp(`<meta[^>]+name=["']twitter:${name}["'][^>]*content=["']([^"']+)["']`, "i").test(html);
  const h1s = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) => stripTags(m[1] ?? "")).filter(Boolean);
  const h2Count = (html.match(/<h2\b/gi) ?? []).length;
  const text = stripTags(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi));
  const imagesWithAlt = imgs.filter((m) => /\salt=["'][^"']+["']/i.test(m[0])).length;
  const links = Array.from(html.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)).map((m) => m[1] ?? "");
  const origin = originOf(finalUrl);
  let internalLinks = 0;
  let externalLinks = 0;
  for (const href of links) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      continue;
    if (href.startsWith("/") || origin && href.startsWith(origin)) internalLinks++;
    else if (/^https?:\/\//i.test(href)) externalLinks++;
  }
  const geo = geoScoreHtml(html, opts.geo);
  return {
    url,
    finalUrl,
    status: fetched.status,
    fetchedVia: fetched.via,
    proxyError: fetched.proxyError,
    htmlBytes: html.length,
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html),
    metaDescription: pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i, html),
    canonicalUrl: pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i, html),
    lang: pick(/<html[^>]+lang=["']([^"']+)["']/i, html),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    h1: h1s.slice(0, 5),
    h2Count,
    wordCount,
    imageCount: imgs.length,
    imagesWithAlt,
    internalLinks,
    externalLinks,
    ogTags: {
      title: ogTag("og:title"),
      description: ogTag("og:description"),
      image: ogTag("og:image"),
      url: ogTag("og:url"),
      type: ogTag("og:type")
    },
    twitterTags: { card: twTag("card"), title: twTag("title"), image: twTag("image") },
    favicon: /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html),
    hasBlogHint: /\/(blog|articles|news|posts)(\/|["'])/i.test(html) || /\bblog\b/i.test(text.slice(0, 4e3)),
    hasFaqHint: /\b(faq|frequently asked|common questions|questions we get|things (patients|people) ask|questions answered)\b/i.test(
      text
    ) || /"@type"\s*:\s*"FAQPage"/i.test(html),
    hasTeamHint: /\b(our team|about us|meet (the|our) (doctor|team)|providers)\b/i.test(text),
    geoScore: geo.score,
    geoBadCount: geo.badCount,
    geoMehCount: geo.mehCount
  };
}
async function auditSitemap(siteUrl) {
  const origin = originOf(siteUrl);
  if (!origin) return { found: false, url: null, urlCount: 0, lastmod: null };
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": RANK_UA } });
      if (!res.ok) continue;
      const xml = await res.text();
      const childSitemaps = Array.from(xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/gi)).map(
        (m) => (m[1] ?? "").trim()
      );
      let urlCount = Array.from(xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/gi)).length;
      const lastmods = Array.from(xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)).map(
        (m) => (m[1] ?? "").trim()
      );
      for (const child of childSitemaps.slice(0, 10)) {
        let childUrl = child;
        try {
          childUrl = new URL(new URL(child).pathname, origin).toString();
        } catch {
        }
        try {
          const cres = await fetch(childUrl, { headers: { "User-Agent": RANK_UA } });
          if (!cres.ok) continue;
          const cxml = await cres.text();
          urlCount += Array.from(cxml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/gi)).length;
          for (const m of cxml.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)) lastmods.push((m[1] ?? "").trim());
        } catch {
        }
      }
      lastmods.sort();
      return { found: true, url, urlCount, lastmod: lastmods.length ? lastmods[lastmods.length - 1] ?? null : null };
    } catch {
    }
  }
  return { found: false, url: null, urlCount: 0, lastmod: null };
}
async function auditRobots(siteUrl) {
  const origin = originOf(siteUrl);
  if (!origin) return { found: false, blocksRoot: false };
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": RANK_UA } });
    if (!res.ok) return { found: false, blocksRoot: false };
    const txt = await res.text();
    const blocksRoot = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*(\n|$)/i.test(txt);
    return { found: true, blocksRoot };
  } catch {
    return { found: false, blocksRoot: false };
  }
}
async function auditPageSpeed(siteUrl, apiKey) {
  const base = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  const cats = "&category=performance&category=seo&category=accessibility&category=best-practices";
  const key = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
  async function one(strategy) {
    const url = `${base}?url=${encodeURIComponent(siteUrl)}&strategy=${strategy}${cats}${key}`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6e4);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) return { err: `PSI ${strategy} ${res.status}` };
      const data = await res.json();
      const cat = data?.lighthouseResult?.categories ?? {};
      const audits = data?.lighthouseResult?.audits ?? {};
      const pctOf = (s) => s != null ? Math.round(s * 100) : null;
      return {
        scores: {
          performance: pctOf(cat.performance?.score),
          seo: pctOf(cat.seo?.score),
          accessibility: pctOf(cat.accessibility?.score),
          bestPractices: pctOf(cat["best-practices"]?.score)
        },
        lcp: audits["largest-contentful-paint"]?.numericValue ? audits["largest-contentful-paint"].numericValue / 1e3 : null,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
        fcp: audits["first-contentful-paint"]?.numericValue ? audits["first-contentful-paint"].numericValue / 1e3 : null
      };
    } catch (err) {
      clearTimeout(to);
      return { err: `PSI ${strategy}: ${err.message}` };
    }
  }
  let [m, d] = await Promise.all([one("mobile"), one("desktop")]);
  if ("scores" in m && m.lcp == null && m.scores.performance == null) {
    const m2 = await one("mobile");
    if ("scores" in m2 && m2.lcp != null) m = m2;
  }
  const errs = [m, d].map((r) => "err" in r ? r.err : null).filter(Boolean);
  const mobile = "scores" in m ? m.scores : null;
  const desktop = "scores" in d ? d.scores : null;
  const fromMobile = "scores" in m ? m : null;
  let partial;
  if (fromMobile && fromMobile.lcp == null && fromMobile.scores.performance == null) {
    partial = "mobile: PSI completed but Lighthouse could not measure LCP (common on cold-start CDN + slow-4G emulation). Other mobile scores and FCP are valid.";
  }
  return {
    mobile,
    desktop,
    lcp: fromMobile?.lcp ?? null,
    cls: fromMobile?.cls ?? null,
    fcp: fromMobile?.fcp ?? null,
    ...errs.length ? { error: errs.join("; ") } : {},
    ...partial ? { partial } : {}
  };
}
var EMPTY_GBP = (error) => ({
  rating: null,
  reviewCount: null,
  responseRate: null,
  photoCount: null,
  hoursComplete: null,
  category: null,
  website: null,
  phone: null,
  address: null,
  lastReviewAt: null,
  error
});
async function auditGbp(placeId, apiKey) {
  if (!placeId) return EMPTY_GBP("No placeId");
  if (!apiKey) return EMPTY_GBP("No Places API key");
  const fields = "name,rating,userRatingCount,reviews,photos,regularOpeningHours,types,websiteUri,nationalPhoneNumber,formattedAddress,primaryTypeDisplayName";
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`;
  try {
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fields }
    });
    if (!res.ok) return EMPTY_GBP(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const withResponse = reviews.filter((r) => r.authorAttribution && r.reply).length;
    const lastReview = reviews.map((r) => r.publishTime).filter((t) => Boolean(t)).sort().reverse()[0] ?? null;
    return {
      rating: data.rating ?? null,
      reviewCount: data.userRatingCount ?? null,
      responseRate: reviews.length ? withResponse / reviews.length : null,
      photoCount: Array.isArray(data.photos) ? data.photos.length : null,
      hoursComplete: Array.isArray(data.regularOpeningHours?.periods) ? data.regularOpeningHours.periods.length >= 5 : null,
      category: data.primaryTypeDisplayName?.text ?? (Array.isArray(data.types) ? data.types[0] : null) ?? null,
      website: data.websiteUri ?? null,
      phone: data.nationalPhoneNumber ?? null,
      address: data.formattedAddress ?? null,
      lastReviewAt: lastReview
    };
  } catch (err) {
    return EMPTY_GBP(err.message);
  }
}
async function listSitemapUrls(sitemapUrl) {
  const all = /* @__PURE__ */ new Set();
  const queue = [sitemapUrl];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length && all.size < 500) {
    const next = queue.shift();
    if (visited.has(next)) continue;
    visited.add(next);
    try {
      const res = await fetch(next, { headers: { "User-Agent": RANK_UA } });
      if (!res.ok) continue;
      const xml = await res.text();
      const childSitemaps = Array.from(xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/gi)).map(
        (m) => (m[1] ?? "").trim()
      );
      for (const c of childSitemaps) if (visited.size < 10) queue.push(c);
      const urls = Array.from(xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/gi)).map(
        (m) => (m[1] ?? "").trim()
      );
      for (const u of urls) all.add(u);
    } catch {
    }
  }
  return Array.from(all);
}
function rankSitemapUrls(urls, cfg) {
  const highValue = cfg.highValuePatterns.map((s) => new RegExp(s, "i"));
  const skip = cfg.skipPatterns.map((s) => new RegExp(s, "i"));
  const scored = urls.filter((u) => !skip.some((re) => re.test(u))).map((u) => {
    let score = 0;
    for (const re of highValue) if (re.test(u)) score += 2;
    try {
      const depth = (new URL(u).pathname.match(/\//g) ?? []).length;
      if (depth >= 2 && depth <= 4) score += 1;
    } catch {
    }
    return { u, score };
  }).filter((r) => r.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((r) => r.u);
}
async function fetchPageExcerpt(url, fetcher) {
  const fetched = await fetcher.fetchHtml(url);
  if (!fetched.html) return null;
  const html = fetched.html;
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const h1 = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) => stripTags(m[1] ?? "")).filter(Boolean).slice(0, 3);
  const h2 = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map((m) => stripTags(m[1] ?? "")).filter(Boolean).slice(0, 12);
  const main = html.replace(/<nav[\s\S]*?<\/nav>/gi, " ").replace(/<header[\s\S]*?<\/header>/gi, " ").replace(/<footer[\s\S]*?<\/footer>/gi, " ").replace(/<aside[\s\S]*?<\/aside>/gi, " ");
  const words = stripTags(main).split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 500).join(" ");
  const schemaTypes = extractSchema(html).types;
  const h2Count = (html.match(/<h2\b/gi) ?? []).length;
  const linkOrigin = originOf(url);
  const links = Array.from(html.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)).map((m) => m[1] ?? "");
  let internalLinks = 0;
  let externalLinks = 0;
  for (const href of links) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      continue;
    if (href.startsWith("/") || linkOrigin && href.startsWith(linkOrigin)) internalLinks++;
    else if (/^https?:\/\//i.test(href)) externalLinks++;
  }
  return { url, title, h1, h2, excerpt, schemaTypes, wordCount: words.length, h2Count, internalLinks, externalLinks };
}
async function samplePages(sitemapUrl, opts) {
  if (!sitemapUrl) return [];
  const all = await listSitemapUrls(sitemapUrl);
  let urls = rankSitemapUrls(all, opts.cfg);
  if (opts.targetOrigin) {
    const target = opts.targetOrigin;
    urls = urls.map((u) => {
      try {
        return new URL(new URL(u).pathname, target).toString();
      } catch {
        return u;
      }
    });
  }
  const ranked = urls.slice(0, opts.limit ?? 8);
  const samples = await Promise.all(ranked.map((u) => fetchPageExcerpt(u, opts.fetcher)));
  return samples.filter((s) => s !== null);
}
function computePageStats(pages, thinPageWordFloor = 300) {
  if (!pages.length) return null;
  const words = pages.map((p) => p.wordCount ?? 0).sort((a, b) => a - b);
  const sum = words.reduce((a, b) => a + b, 0);
  const avg = sum / words.length;
  const median = words.length % 2 === 1 ? words[words.length - 1 >> 1] : (words[words.length / 2 - 1] + words[words.length / 2]) / 2;
  const h2s = pages.map((p) => p.h2Count ?? 0);
  const internals = pages.map((p) => p.internalLinks ?? 0);
  const schemaUnion = /* @__PURE__ */ new Set();
  for (const p of pages) for (const t of p.schemaTypes ?? []) schemaUnion.add(t);
  return {
    count: pages.length,
    avgWordCount: Math.round(avg),
    medianWordCount: Math.round(median),
    minWordCount: words[0],
    maxWordCount: words[words.length - 1],
    thinPageCount: pages.filter((p) => (p.wordCount ?? 0) < thinPageWordFloor).length,
    avgH2Count: Math.round(h2s.reduce((a, b) => a + b, 0) / h2s.length * 10) / 10,
    avgInternalLinks: Math.round(internals.reduce((a, b) => a + b, 0) / internals.length * 10) / 10,
    sitewideSchemaTypes: Array.from(schemaUnion).sort()
  };
}
function detectTemplateVendor(homepageHtml, pages, homepage, cfg = defaultScannerConfig) {
  const html = homepageHtml ?? "";
  for (const vendor of cfg.templateVendors) {
    for (const fp of vendor.fingerprints) {
      try {
        if (new RegExp(fp, "i").test(html)) return vendor.name;
      } catch {
      }
    }
  }
  const stats = computePageStats(pages, cfg.thinPageWordFloor);
  if (stats && homepage && pages.length >= cfg.genericMinSampledPages) {
    const homepageWords = homepage.wordCount ?? 0;
    const cliffRatio = stats.avgWordCount > 0 ? homepageWords / stats.avgWordCount : 0;
    const thinRatio = stats.thinPageCount / pages.length;
    if (cliffRatio >= cfg.genericHomepageWordRatio && thinRatio >= cfg.genericThinPageFraction)
      return "generic-template";
  }
  return null;
}
async function runAudit(opts) {
  const fetcher = opts.fetcher ?? defaultFetcher();
  const cfg = opts.scannerConfig ?? defaultScannerConfig;
  const errors = [];
  const homepageRes = await auditHomepage(opts.url, { fetcher, geo: opts.geo });
  let homepage = null;
  let html = "";
  if ("error" in homepageRes) {
    errors.push(`homepage: ${homepageRes.error}`);
  } else {
    homepage = homepageRes;
    try {
      const r = await fetcher.fetchHtml(homepage.finalUrl);
      if (r.html) html = r.html;
    } catch {
    }
  }
  const targetUrl = homepage?.finalUrl ?? opts.url;
  const [sitemap, robots, pageSpeed, gbp] = await Promise.all([
    auditSitemap(targetUrl).catch((e) => {
      errors.push(`sitemap: ${e.message}`);
      return null;
    }),
    auditRobots(targetUrl).catch((e) => {
      errors.push(`robots: ${e.message}`);
      return null;
    }),
    opts.skipPageSpeed ? Promise.resolve(null) : auditPageSpeed(targetUrl, opts.pageSpeedKey).catch((e) => {
      errors.push(`pagespeed: ${e.message}`);
      return null;
    }),
    opts.placeId ? auditGbp(opts.placeId, opts.placesKey).catch((e) => {
      errors.push(`gbp: ${e.message}`);
      return null;
    }) : Promise.resolve(null)
  ]);
  const homepageSchema = html ? extractSchema(html) : null;
  let homepageText = null;
  if (html) {
    const main = html.replace(/<nav[\s\S]*?<\/nav>/gi, " ").replace(/<header[\s\S]*?<\/header>/gi, " ").replace(/<footer[\s\S]*?<\/footer>/gi, " ").replace(/<aside[\s\S]*?<\/aside>/gi, " ");
    homepageText = stripTags(main).split(/\s+/).slice(0, 1500).join(" ");
  }
  const deploymentOrigin = homepage?.finalUrl ? originOf(homepage.finalUrl) : void 0;
  const pages = opts.skipPageSampling || !sitemap?.found ? [] : await samplePages(sitemap.url, {
    fetcher,
    cfg,
    limit: opts.pageSampleLimit ?? 8,
    targetOrigin: deploymentOrigin
  }).catch((e) => {
    errors.push(`pages: ${e.message}`);
    return [];
  });
  const allTypes = new Set(homepageSchema?.types ?? []);
  const allFields = {};
  if (homepageSchema?.fieldsByType) {
    for (const [t, fields] of Object.entries(homepageSchema.fieldsByType)) {
      const set = allFields[t] ??= /* @__PURE__ */ new Set();
      for (const f of fields) set.add(f);
    }
  }
  for (const p of pages) for (const t of p.schemaTypes) allTypes.add(t);
  const fieldsByType = {};
  for (const [t, set] of Object.entries(allFields)) fieldsByType[t] = Array.from(set).sort();
  const schemaOrg = homepageSchema ? { ...homepageSchema, types: Array.from(allTypes).sort(), fieldsByType } : allTypes.size ? { types: Array.from(allTypes).sort(), raw: [], count: 0, fieldsByType } : null;
  const pageStats = computePageStats(pages, cfg.thinPageWordFloor);
  const templateVendor = detectTemplateVendor(html, pages, homepage, cfg);
  return {
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    homepage,
    homepageText,
    schemaOrg,
    sitemap,
    robots,
    pageSpeed,
    gbp,
    pages,
    pageStats,
    templateVendor,
    positioning: null,
    errors
  };
}
function pct(num, denom) {
  if (num == null || denom == null || denom === 0) return null;
  return Math.round(num / denom * 100);
}
function compareAudits(us, them) {
  const out = [];
  const num = (n, suffix = "") => n == null ? "\u2014" : `${n}${suffix}`;
  const cmp = (label, u, t, higherIsBetter = true, suffix = "") => {
    if (u == null && t == null) return;
    let advantage = "tie";
    if (u != null && t != null) {
      if (u === t) advantage = "tie";
      else if (higherIsBetter ? u > t : u < t) advantage = "us";
      else advantage = "them";
    } else if (u != null) advantage = "us";
    else advantage = "them";
    out.push({ label, us: num(u, suffix), them: num(t, suffix), advantage });
  };
  cmp("Homepage word count", us?.homepage?.wordCount, them.homepage?.wordCount);
  cmp("H2 sections", us?.homepage?.h2Count, them.homepage?.h2Count);
  cmp(
    "Images with alt %",
    pct(us?.homepage?.imagesWithAlt, us?.homepage?.imageCount),
    pct(them.homepage?.imagesWithAlt, them.homepage?.imageCount),
    true,
    "%"
  );
  cmp("Internal links", us?.homepage?.internalLinks, them.homepage?.internalLinks);
  cmp("Schema.org types", us?.schemaOrg?.types.length, them.schemaOrg?.types.length);
  cmp("Sitemap URL count", us?.sitemap?.urlCount, them.sitemap?.urlCount);
  cmp("GBP rating", us?.gbp?.rating, them.gbp?.rating);
  cmp("GBP review count", us?.gbp?.reviewCount, them.gbp?.reviewCount);
  cmp("GBP response rate %", pct(us?.gbp?.responseRate, 1), pct(them.gbp?.responseRate, 1), true, "%");
  cmp("GBP photo count", us?.gbp?.photoCount, them.gbp?.photoCount);
  cmp("PSI mobile performance", us?.pageSpeed?.mobile?.performance, them.pageSpeed?.mobile?.performance);
  cmp("PSI mobile SEO", us?.pageSpeed?.mobile?.seo, them.pageSpeed?.mobile?.seo);
  cmp("LCP (lower better)", us?.pageSpeed?.lcp, them.pageSpeed?.lcp, false, "s");
  cmp("CLS (lower better)", us?.pageSpeed?.cls, them.pageSpeed?.cls, false);
  return out;
}

// src/positioning.ts
import { defaultDraftingConfig } from "@jeldon/config";

// src/prompts.ts
function brandLine(pack) {
  const { name, geoFraming } = pack.brand;
  const persona = pack.voice.persona;
  const where = geoFraming ? ` serving ${geoFraming}` : "";
  return `${name}${where}. ${persona}`;
}
function voiceBlock(pack) {
  const v = pack.voice;
  const lines = [];
  lines.push("Voice + editorial constraints (these apply to anything we would publish or post in response):");
  lines.push(`- ${v.persona}`);
  for (const r of v.rules) lines.push(`- ${r}`);
  if (v.bannedTopics.length) lines.push(`- Never: ${v.bannedTopics.join(", ")}.`);
  if (v.bannedPhrasings.length) lines.push(`- Avoid these phrasings: ${v.bannedPhrasings.join("; ")}.`);
  if (pack.brand.geoFraming) lines.push(`- Default geographic framing: "${pack.brand.geoFraming}".`);
  return lines.join("\n");
}
function buildPositioningSystem(pack) {
  return `You are a competitive intelligence analyst for ${brandLine(pack)} You analyze a rival's own website content \u2014 homepage + a sample of their service/product/blog pages \u2014 to surface what they're actually selling and to whom.

Your output drives our content strategy: the keywords you identify will be prioritized in our own drafts so we can gain ground on them.

Be SPECIFIC. Generic terms every competitor uses are filler. Look for what makes THIS competitor distinctive:

- The exact phrasings they repeat (signature terms / named techniques / branded methods).
- The customer/patient archetypes they court (who they explicitly target).
- Differentiators they emphasize: years of experience, technology, techniques, certifications, acceptance/eligibility, availability.
- Content themes their BLOG/EDUCATION pages cover: explainers, deep-dives, tips, stories.

For each keyword, score weight 1-10 by prominence (repeated in H1s, page titles, repeated across multiple pages = 8-10; mentioned once in passing = 2-3). Classify intent:
- "commercial" = transactional service/product names.
- "informational" = educational queries.
- "navigational" = brand-bound.
- "local" = explicit geo-modified.

Skip pure boilerplate ("welcome", "schedule today"). Focus on what's strategically meaningful.`;
}
function buildGapReportSystem(pack) {
  const categories = pack.content.categories.join("/");
  return `You are a competitive-intelligence analyst for ${brandLine(pack)} Your job is to compare our online presence against a specific competitor's and produce a tight, actionable strategic memo on how to outrank/outperform them.

${voiceBlock(pack)}

You receive structured audit signals (homepage + schema + PSI + GBP + per-page structural stats + detected template vendor) plus a content-derived POSITIONING block (keywords with weights, marketing segments, differentiators, content themes) plus our existing content inventory.

Use positioning as your primary content-gap signal. If they have high-weight keywords or content themes we don't cover, those ARE the gaps. Propose titles that target their high-weight commercial and informational keywords.

=== GEO ("CITABILITY") SCORE \u2014 interpret it correctly ===

Each homepage in the audit has a geoScore field (0-100) measuring how citable the page is by answer engines (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews). Higher = more likely to be quoted/cited verbatim in AI search responses.

How to use the geoScore in your memo:
- If competitor.geoScore < 50 AND we score higher: this is a real strategic advantage to call out under "OUR ADVANTAGES". Answer-engine surface area is increasingly the top-of-funnel; their pages aren't structured for it.
- If competitor.geoScore > 70: they're competing for the AI-citation surface. Don't lean on "we'll outrank them in AI search" as a strategy \u2014 they're playing the same game. Focus elsewhere.
- If they show geoScore > 70 AND they're a template site: rare combination, worth flagging as a serious threat.
- The score is for their HOMEPAGE only. Their deeper page stubs (see pageStats.avgWordCount) are usually MUCH lower-citability \u2014 that's the gap.

=== TEMPLATE-SITE STRATEGY (critical when templateVendor is set) ===

When the competitor's audit shows a templateVendor, they are running a vendor template \u2014 almost certainly identical to dozens of other sites in their vertical. Search engines actively demote templated thin-content sites. Your strategy MUST be:

DO NOT propose:
- Matching their internal-link counts, footer megamenus, or any structural pattern they share with their template siblings.
- Schema or markup features that come "for free" with the template.
- Copying their page structure or topic patterns.

DO propose:
- DEPTH: write long-form (1500+ word) content on the same topics. Their pages are thin stubs. Original long-form destroys template stubs in ranking.
- ORIGINALITY: first-person practitioner voice, real reasoning. None of which their template can replicate.
- AUTHORSHIP: real bylines + Person schema. Templates use generic boilerplate.
- FRESHNESS: a regular publishing cadence. Template sites typically have zero content activity.
- TECHNICAL EXCELLENCE: PSI, schema richness, modern formats.

Cite the actual numbers from pageStats (e.g. "their pages average 247 words").

=== METRIC PARITY \u2014 HARD RULE (applies to EVERY competitor, template or not) ===

Before proposing ANY recommendation that references a count or numeric threshold \u2014 internal links, word count, page/sitemap count, image count, schema-type count, FAQ count, review/photo count, PSI/GEO score \u2014 compare OUR value to THEIRS in the audit first:

- If OUR value already meets or exceeds theirs, it is NOT a gap. It is an advantage. Put it in OUR ADVANTAGES, or omit it. NEVER phrase it as "increase X to N", "expand to N+", "add more Y", or "match their structure" when we already lead.
- Only propose a numeric improvement when the COMPETITOR's value clearly exceeds ours AND closing that specific gap plausibly affects ranking or citability.
- A competitor scoring WORSE than us is THEIR weakness, not our problem. Record it in OUR ADVANTAGES \u2014 NEVER turn it into a quick win, and do NOT manufacture a defensive/hypothetical self-audit ("verify we still lead", "monitor for regression") on an axis where the audit already shows we lead.

VISIBILITY LIMIT \u2014 the audit captures our HOMEPAGE schema/fields plus a small SAMPLE of pages; it does NOT see every templated page type. If our self-audit shows we emit a schema type or feature ANYWHERE (homepage schemaTypes, schemaFieldsByType, or sitewideSchemaTypes), do NOT recommend "add it" or "extend it to all X pages" \u2014 you have no evidence those pages lack it. Only recommend a schema/feature addition when our audit positively shows the absence.

A quick win must name something the competitor HAS or DOES BETTER that we lack \u2014 never a bigger number on an axis we already win. When in doubt, omit it.

Output: a strategic memo with FOUR sections.

1. QUICK WINS \u2014 same-day-shippable beats (missing schema, weaker meta, fewer FAQs, slower LCP, missing OG tags). Each: action, rationale, effort.
2. CONTENT GAPS \u2014 topics they target that we don't cover. Each: suggested title in voice, target query, 3-4 key points, category (${categories}), priority. When competitor is templated, prioritize depth-on-their-topic over fresh-territory pieces.
3. GBP GAPS \u2014 review count, photo count, hours completeness, posts. Each: action + why.
4. OUR ADVANTAGES \u2014 things WE do better. When competitor is templated, our "real content, real voice, real authorship" is the moat \u2014 call it out explicitly.

Be specific with numbers. Skip platitudes \u2014 every line is an action.`;
}

// src/positioning.ts
var ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
var INTENTS = ["commercial", "informational", "navigational", "local"];
var TOOL = {
  name: "extract_positioning",
  description: "Extract the competitor's positioning, target segments, and keyword strategy from their site content.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-3 sentence positioning summary: who they are, who they target, what they lean on." },
      keywords: {
        type: "array",
        minItems: 5,
        maxItems: 30,
        items: {
          type: "object",
          properties: {
            phrase: { type: "string", description: "The actual keyword/phrase, lowercased, as a searcher would type it." },
            weight: { type: "number", description: "1-10, based on prominence across the site." },
            intent: { type: "string", enum: [...INTENTS] }
          },
          required: ["phrase", "weight", "intent"]
        }
      },
      marketingSegments: {
        type: "array",
        items: { type: "string" },
        description: "Customer/patient archetypes they explicitly court."
      },
      differentiators: {
        type: "array",
        items: { type: "string" },
        description: 'What they brag about. E.g. "30+ years experience", "same-day appointments".'
      },
      contentThemes: {
        type: "array",
        items: { type: "string" },
        description: "Topic clusters covered by their blog/education pages."
      }
    },
    required: ["summary", "keywords", "marketingSegments", "differentiators", "contentThemes"]
  }
};
async function extractPositioning(opts) {
  const drafting = opts.drafting ?? defaultDraftingConfig;
  const alias = opts.model ?? drafting.defaultModel;
  const modelId = drafting.models[alias] ?? drafting.models[drafting.defaultModel] ?? alias;
  const pageBlock = opts.pages.length ? opts.pages.map(
    (p, i) => `--- Page ${i + 1}: ${p.url}
Title: ${p.title ?? "(no title)"}
H1: ${p.h1.join(" | ") || "(none)"}
H2: ${p.h2.join(" | ") || "(none)"}
Excerpt (first ~500 words):
${p.excerpt}`
  ).join("\n\n") : "(no service/blog pages sampled)";
  const userMessage = `COMPETITOR: ${opts.competitorName}

HOMEPAGE MAIN CONTENT (~1500 words):
${opts.homepageText || "(homepage text not captured)"}

SAMPLED SERVICE/PRODUCT/BLOG PAGES (${opts.pages.length}):
${pageBlock}

Analyze this content and call extract_positioning.`;
  const reqBody = JSON.stringify({
    model: modelId,
    max_tokens: 4e3,
    system: buildPositioningSystem(opts.pack),
    tools: [TOOL],
    tool_choice: { type: "tool", name: "extract_positioning" },
    messages: [{ role: "user", content: userMessage }]
  });
  let res = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: reqBody
    });
    if (res.ok) break;
    if ((res.status === 529 || res.status === 429 || res.status === 503) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) * (attempt + 1)));
      continue;
    }
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  if (!res || !res.ok) throw new Error("Anthropic request failed after retries");
  const data = await res.json();
  const toolUse = data.content.find((b) => b.type === "tool_use" && b.name === "extract_positioning");
  if (!toolUse?.input) throw new Error(`Model returned no positioning (stop_reason: ${data.stop_reason})`);
  const input = toolUse.input;
  const asArr = (v) => Array.isArray(v) ? v : [];
  const keywords = asArr(input.keywords).filter((k) => k && typeof k === "object").map((k) => {
    const intent = INTENTS.includes(k.intent) ? k.intent : "informational";
    return {
      phrase: String(k.phrase ?? "").trim(),
      weight: Number(k.weight) || 0,
      intent
    };
  }).filter((k) => k.phrase).sort((a, b) => b.weight - a.weight);
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    model: modelId,
    keywords,
    marketingSegments: asArr(input.marketingSegments),
    differentiators: asArr(input.differentiators),
    contentThemes: asArr(input.contentThemes),
    summary: typeof input.summary === "string" ? input.summary : ""
  };
}

// src/gap-report.ts
import { defaultDraftingConfig as defaultDraftingConfig2 } from "@jeldon/config";
var ANTHROPIC_URL2 = "https://api.anthropic.com/v1/messages";
function buildTool(categories) {
  return {
    name: "gap_report",
    description: "Produce a structured competitive strategy memo.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One paragraph TL;DR (<=4 sentences)." },
        quickWins: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "Action sentence, <=30 words." },
              rationale: { type: "string", description: "Why this beats them, <=30 words." },
              effort: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["action", "rationale", "effort"]
          }
        },
        contentGaps: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              suggestedTitle: { type: "string" },
              targetQuery: { type: "string" },
              keyPoints: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
              category: { type: "string", enum: categories },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              rationale: { type: "string", description: "<=30 words." }
            },
            required: ["suggestedTitle", "targetQuery", "keyPoints", "category", "priority", "rationale"]
          }
        },
        gbpGaps: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "<=25 words." },
              rationale: { type: "string", description: "<=25 words." }
            },
            required: ["action", "rationale"]
          }
        },
        ourAdvantages: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              advantage: { type: "string", description: "<=25 words." },
              howToLeanIn: { type: "string", description: "<=25 words." }
            },
            required: ["advantage", "howToLeanIn"]
          }
        }
      },
      required: ["summary", "quickWins", "contentGaps", "gbpGaps", "ourAdvantages"]
    }
  };
}
function slim(a) {
  if (!a) return null;
  return {
    url: a.homepage?.finalUrl,
    homepage: a.homepage ? {
      title: a.homepage.title,
      metaDescription: a.homepage.metaDescription,
      h1: a.homepage.h1,
      h2Count: a.homepage.h2Count,
      wordCount: a.homepage.wordCount,
      imageCount: a.homepage.imageCount,
      imagesWithAlt: a.homepage.imagesWithAlt,
      internalLinks: a.homepage.internalLinks,
      ogTagsPresent: a.homepage.ogTags ? Object.entries(a.homepage.ogTags).filter(([, v]) => v).map(([k]) => k) : [],
      hasFaqHint: a.homepage.hasFaqHint,
      hasBlogHint: a.homepage.hasBlogHint,
      hasTeamHint: a.homepage.hasTeamHint,
      geoScore: a.homepage.geoScore,
      geoBadCount: a.homepage.geoBadCount,
      geoMehCount: a.homepage.geoMehCount
    } : null,
    schemaTypes: a.schemaOrg?.types ?? [],
    schemaFieldsByType: a.schemaOrg?.fieldsByType ?? {},
    sitemapUrlCount: a.sitemap?.urlCount ?? null,
    pageStats: a.pageStats ?? null,
    templateVendor: a.templateVendor ?? null,
    pageSpeed: a.pageSpeed ? {
      mobile: a.pageSpeed.mobile,
      desktop_perf: a.pageSpeed.desktop?.performance,
      lcp_lab: a.pageSpeed.lcp,
      cls_lab: a.pageSpeed.cls
    } : null,
    gbp: a.gbp ? {
      rating: a.gbp.rating,
      reviewCount: a.gbp.reviewCount,
      photosSampled: a.gbp.photoCount,
      hoursComplete: a.gbp.hoursComplete,
      category: a.gbp.category
    } : null,
    positioning: a.positioning ? {
      summary: a.positioning.summary,
      topKeywords: a.positioning.keywords.slice(0, 15).map((k) => ({ phrase: k.phrase, weight: k.weight, intent: k.intent })),
      marketingSegments: a.positioning.marketingSegments,
      differentiators: a.positioning.differentiators,
      contentThemes: a.positioning.contentThemes
    } : null
  };
}
async function gapReport(opts) {
  const drafting = opts.drafting ?? defaultDraftingConfig2;
  const alias = opts.model ?? drafting.defaultModel;
  const modelId = drafting.models[alias] ?? drafting.models[drafting.defaultModel] ?? alias;
  const pathPrefix = opts.inventoryPathPrefix ?? "articles";
  const inventoryBlock = opts.articleInventory.length ? opts.articleInventory.map((a) => `- [${a.category}] /${pathPrefix}/${a.slug} \u2014 "${a.title}"`).join("\n") : "(no content yet)";
  const focusBlock = '\n\nFor every quickWin, cite the SPECIFIC audit value (ours and theirs) in the rationale so the recommendation can be sanity-checked. Apply the METRIC PARITY hard rule: if ours already meets or exceeds theirs on that value, it is an ourAdvantages item or omitted \u2014 NEVER a quickWin. Re-read each quickWin before returning and delete any that (a) say "increase/expand/add more" on a metric we already lead, or (b) ask to audit, verify, monitor, or guard against regression on a metric where our audit value already meets or beats theirs.';
  const userMessage = `COMPETITOR: ${opts.competitorName}

COMPETITOR AUDIT:
${JSON.stringify(slim(opts.competitorAudit), null, 2)}

OUR SITE:
${opts.ourAudit ? JSON.stringify(slim(opts.ourAudit), null, 2) : "(no self-audit \u2014 assume strong schema, FAQ, fast pages, and the content inventory below)"}${focusBlock}

CONTENT INVENTORY (${opts.articleInventory.length}; do not propose duplicates):
${inventoryBlock}

TARGET KEYWORDS:
${opts.targetKeywords.length ? opts.targetKeywords.map((k) => `- ${k}`).join("\n") : "(none specified)"}

Produce the gap report by calling gap_report.`;
  const res = await fetch(ANTHROPIC_URL2, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 8e3,
      stream: true,
      system: buildGapReportSystem(opts.pack),
      tools: [buildTool(opts.pack.content.categories)],
      tool_choice: { type: "tool", name: "gap_report" },
      messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("Anthropic returned no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let toolJsonAccumulator = "";
  let stopReason = null;
  const processEvent = (ev) => {
    const dataLines = ev.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, ""));
    if (!dataLines.length) return;
    const payload = dataLines.join("\n").trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload);
      if (json.type === "content_block_delta" && json.delta?.type === "input_json_delta") {
        toolJsonAccumulator += json.delta.partial_json ?? "";
      } else if (json.type === "message_delta" && json.delta?.stop_reason) {
        stopReason = json.delta.stop_reason;
      }
    } catch {
    }
  };
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const ev of events) processEvent(ev);
  }
  buf += decoder.decode().replace(/\r\n/g, "\n");
  if (buf.trim()) for (const ev of buf.split("\n\n")) processEvent(ev);
  if (!toolJsonAccumulator) {
    throw new Error(`Model returned no tool input (stop_reason: ${stopReason ?? "unknown"})`);
  }
  if (stopReason === "max_tokens") {
    throw new Error(
      "Gap report truncated \u2014 model hit max_tokens (8000) before finishing. Try regenerating."
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(toolJsonAccumulator);
  } catch (e) {
    const head = toolJsonAccumulator.slice(0, 200);
    const tail = toolJsonAccumulator.slice(-200);
    throw new Error(
      `Failed to parse streamed tool input (${e.message}; stop_reason=${stopReason ?? "unknown"}; accumulated ${toolJsonAccumulator.length} chars). Head: ${head} \u2026 Tail: ${tail}`
    );
  }
  return { ...parsed, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), model: modelId };
}

// src/ranks.ts
import { readFile, writeFile } from "fs/promises";
var SERPAPI_URL = "https://serpapi.com/search.json";
var PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
var normName = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function nameMatches(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 6 && longer.includes(shorter);
}
async function rankOneSerpApi(keyword, location, ourPlaceId, ourName, serpApiKey, competitorPlaceIds, competitorNames) {
  const url = `${SERPAPI_URL}?engine=google_local&q=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&hl=en&gl=us&api_key=${encodeURIComponent(serpApiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  if (data.error) throw new Error(`SerpApi: ${data.error}`);
  const list = Array.isArray(data.local_results) ? data.local_results : data.local_results?.places ?? [];
  const ourNorm = normName(ourName);
  const competitorNameList = Object.entries(competitorNames);
  let rank = null;
  const top = [];
  const competitorRanks = {};
  for (const cid of Object.values(competitorPlaceIds)) competitorRanks[cid] = null;
  for (const cid of Object.values(competitorNames)) if (!(cid in competitorRanks)) competitorRanks[cid] = null;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const pos = typeof r.position === "number" ? r.position : i + 1;
    const pid = r.place_id;
    const nameNorm = normName(r.title);
    const isUs = !!pid && pid === ourPlaceId || nameMatches(nameNorm, ourNorm);
    if (isUs && rank === null) rank = pos;
    if (top.length < 5) top.push({ name: r.title ?? "(unnamed)", rank: pos, isUs });
    let cId = pid ? competitorPlaceIds[pid] : void 0;
    if (!cId && nameNorm) {
      const hit = competitorNameList.find(([cn]) => nameMatches(nameNorm, cn));
      cId = hit?.[1];
    }
    if (cId && competitorRanks[cId] == null) competitorRanks[cId] = pos;
  }
  return {
    keyword,
    rank,
    totalReturned: list.length,
    topCompetitors: top,
    competitorRanks,
    sampledAt: (/* @__PURE__ */ new Date()).toISOString(),
    method: "serpapi-local"
  };
}
async function rankOnePlaces(keyword, center, ourPlaceId, placesKey, competitorPlaceIds) {
  const res = await fetch(PLACES_TEXT_URL, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": placesKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      textQuery: keyword,
      locationBias: { circle: { center, radius: 16093 } },
      // ~10mi
      languageCode: "en",
      regionCode: "US"
    })
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const places = data.places ?? [];
  let rank = null;
  const top = [];
  const competitorRanks = {};
  for (const cid of Object.values(competitorPlaceIds)) competitorRanks[cid] = null;
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    const isUs = p.id === ourPlaceId;
    if (isUs && rank === null) rank = i + 1;
    if (i < 5) top.push({ name: p.displayName?.text ?? "(unnamed)", rank: i + 1, isUs });
    const competitorId = competitorPlaceIds[p.id];
    if (competitorId && competitorRanks[competitorId] == null) competitorRanks[competitorId] = i + 1;
  }
  return {
    keyword,
    rank,
    totalReturned: places.length,
    topCompetitors: top,
    competitorRanks,
    sampledAt: (/* @__PURE__ */ new Date()).toISOString(),
    method: "places"
  };
}
async function trackLocalRanks(opts) {
  const { competitors, keys, store } = opts;
  const serpApiKey = keys.serpapi;
  const placesKey = keys.places;
  if (!serpApiKey && !placesKey) {
    throw new Error("Set serpapi (preferred \u2014 real local pack) or places API key.");
  }
  const useSerpApi = !!serpApiKey;
  const ourPlaceId = competitors.ourPlaceId;
  if (!ourPlaceId) throw new Error("competitors.ourPlaceId is required for rank tracking.");
  const location = competitors.localPackLocation && competitors.localPackLocation.trim() || opts.defaultLocation || "United States";
  const ourName = competitors.ourName || "Us";
  const center = opts.center ?? null;
  if (!useSerpApi && !center) {
    throw new Error("A resolved center coordinate is required for the Places method.");
  }
  const keywords = opts.keywords.map((k) => String(k).trim()).filter(Boolean);
  if (!keywords.length) throw new Error("No keywords to rank.");
  const existing = await store.read();
  const updated = { ...existing.ranks };
  const errors = [];
  const competitorPlaceIds = {};
  const competitorNames = {};
  for (const c of competitors.roster) {
    if (c.placeId) competitorPlaceIds[c.placeId] = c.id;
    if (c.name) competitorNames[normName(c.name)] = c.id;
  }
  const batchSize = opts.batchSize ?? 5;
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (kw) => {
        try {
          const rank = useSerpApi ? await rankOneSerpApi(kw, location, ourPlaceId, ourName, serpApiKey, competitorPlaceIds, competitorNames) : await rankOnePlaces(kw, center, ourPlaceId, placesKey, competitorPlaceIds);
          return [kw, rank];
        } catch (e) {
          errors.push(`${kw}: ${e.message}`);
          return [kw, null];
        }
      })
    );
    for (const [kw, rank] of results) if (rank) updated[kw] = rank;
  }
  const out = {
    ranks: updated,
    lastRun: (/* @__PURE__ */ new Date()).toISOString(),
    method: useSerpApi ? "serpapi-local" : "places",
    ...useSerpApi ? { location } : {}
  };
  await store.write(out);
  return {
    ok: true,
    refreshed: keywords.length,
    method: out.method,
    ...useSerpApi ? { location } : {},
    errors,
    ranks: out.ranks
  };
}
function aggregatePriorityKeywords(opts) {
  const agg = /* @__PURE__ */ new Map();
  for (const a of opts.competitorAudits) {
    const pos = a.positioning;
    if (!pos) continue;
    for (const k of pos.keywords) {
      const phrase = String(k.phrase ?? "").toLowerCase().trim();
      if (!phrase) continue;
      const cur = agg.get(phrase) ?? { phrase, totalWeight: 0 };
      cur.totalWeight += Number(k.weight ?? 0);
      agg.set(phrase, cur);
    }
  }
  const ours = new Set(
    (opts.ourPositioningKeywords ?? []).map((k) => String(k.phrase ?? "").toLowerCase().trim()).filter(Boolean)
  );
  const covered = opts.covered ?? (() => false);
  return Array.from(agg.values()).filter((k) => !ours.has(k.phrase) && !covered(k.phrase)).sort((a, b) => b.totalWeight - a.totalWeight).slice(0, opts.limit ?? 30);
}
var EMPTY_RANKS = { ranks: {}, lastRun: null };
var FsRanksStore = class {
  constructor(path) {
    this.path = path;
  }
  path;
  async read() {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw);
      return { ranks: parsed.ranks ?? {}, lastRun: parsed.lastRun ?? null, method: parsed.method, location: parsed.location };
    } catch {
      return { ...EMPTY_RANKS };
    }
  }
  async write(data) {
    await writeFile(this.path, JSON.stringify(data, null, 2) + "\n", "utf8");
  }
};
var NullRanksStore = class {
  data;
  constructor(seed) {
    this.data = seed ?? { ...EMPTY_RANKS };
  }
  async read() {
    return this.data;
  }
  async write(data) {
    this.data = data;
  }
};

// src/pack.ts
function scannerConfigFromPack(pack) {
  return resolveScannerConfig(pack.competitors);
}
function geoConfigFromPack(pack) {
  return pack.scoring.geo;
}
function competitorsFromPack(pack) {
  return pack.competitors ?? null;
}
function rankKeysFromEnv(env) {
  return {
    serpapi: env.SERPAPI_KEY,
    places: env.GOOGLE_PLACES_API_KEY
  };
}
function scannerKeysFromEnv(env) {
  return {
    pageSpeedKey: env.GOOGLE_PAGESPEED_API_KEY,
    placesKey: env.GOOGLE_PLACES_API_KEY,
    scrapingBeeKey: env.SCRAPINGBEE_KEY
  };
}
export {
  DefaultFetcher,
  FsRanksStore,
  NullRanksStore,
  aggregatePriorityKeywords,
  auditGbp,
  auditHomepage,
  auditPageSpeed,
  auditRobots,
  auditSitemap,
  buildGapReportSystem,
  buildPositioningSystem,
  compareAudits,
  competitorsFromPack,
  computePageStats,
  decode,
  defaultFetcher,
  defaultScannerConfig,
  detectTemplateVendor,
  extractPositioning,
  extractSchema,
  gapReport,
  geoConfigFromPack,
  geoScoreHtml,
  htmlToScorableMarkdown,
  originOf,
  pick,
  rankKeysFromEnv,
  rankOnePlaces,
  rankOneSerpApi,
  resolveScannerConfig,
  runAudit,
  samplePages,
  scannerConfigFromPack,
  scannerKeysFromEnv,
  stripTags,
  trackLocalRanks
};
