#!/usr/bin/env node
/**
 * Shrink photos the owner uploaded to public/photos/ so pages stay fast.
 * Anything wider than 1600px is resized; everything becomes .webp. Originals
 * move to public/photos/originals/ (kept in git so nothing is lost).
 *
 *   npm run photos                 # all new photos in public/photos
 *   npm run photos -- --square a.jpg b.jpg   # also center-crop these to 1:1 (coach headshots)
 */
import { readdir, mkdir, rename, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const DIR = 'public/photos';
const args = process.argv.slice(2);
const square = args.includes('--square');
const only = args.filter((a) => !a.startsWith('--'));
const ORIG = join(DIR, 'originals');
await mkdir(ORIG, { recursive: true });

const files = (await readdir(DIR)).filter((f) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f) && (!only.length || only.includes(f)));
if (!files.length) {
  console.log(`No photos in ${DIR}/ yet.`);
  process.exit(0);
}
for (const f of files) {
  const src = join(DIR, f);
  const out = join(DIR, basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.webp');
  const before = (await stat(src)).size;
  try {
    const img = sharp(src).rotate();
    const meta = await img.metadata();
    const resized = square
      ? img.resize({ width: 800, height: 800, fit: 'cover', position: 'attention', withoutEnlargement: false })
      : img.resize({ width: Math.min(meta.width ?? 1600, 1600), withoutEnlargement: true });
    await resized.webp({ quality: 82 }).toFile(out + '.tmp');
    await rename(src, join(ORIG, f));
    await rename(out + '.tmp', out);
    const after = (await stat(out)).size;
    console.log(`✔ ${f} → ${basename(out)} (${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB)`);
  } catch (e) {
    console.error(`✖ ${f}: ${e.message}`);
  }
}
console.log('\nDone. Reference photos as /photos/<name>.webp');
