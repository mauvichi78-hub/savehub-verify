// Per-source brand thumbnails. Uses official logos from `simple-icons`
// (cleanly drawn, MIT-licensed) on top of each brand's official solid color.
//
// Instagram is special-cased to keep the iconic gradient — the single hex
// the package ships (#FF0069) loses the brand's actual visual identity.
//
// `web` has no real brand so we render a generic globe glyph.
//
// Run: node scripts/generate-thumbs.mjs
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

const W = 600;
const H = 600;
const ICON_RATIO = 0.5; // icon takes 50% of canvas
const ICON_SIZE = W * ICON_RATIO;
const SCALE = ICON_SIZE / 24; // simple-icons uses 24x24 viewBox
const OFFSET = (W - ICON_SIZE) / 2;
const OUT = "public/thumb";

await mkdir(OUT, { recursive: true });

async function readBrandPath(slug) {
  const file = `node_modules/simple-icons/icons/${slug}.svg`;
  const svg = await readFile(file, "utf8");
  // Extract just the d attribute from the single <path> element.
  const match = svg.match(/<path d="([^"]+)"/);
  if (!match) throw new Error(`No path found in ${file}`);
  return match[1];
}

// Maps our internal `Source` keys -> simple-icons slug + override settings.
const sources = [
  { key: "youtube", slug: "youtube", bg: "#FF0000" },
  {
    key: "instagram",
    slug: "instagram",
    // Iconic 5-stop diagonal gradient — much more recognizable than the
    // single hex (#FF0069) the package gives us.
    bg: "url(#igGrad)",
    defs: `
      <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FEDA77"/>
        <stop offset="25%" stop-color="#F58529"/>
        <stop offset="50%" stop-color="#DD2A7B"/>
        <stop offset="75%" stop-color="#8134AF"/>
        <stop offset="100%" stop-color="#515BD4"/>
      </linearGradient>
    `,
  },
  { key: "tiktok", slug: "tiktok", bg: "#000000" },
  { key: "twitter", slug: "x", bg: "#000000" }, // 'twitter' source -> X brand
  { key: "whatsapp", slug: "whatsapp", bg: "#25D366" },
  { key: "telegram", slug: "telegram", bg: "#26A5E4" },
];

function svgFor({ bg, defs, path }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>${defs ?? ""}</defs>
    <rect width="${W}" height="${H}" fill="${bg}"/>
    <g transform="translate(${OFFSET},${OFFSET}) scale(${SCALE})">
      <path d="${path}" fill="white"/>
    </g>
  </svg>`;
}

// Generic globe for the 'web' source — no real brand to borrow from.
function webSvg() {
  const cx = W / 2;
  const cy = H / 2;
  const r = W * 0.28;
  const sw = W * 0.025;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#2E7DF7"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${sw}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.42}" ry="${r}" fill="none" stroke="white" stroke-width="${sw}"/>
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="white" stroke-width="${sw}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.42}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.7"/>
  </svg>`;
}

for (const s of sources) {
  const path = await readBrandPath(s.slug);
  const svg = svgFor({ ...s, path });
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${s.key}.png`);
  console.log("  ->", `${OUT}/${s.key}.png`);
}

await sharp(Buffer.from(webSvg())).png().toFile(`${OUT}/web.png`);
console.log("  ->", `${OUT}/web.png`);

console.log("done");
