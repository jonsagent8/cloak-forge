// Wraps the artifact fragment (index.html) into standalone documents for
// GitHub Pages. The fragment has <title>/<meta>/<link>/<style> then the body
// markup; we lift the head bits into a real <head> and add production-only
// tags (canonical, OG/Twitter, favicon).
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";

const SITE_URL = "https://cloakforgeai.com";
const fragment = await readFile(new URL("./index.html", import.meta.url), "utf8");

// Split at the end of the first <style> block: everything before it (minus the
// raw <title>) is head material; everything after is body.
const styleEnd = fragment.indexOf("</style>") + "</style>".length;
const headSrc = fragment.slice(0, styleEnd);
const bodySrc = fragment.slice(styleEnd).trim();

const title = (headSrc.match(/<title>([^<]*)<\/title>/) || [])[1] || "Cloak Forge";
const desc = (headSrc.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
const headNoTitle = headSrc.replace(/<title>[\s\S]*?<\/title>\s*/, "");

const SOCIAL = `
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cloak Forge">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/og-image.png">
<link rel="icon" href="favicon.ico?v=2" sizes="32x32">
<link rel="icon" href="favicon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="favicon-192.png?v=2" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=2">
`.trim();

// The header and footer live in index.html (the artifact source); every other
// page gets those same two blocks swapped in, so the nav is edited in one place.
const HEADER = bodySrc.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
const FOOTER = bodySrc.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
const withChrome = (body) =>
  body
    .replace(/<header class="site-header">[\s\S]*?<\/header>/, HEADER)
    .replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, FOOTER);

function page({ title, head, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
${head}
${SOCIAL}
</head>
<body>
${body}
</body>
</html>
`;
}

await mkdir(new URL("./docs", import.meta.url), { recursive: true });

await writeFile(
  new URL("./docs/index.html", import.meta.url),
  page({ title, head: headNoTitle, body: bodySrc })
);

// Every other page is authored as its own fragment file
const pages = [
  {
    file: "about.fragment.html",
    out: "about.html",
    title: "About — Cloak Forge",
    desc: "What Cloak Forge does, why we run AI on your own machine, and what to expect when you work with us.",
  },
  {
    file: "offerings.fragment.html",
    out: "offerings.html",
    title: "What we offer — Cloak Forge",
    desc: "Remote setup, mail-in SSD processing, tutoring, and the Cloak Forge Launcher — plus how to get in touch.",
  },
  {
    file: "launcher.fragment.html",
    out: "launcher.html",
    title: "Cloak Forge Launcher — local-AI dashboard for your Mac",
    desc: "A one-download terminal dashboard that scans your Mac, picks a model sized to your hardware, and runs it entirely on-device via a bundled Ollama.",
  },
  {
    file: "email.fragment.html",
    out: "email.html",
    title: "Cloak Forge Email — AI inbox drafting & auto-send rules",
    desc: "Reads your inbox, drafts replies, and can send them for you on rules you set — a Cloak Forge Launcher Connection running on the model you already have.",
  },
  {
    file: "privacy.fragment.html",
    out: "privacy.html",
    title: "Privacy — Cloak Forge",
    desc: "How Cloak Forge handles the information you send through this site.",
  },
];

for (const { file, out, title, desc } of pages) {
  const body = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  await writeFile(
    new URL(`./docs/${out}`, import.meta.url),
    page({
      title,
      head: headNoTitle.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}">`),
      body: withChrome(body.trim()),
    })
  );
}

await mkdir(new URL("./docs/media", import.meta.url), { recursive: true });
for (const asset of ["favicon.svg", "favicon.ico", "favicon-32.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png", "og-image.png", "media/waterfall-120.mp4", "media/waterfall-120-portrait.mp4", "media/waterfall-120-720.mp4", "media/waterfall-poster.jpg", "media/waterfall-poster-portrait.jpg", "media/fire-100-portrait.mp4", "media/fire-poster-portrait.jpg", "media/storm-120-tall.mp4", "media/storm-poster-tall.jpg"]) {
  await copyFile(new URL(`./${asset}`, import.meta.url), new URL(`./docs/${asset}`, import.meta.url));
}
await writeFile(new URL("./docs/.nojekyll", import.meta.url), "");
await writeFile(new URL("./docs/CNAME", import.meta.url), new URL(SITE_URL).host + "\n");

console.log(`built docs/ -> index.html, ${pages.map((p) => p.out).join(", ")}, favicon.svg, CNAME`);
