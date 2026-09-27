#!/usr/bin/env node
/**
 * Build favicon.png, apple-touch-icon.png and the social-share image from the
 * owner's logo file. Run after replacing public/brand/logo-horizontal.webp.
 *   npm run icons
 * The mark is taken from the left part of the horizontal logo; adjust
 * MARK_FRACTION if a new logo has different proportions.
 */
import sharp from 'sharp';
const LOGO = 'public/brand/logo-horizontal.webp';
const MARK_FRACTION = 0.27; // how much of the logo width is the symbol

const meta = await sharp(LOGO).metadata();
const w = meta.width ?? 0, h = meta.height ?? 0;
const markW = Math.round(w * MARK_FRACTION);
const side = Math.max(markW, h);
const mark = await sharp(LOGO).extract({ left: 0, top: 0, width: markW, height: h }).toBuffer();
// Composite first at full size (inputs must fit the canvas), then resize.
const square = await sharp({ create: { width: side, height: side, channels: 3, background: '#ffffff' } })
  .composite([{ input: mark, left: Math.round((side - markW) / 2), top: Math.round((side - h) / 2) }])
  .png()
  .toBuffer();
await sharp(square).resize(64, 64).png().toFile('public/favicon.png');
await sharp(square).resize(180, 180).png().toFile('public/apple-touch-icon.png');

const logo = await sharp(LOGO).resize({ width: 900, height: 400, fit: 'inside' }).png().toBuffer();
const lm = await sharp(logo).metadata();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } })
  .composite([{ input: logo, left: Math.round((1200 - (lm.width ?? 0)) / 2), top: Math.round((630 - (lm.height ?? 0)) / 2) }])
  .jpeg({ quality: 88 })
  .toFile('public/brand/og-default.jpg');
console.log('✔ favicon.png, apple-touch-icon.png, brand/og-default.jpg rebuilt from the logo');
