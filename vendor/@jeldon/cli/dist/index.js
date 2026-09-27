#!/usr/bin/env node

// src/index.ts
import { resolveConfigPath, validateDomainPack, loadDomainPack as loadDomainPack3 } from "@jeldon/config";

// src/doctor.ts
import { loadDomainPack } from "@jeldon/config";
async function runDoctor(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const checks = [];
  const add = (status, message) => checks.push({ status, message });
  let pack;
  try {
    pack = await loadDomainPack({ cwd });
    add("ok", "jeldon.config.ts present and valid against schema");
  } catch (err) {
    add("error", err instanceof Error ? err.message : String(err));
    return finalize(checks);
  }
  for (const v of pack.services.requiredEnv) {
    if (process.env[v]) add("ok", `env ${v} present`);
    else add(opts.pre ? "warn" : "error", `env ${v} missing`);
  }
  const targets = Object.values(pack.content.categoryTargets);
  if (targets.length) {
    const minTarget = Math.min(...targets);
    if (pack.scoring.geo.floor <= minTarget) add("ok", `GEO floor ${pack.scoring.geo.floor} <= lowest category target ${minTarget}`);
    else add("error", `GEO floor ${pack.scoring.geo.floor} exceeds lowest category target ${minTarget}`);
  }
  const orphanTargets = Object.keys(pack.content.categoryTargets).filter((c) => !pack.content.categories.includes(c));
  if (orphanTargets.length) add("error", `categoryTargets has categories not in content.categories: ${orphanTargets.join(", ")}`);
  else add("ok", "category enum consistent across config");
  if (pack.aeo.querySet.length >= 3) add("ok", `AEO query set has ${pack.aeo.querySet.length} queries`);
  else if (pack.aeo.querySet.length > 0) add("warn", `AEO query set has only ${pack.aeo.querySet.length} (recommend >= 3)`);
  else add("error", "AEO query set is empty \u2014 add >= 3 queries");
  if (pack.voice.voiceAnchorUrls.length) add("ok", `${pack.voice.voiceAnchorUrls.length} voice anchor URL(s) set`);
  else add("warn", "no voiceAnchorUrls set \u2014 drafting voice fidelity degraded");
  if (pack.capabilities.drafting && !pack.services.requiredEnv.some((v) => /ANTHROPIC|OPENAI|API_KEY/.test(v))) {
    add("warn", "capabilities.drafting is on but no LLM API key is listed in services.requiredEnv");
  }
  return finalize(checks);
}
function finalize(checks) {
  const errors = checks.filter((c) => c.status === "error").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  return { checks, errors, warnings, ok: errors === 0 };
}

// src/check-geo-floor.ts
import { readFile, readdir } from "fs/promises";
import { resolve, basename } from "path";
import { loadDomainPack as loadDomainPack2 } from "@jeldon/config";
import { calculateGeo } from "@jeldon/core-scoring";
import { parse, isLive } from "@jeldon/content-model";
var DEFAULT_CONTENT_DIR = "src/content/articles";
function toLifecycleFlags(fm) {
  return {
    draft: fm.draft === true,
    docReviewed: fm.docReviewed === true,
    ready: fm.ready === true,
    scheduled: fm.scheduled === true
  };
}
function evaluateGeoFloor(files, geo, targets, floor) {
  const results = [];
  let skipped = 0;
  for (const { path, raw } of files) {
    const { frontmatter, body } = parse(raw);
    if (!isLive(toLifecycleFlags(frontmatter))) {
      skipped++;
      continue;
    }
    const slug = basename(path, ".md");
    const { score } = calculateGeo(
      {
        title: String(frontmatter.title ?? ""),
        excerpt: String(frontmatter.excerpt ?? ""),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        body,
        slug,
        heroImage: typeof frontmatter.heroImage === "string" ? frontmatter.heroImage : void 0,
        heroImageAlt: typeof frontmatter.heroImageAlt === "string" ? frontmatter.heroImageAlt : void 0
      },
      geo
    );
    const category = String(frontmatter.category ?? "");
    const target = targets[category] ?? floor;
    results.push({ slug, file: path, category, score, target, ok: score >= target });
  }
  const failed = results.filter((r) => !r.ok).length;
  return { results, scored: results.length, skipped, failed, ok: failed === 0 };
}
async function runCheckGeoFloor(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const pack = await loadDomainPack2({ cwd });
  const contentDir = resolve(cwd, pack.services.contentDir ?? DEFAULT_CONTENT_DIR);
  const paths = await resolveArticlePaths(cwd, contentDir, opts.files ?? []);
  const files = await Promise.all(
    paths.map(async (path) => ({ path, raw: await readFile(path, "utf8") }))
  );
  return evaluateGeoFloor(
    files,
    pack.scoring.geo,
    pack.content.categoryTargets,
    pack.scoring.geo.floor
  );
}
async function resolveArticlePaths(cwd, contentDir, args) {
  const explicit = args.filter((a) => a.endsWith(".md"));
  if (explicit.length) return explicit.map((f) => resolve(cwd, f));
  const entries = await readdir(contentDir);
  return entries.filter((f) => f.endsWith(".md")).sort().map((f) => resolve(contentDir, f));
}

// src/index.ts
var ICON = { ok: "\u2714", warn: "\u26A0", error: "\u2716" };
function hasFlag(args, flag) {
  return args.includes(flag);
}
async function main() {
  const [, , cmd, ...rest] = process.argv;
  const json = hasFlag(rest, "--json");
  switch (cmd) {
    case "validate": {
      const path = resolveConfigPath();
      if (!path) {
        fail("No jeldon.config.ts found in the current directory.", json);
        return;
      }
      try {
        const pack = await loadDomainPack3();
        const result = validateDomainPack(pack);
        if (result.ok) {
          if (json) console.log(JSON.stringify({ ok: true }, null, 2));
          else console.log(`${ICON.ok} ${path} is a valid Domain Pack`);
        } else {
          fail(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"), json);
        }
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err), json);
      }
      return;
    }
    case "doctor": {
      const report = await runDoctor({ pre: hasFlag(rest, "--pre") });
      if (json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        for (const c of report.checks) console.log(line(c));
        console.log(
          `
${report.ok ? ICON.ok : ICON.error} doctor: ${report.errors} error(s), ${report.warnings} warning(s)`
        );
      }
      if (!report.ok) process.exitCode = 1;
      return;
    }
    case "check-geo-floor": {
      const files = rest.filter((a) => a.endsWith(".md"));
      try {
        const report = await runCheckGeoFloor({ files });
        if (json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          for (const r of report.results) {
            const cat = r.category || "uncategorized";
            const msg = `${r.slug}: GEO ${r.score} ${r.ok ? ">=" : "<"} ${r.target} (${cat})`;
            if (r.ok) console.log(`${ICON.ok} ${msg}`);
            else console.error(`${ICON.error} ${msg}`);
          }
          const tail = report.skipped ? ` (${report.skipped} draft(s) skipped)` : "";
          console.log(
            `
${report.ok ? ICON.ok : ICON.error} check-geo-floor: ${report.failed} of ${report.scored} scored article(s) below target${tail}`
          );
        }
        if (!report.ok) process.exitCode = 1;
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err), json);
      }
      return;
    }
    case "init": {
      console.log(
        [
          "jeldon init is not yet wired to the Copier template generator.",
          "For now, scaffold a project with:",
          "",
          "  npx degit dryoung1029/jeldon/template my-site",
          "  cd my-site && pnpm install",
          "  # fill jeldon.config.ts (diff against examples/jeldon.config.example.ts)",
          "  npx jeldon doctor --pre",
          "",
          "See docs/IMPLEMENTATION.md for the full runbook."
        ].join("\n")
      );
      return;
    }
    default:
      console.log(
        [
          "jeldon <command>",
          "",
          "  validate                 Validate jeldon.config.ts against the Domain Pack schema",
          '  doctor [--pre]           Run the "wired correctly?" health check (--json for machines)',
          "  check-geo-floor [file\u2026]  Score articles; fail if any are below their category target",
          "  init                     Scaffold a new project (see docs/IMPLEMENTATION.md)",
          "",
          "Flags: --json  machine-readable output"
        ].join("\n")
      );
      if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 1;
  }
}
function line(c) {
  return `${ICON[c.status] ?? "?"} ${c.message}`;
}
function fail(message, json) {
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`${ICON.error} ${message}`);
  process.exitCode = 1;
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
