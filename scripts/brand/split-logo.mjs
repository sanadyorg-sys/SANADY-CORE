#!/usr/bin/env node
/**
 * Splits the official logo into three stacked layers so the eyes and the
 * smile can be animated (src/components/brand/brand-logo.tsx):
 *   sanady-logo[-light]-letters.png   everything that is not orange
 *   sanady-logo-eyes.png              orange dots inside the « a » and « d »
 *   sanady-logo-smile.png             orange arc under the word
 * Layers keep the source size (694×316) so they line up exactly.
 *
 *   node scripts/brand/split-logo.mjs
 */
import sharp from "sharp";

const DIR = "public/brand/";
// The smile starts below this row; the eyes sit above it.
const SMILE_TOP = 200;

const isOrange = (r, g, b) => r > 150 && r - b > 110 && g < 170 && r - g > 60;
// Around the eyes, anti-aliased pixels are orange blended with white: they
// belong to the eyes too, or a faint ring would show during a blink.
const EYE_BOX = { x0: 360, x1: 545, y0: 118, y1: 180 };
const isEyeEdge = (x, y, r, g, b) =>
  x >= EYE_BOX.x0 && x <= EYE_BOX.x1 && y >= EYE_BOX.y0 && y <= EYE_BOX.y1 && r > 180 && r - b > 25 && r - g > 15;

async function split(source, lettersOut, withOrange) {
  const { data, info } = await sharp(DIR + source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const letters = Buffer.from(data);
  const eyes = Buffer.alloc(data.length);
  const smile = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a === 0) continue;
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);
    if (!isOrange(r, g, b) && !isEyeEdge(x, y, r, g, b)) continue;
    (y < SMILE_TOP ? eyes : smile).set([r, g, b, a], i);
    letters[i + 3] = 0;
  }
  const png = (buf) => sharp(buf, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 });
  await png(letters).toFile(DIR + lettersOut);
  if (withOrange) {
    await png(eyes).toFile(DIR + "sanady-logo-eyes.png");
    await png(smile).toFile(DIR + "sanady-logo-smile.png");
  }
}

await split("sanady-logo.png", "sanady-logo-letters.png", true);
await split("sanady-logo-light.png", "sanady-logo-light-letters.png", false);
console.log("✓ logo layers written to public/brand/");
