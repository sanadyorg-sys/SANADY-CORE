#!/usr/bin/env node
/**
 * Extracts brand assets from the Fondation Sanady banner supplied by the
 * client (ASSETSSO/fondation-sanady-banner-original.jpg, a phone screenshot).
 *
 *   node scripts/brand/extract-brand-assets.mjs [path-to-banner]
 *
 * Outputs (public/brand):
 *   sanady-logo.png          logo, transparent background (colours untouched)
 *   sanady-logo-light.png    same logo for dark backgrounds (black → white, orange kept)
 *   sanady-tagline.png       « Préparons les adultes du Maroc de demain », transparent
 *   sanady-banner.jpg        full banner
 *   sanady-classroom.jpg     photograph part of the banner
 *
 * Transparency uses "colour to alpha" against the white panel of the banner,
 * so anti-aliased edges stay clean and colours are not altered.
 * NOTE: the source is a low-resolution screenshot. Re-run this script with
 * the original high-resolution artwork as soon as the foundation provides it.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "../ASSETSSO/fondation-sanady-banner-original.jpg";
const OUT = join("public", "brand");
mkdirSync(OUT, { recursive: true });

const source = sharp(SRC);
const { width, height } = await source.metadata();

// 1) Locate the banner: rows that are not the black screenshot background.
const { data: raw, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const rowBrightness = (y) => {
  let sum = 0;
  for (let x = 0; x < info.width; x += 4) {
    const i = (y * info.width + x) * info.channels;
    sum += raw[i] + raw[i + 1] + raw[i + 2];
  }
  return sum / Math.ceil(info.width / 4) / 3;
};
let top = -1;
let bottom = -1;
for (let y = 0; y < height; y++) {
  if (rowBrightness(y) > 60) {
    if (top < 0) top = y;
    bottom = y;
  }
}
const bannerHeight = bottom - top + 1;
const banner = { left: 0, top, width, height: bannerHeight };
console.log(`banner: ${width}×${bannerHeight} at y=${top}`);

// Relative regions inside the banner (measured on the supplied artwork).
const region = (x0, y0, x1, y1) => ({
  left: Math.round(x0 * width),
  top: top + Math.round(y0 * bannerHeight),
  width: Math.round((x1 - x0) * width),
  height: Math.round((y1 - y0) * bannerHeight),
});
// Generous bounds (the logo is trimmed afterwards); the photo starts at x ≈ 0.354.
const LOGO = region(0.045, 0.3, 0.35, 0.745);
const TAGLINE = region(0.055, 0.73, 0.31, 0.92);
const PHOTO = region(0.355, 0, 1, 1);

/** Colour-to-alpha against white; optional recolour of dark pixels.
 *  `erase`: fractional rectangles of the crop to clear (stray doodle strokes). */
async function toTransparentPng(rect, file, { lightVariant = false, scale = 2, erase = [] } = {}) {
  const { data, info: meta } = await sharp(SRC).extract(rect).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(meta.width * meta.height * 4);
  for (let p = 0; p < meta.width * meta.height; p++) {
    const r = data[p * meta.channels];
    const g = data[p * meta.channels + 1];
    const b = data[p * meta.channels + 2];
    // Alpha = how far the pixel is from white (minimum channel distance).
    let a = 1 - Math.min(r, g, b) / 255;
    a = a < 0.08 ? 0 : Math.min(1, (a - 0.08) / 0.92); // clean the paper texture
    const un = (c) => (a > 0 ? Math.round(Math.max(0, Math.min(255, (c - 255 * (1 - a)) / a))) : 0);
    let [R, G, B] = [un(r), un(g), un(b)];
    // Light variant: only the logo orange is kept; everything else becomes white.
    const isOrange = R > 150 && R - B > 100;
    if (lightVariant && !isOrange) [R, G, B] = [255, 255, 255];
    const x = p % meta.width;
    const y = Math.floor(p / meta.width);
    const erased = erase.some((e) => x >= e.x0 * meta.width && x <= e.x1 * meta.width && y >= e.y0 * meta.height && y <= e.y1 * meta.height);
    out[p * 4] = R;
    out[p * 4 + 1] = G;
    out[p * 4 + 2] = B;
    out[p * 4 + 3] = erased ? 0 : Math.round(a * 255);
  }
  await sharp(out, { raw: { width: meta.width, height: meta.height, channels: 4 } })
    .trim({ threshold: 1 })
    // Clear space so anti-aliased edges are never shaved by the bounding box.
    .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: meta.width * scale, kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, file));
  console.log(`✓ ${file}`);
}

// The banner's doodle line ends just above the logo's top-right corner.
const LOGO_ERASE = [{ x0: 0.87, y0: 0, x1: 1, y1: 0.225 }];
await toTransparentPng(LOGO, "sanady-logo.png", { erase: LOGO_ERASE });
await toTransparentPng(LOGO, "sanady-logo-light.png", { lightVariant: true, erase: LOGO_ERASE });
await toTransparentPng(TAGLINE, "sanady-tagline.png");

await sharp(SRC).extract(banner).jpeg({ quality: 88, mozjpeg: true }).toFile(join(OUT, "sanady-banner.jpg"));
console.log("✓ sanady-banner.jpg");
await sharp(SRC).extract(PHOTO).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, "sanady-classroom.jpg"));
console.log("✓ sanady-classroom.jpg");

// Logo bytes for server-side PDF generation (works on any host, no file I/O).
const pdfLogo = await sharp(join(OUT, "sanady-logo.png")).resize({ height: 220 }).png({ compressionLevel: 9, palette: true, quality: 100 }).toBuffer();
writeFileSync(
  join("src", "lib", "pdf", "brand-logo.ts"),
  `// Generated by scripts/brand/extract-brand-assets.mjs — do not edit.\n` +
    `/** Fondation Sanady logo (PNG, transparent) for PDF documents. */\n` +
    `export const BRAND_LOGO_PNG_BASE64 =\n  "${pdfLogo.toString("base64")}";\n`,
);
console.log(`✓ src/lib/pdf/brand-logo.ts (${pdfLogo.length} bytes)`);
