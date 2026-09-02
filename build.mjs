// Wraps the artifact fragment (index.html) into standalone documents for
// GitHub Pages. The fragment has <title>/<meta>/<link>/<style> then the body
// markup; we lift the head bits into a real <head> and add production-only
// tags (canonical, OG/Twitter, favicon).
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";

const SITE_URL = "https://jonsagent8.github.io/cloak-forge";
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
<meta name="twitter:card" content="summary">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
`.trim();

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

// privacy.html is authored as its own fragment in privacy.fragment.html
const privacyBody = await readFile(new URL("./privacy.fragment.html", import.meta.url), "utf8");
await writeFile(
  new URL("./docs/privacy.html", import.meta.url),
  page({
    title: "Privacy — Cloak Forge",
    head: headNoTitle.replace(
      /<meta name="description"[^>]*>/,
      '<meta name="description" content="How Cloak Forge handles the information you send through this site.">'
    ),
    body: privacyBody.trim(),
  })
);

await copyFile(new URL("./favicon.svg", import.meta.url), new URL("./docs/favicon.svg", import.meta.url));
await writeFile(new URL("./docs/.nojekyll", import.meta.url), "");

console.log("built docs/ -> index.html, privacy.html, favicon.svg, .nojekyll");
