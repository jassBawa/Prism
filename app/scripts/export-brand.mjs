// Rasterize the Prism brand SVGs into PNGs.
// Usage:  node scripts/export-brand.mjs    (run from the app/ directory)
// Requires: sharp (devDependency). If sharp is unavailable, open
// public/brand/export.html in a browser instead — same output, zero deps.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = join(root, "public", "brand");
const DENSITY = 384; // high density so curves stay crisp when downscaled

const render = (src, size, out) =>
  sharp(join(brand, src), { density: DENSITY })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(brand, out))
    .then(() => console.log(`  ${out}  (${size}x${size})`));

async function main() {
  console.log("icon + app-icon sizes:");
  await render("prism-icon.svg", 512, "prism-icon-512.png");
  await render("prism-icon.svg", 256, "prism-icon-256.png");
  await render("prism-icon.svg", 128, "prism-icon-128.png");
  await render("prism-icon.svg", 180, "apple-touch-icon-180.png");

  console.log("favicons:");
  await render("favicon.svg", 32, "favicon-32.png");
  await render("favicon.svg", 16, "favicon-16.png");

  console.log("social card:");
  const W = 1200, H = 630;
  const LOGO_W = 760;
  const logoImg = sharp(join(brand, "prism-logo.svg"), { density: DENSITY }).resize({ width: LOGO_W });
  const logo = await logoImg.toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const caption = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120">
       <text x="${W / 2}" y="70" text-anchor="middle"
         font-family="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
         font-size="34" font-weight="500" fill="#475569">
         Deposit one token. Hold a self-rebalancing index fund on Solana.
       </text>
     </svg>`
  );
  const logoTop = Math.round((H - logoMeta.height) / 2) - 36;
  await sharp({ create: { width: W, height: H, channels: 4, background: "#FBFBFD" } })
    .composite([
      { input: logo, top: logoTop, left: Math.round((W - LOGO_W) / 2) },
      { input: caption, top: logoTop + logoMeta.height + 24, left: 0 },
    ])
    .png()
    .toFile(join(brand, "og-image.png"));
  console.log("  og-image.png  (1200x630)");

  console.log("done.");
}

main().catch((e) => {
  console.error("export failed:", e.message);
  console.error("Fallback: open public/brand/export.html in a browser.");
  process.exit(1);
});
