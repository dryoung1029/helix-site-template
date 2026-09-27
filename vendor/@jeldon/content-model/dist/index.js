// src/frontmatter.ts
var FM_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
var FM_LINE_RE = /^([A-Za-z0-9_]+):\s*(.*)$/;
function parse(raw) {
  const match = raw.match(FM_BLOCK_RE);
  if (!match) return { frontmatter: {}, body: raw };
  const [, fmRaw, body] = match;
  const fm = {};
  for (const line of (fmRaw ?? "").split(/\r?\n/)) {
    const m = line.match(FM_LINE_RE);
    if (!m) continue;
    const [, key, valRaw] = m;
    if (key === void 0) continue;
    fm[key] = parseValue((valRaw ?? "").trim());
  }
  return { frontmatter: fm, body: body ?? "" };
}
function parseValue(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => unquote(s.trim()));
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  const unq = unquote(v);
  if (/^-?[1-9]\d*(\.\d+)?$/.test(unq) || unq === "0") return Number(unq);
  return unq;
}
function unquote(v) {
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    return unescapeStr(v.slice(1, -1));
  }
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
    return v.slice(1, -1);
  }
  return v;
}
function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n");
}
function unescapeStr(s) {
  return s.replace(/\\(.)/g, (_, c) => c === "n" ? "\n" : c);
}
function serialize({ frontmatter, body }) {
  const lines = ["---"];
  for (const [key, val] of Object.entries(frontmatter)) {
    lines.push(`${key}: ${formatValue(val)}`);
  }
  lines.push("---", "");
  return lines.join("\n") + body.replace(/^\n+/, "");
}
function formatValue(v) {
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `[${v.map((s) => `"${escapeStr(s)}"`).join(", ")}]`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^[a-z]+$/.test(v) && v.length < 20) return v;
  return `"${escapeStr(v)}"`;
}

// src/lifecycle.ts
function articleStatus(flags, opts = {}) {
  if (!flags.draft) return "live";
  if (flags.scheduled) return "scheduled";
  if (flags.ready) return "ready";
  if (opts.docReviewedEnabled && flags.docReviewed) return "docReviewed";
  return "draft";
}
function isLive(flags) {
  return !flags.draft;
}
function isStub(flags) {
  return Boolean(flags.draft && (flags.ready === true || flags.scheduled === true));
}
function isAutoPublishCandidate(flags) {
  return Boolean(flags.draft && flags.scheduled);
}
function selectPublished(articles, opts = {}) {
  if (opts.includeDrafts) return articles.slice();
  return articles.filter((a) => isLive(a));
}
function selectStubs(articles) {
  return articles.filter((a) => isStub(a));
}

// src/schema.ts
import { z } from "zod";
function buildArticleSchema(pack, opts = {}) {
  const categories = pack.content.categories;
  if (categories.length === 0) {
    throw new Error("buildArticleSchema: pack.content.categories is empty.");
  }
  const categoryEnum = z.enum(categories);
  const defaultAuthorSlug = opts.defaultAuthorSlug ?? pack.content.defaultAuthorSlug;
  const defaultAuthor = opts.defaultAuthorName ?? pack.authors.find((a) => a.slug === defaultAuthorSlug)?.profile.name ?? pack.authors.find((a) => a.isPrimary)?.profile.name ?? pack.authors[0]?.profile.name ?? "Staff";
  return z.object({
    title: z.string(),
    excerpt: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: categoryEnum,
    author: z.string().default(defaultAuthor),
    authorSlug: z.string().default(defaultAuthorSlug),
    readTime: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    draft: z.boolean().default(false),
    // Editorial-handoff state (Doc's review pass). Still a draft for publishing.
    docReviewed: z.boolean().default(false),
    docNotes: z.string().optional(),
    ready: z.boolean().default(false),
    scheduled: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    // Audio narration fields — written out-of-band by the audio route; never
    // hand-edited. Numbers must coerce so a stringly-quoted round-trip doesn't
    // abort the whole content build.
    audioUrl: z.string().optional(),
    audioBodyHash: z.string().optional(),
    audioBodyLength: z.number().optional(),
    audioFileSize: z.number().optional(),
    audioGeneratedAt: z.coerce.date().optional(),
    sourceEpisode: z.string().url().optional(),
    // Newsletter automation state — written by the auto-newsletter cron. Brevo
    // returns numeric campaign IDs the cron sometimes writes unquoted, so coerce
    // to string rather than fail the schema and abort the build.
    newsletterCampaignId: z.coerce.string().optional(),
    newsletterScheduledAt: z.coerce.date().optional(),
    newsletterStatus: z.enum(["queued", "sent", "cancelled", "error"]).optional(),
    newsletterError: z.string().optional()
  });
}

// src/validate.ts
function validateArticle(input, pack, opts = {}) {
  const { frontmatter, body } = typeof input === "string" ? parse(input) : { frontmatter: input.frontmatter, body: input.body ?? "" };
  const schema = buildArticleSchema(pack, opts);
  const parsed = schema.safeParse(frontmatter);
  if (parsed.success) {
    return { ok: true, data: parsed.data, body, errors: [] };
  }
  return {
    ok: false,
    body,
    errors: parsed.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message
    }))
  };
}

// src/publish.ts
function todayInZone(timezone, now = /* @__PURE__ */ new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(now);
}
function publishScheduled(articles, timezone, now = /* @__PURE__ */ new Date()) {
  const today = todayInZone(timezone, now);
  const published = [];
  const skipped = [];
  for (const article of articles) {
    const { raw, id } = article;
    const parsed = parse(raw);
    if (!raw.match(/^---\r?\n[\s\S]*?\r?\n---/)) {
      skipped.push({ id, reason: "no frontmatter" });
      continue;
    }
    const fm = parsed.frontmatter;
    const draft = fm.draft === true;
    const scheduled = fm.scheduled === true;
    if (!isAutoPublishCandidate({ draft, scheduled })) {
      continue;
    }
    const publishDate = String(fm.publishDate ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
      skipped.push({ id, reason: `invalid publishDate: "${String(fm.publishDate ?? "")}"` });
      continue;
    }
    if (publishDate > today) continue;
    let updated = raw.replace(
      /^(---[\s\S]*?\n)draft:\s*true(\s*\n[\s\S]*?---)/m,
      "$1draft: false$2"
    );
    if (updated === raw) {
      skipped.push({ id, reason: "couldn't flip draft (regex mismatch)" });
      continue;
    }
    updated = updated.replace(
      /^(---[\s\S]*?\n)scheduled:\s*true\s*\n([\s\S]*?---)/m,
      "$1$2"
    );
    published.push({ id, publishDate, raw: updated });
  }
  return { today, timezone, scanned: articles.length, published, skipped };
}
var MemoryArticleSource = class {
  constructor(docs) {
    this.docs = docs;
  }
  docs;
  list() {
    return this.docs;
  }
  write(id, raw) {
    const doc = this.docs.find((d) => d.id === id);
    if (doc) doc.raw = raw;
  }
};
async function publishScheduledFromSource(source, timezone, now = /* @__PURE__ */ new Date()) {
  const docs = await source.list();
  const result = publishScheduled(docs, timezone, now);
  for (const p of result.published) {
    await source.write(p.id, p.raw);
  }
  return result;
}

// src/fs-source.ts
import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
var FsArticleSource = class {
  constructor(dir) {
    this.dir = dir;
  }
  dir;
  async list() {
    const files = await readdir(this.dir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const docs = [];
    for (const file of mdFiles) {
      const raw = await readFile(join(this.dir, file), "utf8");
      docs.push({ id: file, raw });
    }
    return docs;
  }
  async write(id, raw) {
    await writeFile(join(this.dir, id), raw, "utf8");
  }
};
export {
  FsArticleSource,
  MemoryArticleSource,
  articleStatus,
  buildArticleSchema,
  isAutoPublishCandidate,
  isLive,
  isStub,
  parse,
  parseValue,
  publishScheduled,
  publishScheduledFromSource,
  selectPublished,
  selectStubs,
  serialize,
  todayInZone,
  validateArticle
};
