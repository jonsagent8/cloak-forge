// Wraps the artifact fragment (index.html) into standalone documents for
// GitHub Pages. The fragment has <title>/<meta>/<link>/<style> then the body
// markup; we lift the head bits into a real <head> and add production-only
// tags (canonical, OG/Twitter, favicon).
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from "node:fs/promises";

const SITE_URL = "https://cloakforgeai.com";
const fragment = await readFile(new URL("./index.html", import.meta.url), "utf8");

// Split at the end of the first <style> block: everything before it (minus the
// raw <title>) is head material; everything after is body.
const styleEnd = fragment.indexOf("</style>") + "</style>".length;
const headSrc = fragment.slice(0, styleEnd);
const bodySrc = fragment.slice(styleEnd).trim();

const headNoTitle = headSrc.replace(/<title>[\s\S]*?<\/title>\s*/, "");

// ---------------------------------------------------------------------------
// Per-page SEO: one entry per published page. Titles stay under ~60 chars and
// descriptions at 140–155 (the build warns otherwise). `path` is the page's
// public URL path, used for canonical, og:url, the sitemap and breadcrumbs.
// ---------------------------------------------------------------------------
const PAGES = [
  {
    path: "/",
    out: "index.html",
    title: "Private Local AI Automation for Mac | Cloak Forge",
    desc: "Cloak Forge builds private AI automations that run on your own Apple Silicon Mac. No cloud AI, no API bills, and it works offline. Setups from $400.",
    type: "WebPage",
  },
  {
    path: "/about.html",
    file: "about.fragment.html",
    out: "about.html",
    crumb: "About",
    title: "About Cloak Forge: Private AI That Runs on Your Mac",
    desc: "Cloak Forge sets up private AI on your own Apple Silicon Mac. See what we build, why local beats cloud AI, and which models your Mac's memory can run.",
    type: "AboutPage",
  },
  {
    path: "/offerings.html",
    file: "offerings.fragment.html",
    out: "offerings.html",
    crumb: "What we offer",
    title: "Local AI Setup Services & Pricing | Cloak Forge",
    desc: "Local AI services for Apple Silicon Macs: remote setup from $400, mail-in SSD processing from $650, tutoring at $250/hr. We reply within one business day.",
    type: "WebPage",
  },
  {
    path: "/launcher.html",
    file: "launcher.fragment.html",
    out: "launcher.html",
    crumb: "Cloak Forge Launcher",
    parent: "offerings",
    title: "Cloak Forge Launcher: Run Local AI Models on Your Mac",
    desc: "Cloak Forge Launcher scans your Mac, picks the largest AI model it can run well, and runs it on-device with bundled Ollama. $50 one-time, no subscription.",
    type: "WebPage",
    image: "/media/launcher-dashboard.webp",
  },
  {
    path: "/email.html",
    file: "email.fragment.html",
    out: "email.html",
    crumb: "Cloak Forge Email",
    parent: "offerings",
    title: "Cloak Forge Email: Local AI Email Drafting for Mac",
    desc: "Cloak Forge Email reads your inbox, drafts replies with local AI on your Mac, and auto-sends only on rules you approve. An add-on for Cloak Forge Launcher.",
    type: "WebPage",
    image: "/media/email-chat.webp",
  },
  {
    path: "/privacy.html",
    file: "privacy.fragment.html",
    out: "privacy.html",
    crumb: "Privacy",
    title: "Privacy Policy & Private Mode | Cloak Forge",
    desc: "How Cloak Forge keeps AI on your Mac: what Private Mode blocks, how we tested it, its known limits, and what this website collects (no tracking at all).",
    type: "WebPage",
  },
  {
    path: "/blog/",
    file: "blog.fragment.html",
    out: "blog/index.html",
    crumb: "Blog",
    title: "Cloak Forge Blog: Running Local AI on Apple Silicon Macs",
    desc: "Hands-on notes on running local AI on Apple Silicon Macs: how much memory you need, which models each Mac can run, and what works for local agents.",
    type: "CollectionPage",
  },
  {
    path: "/blog/mac-ram-local-ai/",
    file: "blog-mac-ram-local-ai.fragment.html",
    out: "blog/mac-ram-local-ai/index.html",
    crumb: "How Much RAM Do You Need for Local AI on a Mac?",
    title: "How Much RAM Do You Need for Local AI on a Mac?",
    desc: "I ran local AI on four M4 Macs, from 16GB to 48GB. Here's what each RAM tier can really do, and whether you actually need 128GB to run local models.",
    type: "WebPage",
    image: "/media/mac-mini-box-local-ai.webp",
    trail: [{ name: "Blog", path: "/blog/" }],
    og: {
      type: "article",
      image: "/media/mac-mini-og.jpg",
      alt: "Jonathan Hansraj holding a sealed Apple Mac mini box",
    },
    article: {
      headline: "How Much RAM Do You Need to Run Local AI on a Mac?",
      author: "Jonathan Hansraj",
      datePublished: "2026-10-19",
      dateModified: "2026-10-19",
      image: { url: "/media/mac-mini-box-local-ai.webp", width: 900, height: 1200 },
      faq: true,
    },
  },
];

for (const p of PAGES) {
  if (p.title.length > 60) console.warn(`! title over 60 chars (${p.title.length}): ${p.out}`);
  if (p.desc.length < 140 || p.desc.length > 155) console.warn(`! description ${p.desc.length} chars (want 140–155): ${p.out}`);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

// Facts shared by every page's structured data; keep in sync with the copy.
// LocalBusiness is a subtype of Organization, so this one entity carries both
// the brand facts and the service area.
const ORGANIZATION = {
  "@type": "LocalBusiness",
  "@id": ORG_ID,
  name: "Cloak Forge",
  alternateName: "Cloak Forge AI",
  url: `${SITE_URL}/`,
  // No street address is published; region and country only.
  address: { "@type": "PostalAddress", addressRegion: "NY", addressCountry: "US" },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Rockland County, New York" },
    { "@type": "Place", name: "Hudson Valley, New York" },
    { "@type": "Country", name: "United States", description: "Remote setup, done-for-you processing, mail-in SSD service and tutoring" },
  ],
  logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
  image: `${SITE_URL}/og-image.png`,
  description:
    "Cloak Forge builds private AI automations that run on the customer's own Apple Silicon Mac, with no cloud AI service, plus remote setup, done-for-you processing, mail-in SSD processing, tutoring, and the Cloak Forge Launcher app.",
  email: "jonsagent8@gmail.com",
  contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: "jonsagent8@gmail.com", availableLanguage: "English" },
  knowsAbout: ["Local AI", "On-device large language models", "AI automation", "Apple Silicon", "Ollama", "Data privacy"],
  makesOffer: [
    { name: "Remote setup", desc: "A custom AI automation built and tested by Cloak Forge, then sent to you ready to run on your Apple Silicon Mac.", price: { minPrice: 400 } },
    { name: "Done-for-you processing", desc: "Send your documents or data and Cloak Forge runs them through local AI on its own Mac, then sends back the results. Quoted per job." },
    { name: "Mail-in SSD service", desc: "Ship an encrypted SSD; it is processed on an air-gapped machine and returned with the results. No copies retained.", price: { minPrice: 650 } },
    { name: "One-on-one tutoring", desc: "Learn to run local AI yourself on your own Apple Silicon Mac.", price: { price: 250, unitText: "hour" } },
  ].map(({ name, desc, price }) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name, description: desc, provider: { "@id": ORG_ID } },
    ...(price && { priceSpecification: { "@type": "UnitPriceSpecification", priceCurrency: "USD", ...price } }),
  })),
};
const WEBSITE = { "@type": "WebSite", "@id": SITE_ID, url: `${SITE_URL}/`, name: "Cloak Forge", inLanguage: "en", publisher: { "@id": ORG_ID } };

// Product entities for the two software pages.
const PRODUCTS = {
  "/launcher.html": {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/launcher.html#software`,
    name: "Cloak Forge Launcher",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "macOS (Apple Silicon)",
    description: "A terminal dashboard that scans your Mac, recommends the largest language model it can run well, and runs it on-device through a bundled Ollama, with local chat, Private Mode and add-on Connections.",
    screenshot: `${SITE_URL}/media/launcher-dashboard.webp`,
    offers: { "@type": "Offer", price: 50, priceCurrency: "USD", description: "One-time purchase with free updates.", url: "https://buy.stripe.com/4gM00c0mobOy6Ov3lGdEs00", availability: "https://schema.org/InStock" },
    publisher: { "@id": ORG_ID },
  },
  "/email.html": {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/email.html#software`,
    name: "Cloak Forge Email",
    applicationCategory: "BusinessApplication",
    operatingSystem: "macOS (Apple Silicon)",
    description: "An add-on Connection for Cloak Forge Launcher that reads your inbox over IMAP, drafts replies with the Launcher's local AI model, and auto-sends only on rules you turn on. Pricing not yet set.",
    screenshot: `${SITE_URL}/media/email-chat.webp`,
    publisher: { "@id": ORG_ID },
  },
};

// HTML snippet -> plain text (tags stripped, the entities the fragments use decoded).
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", ndash: "\u2013", mdash: "\u2014", nbsp: " " };
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m).trim();

function jsonLd(p) {
  const url = SITE_URL + p.path;
  const graph = [ORGANIZATION, WEBSITE];
  const webpage = {
    "@type": p.type,
    "@id": `${url}#webpage`,
    url,
    name: p.title,
    description: p.desc,
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    about: { "@id": ORG_ID },
    ...(p.image && { primaryImageOfPage: { "@type": "ImageObject", url: SITE_URL + p.image } }),
  };
  if (p.crumb) {
    const trail = [{ name: "Home", url: `${SITE_URL}/` }];
    if (p.parent) {
      const parent = PAGES.find((q) => q.out === `${p.parent}.html`);
      trail.push({ name: parent.crumb, url: SITE_URL + parent.path });
    }
    for (const t of p.trail || []) trail.push({ name: t.name, url: SITE_URL + t.path });
    trail.push({ name: p.crumb, url });
    webpage.breadcrumb = { "@id": `${url}#breadcrumb` };
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: t.url })),
    });
  }
  if (p.article) {
    const a = p.article;
    graph.push({
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: a.headline,
      description: p.desc,
      inLanguage: "en",
      author: { "@type": "Person", name: a.author, url: `${SITE_URL}/` },
      publisher: { "@id": ORG_ID },
      datePublished: a.datePublished,
      dateModified: a.dateModified,
      image: { "@type": "ImageObject", url: SITE_URL + a.image.url, width: a.image.width, height: a.image.height },
      mainEntityOfPage: { "@id": `${url}#webpage` },
      isPartOf: { "@id": SITE_ID },
    });
    webpage.mainEntity = { "@id": `${url}#article` };
    if (a.faq) {
      // Questions and answers are read from the page's own FAQ section, so the
      // structured data always matches the visible text.
      const section = p.body.match(/<section class="faq">([\s\S]*?)<\/section>/)[1];
      const qa = [...section.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)];
      graph.push({
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        isPartOf: { "@id": `${url}#webpage` },
        mainEntity: qa.map(([, q, ans]) => ({
          "@type": "Question",
          name: plain(q),
          acceptedAnswer: { "@type": "Answer", text: plain(ans) },
        })),
      });
    }
  }
  if (PRODUCTS[p.path]) {
    graph.push(PRODUCTS[p.path]);
    webpage.mainEntity = { "@id": PRODUCTS[p.path]["@id"] };
  }
  graph.push(webpage);
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 1).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// Cloudflare Web Analytics: cookie-free visit counts (see privacy page).
const CF_ANALYTICS = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "e941dd285d8a4e43ab0842e58bb7b24b"}'></script><!-- End Cloudflare Web Analytics -->`;

function seoHead(p) {
  const url = SITE_URL + p.path;
  return `
<meta name="description" content="${esc(p.desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${p.og?.type || "website"}">
<meta property="og:site_name" content="Cloak Forge">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}${p.og?.image || "/og-image.png"}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.og?.alt || "Cloak Forge: private AI automation, forged on your machine")}">${p.article ? `
<meta property="article:published_time" content="${p.article.datePublished}">
<meta property="article:modified_time" content="${p.article.dateModified}">
<meta property="article:author" content="${esc(p.article.author)}">
<meta name="author" content="${esc(p.article.author)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.desc)}">
<meta name="twitter:image" content="${SITE_URL}${p.og?.image || "/og-image.png"}">
<meta name="twitter:image:alt" content="${esc(p.og?.alt || "Cloak Forge: private AI automation, forged on your machine")}">
<link rel="icon" href="favicon.ico?v=2" sizes="32x32">
<link rel="icon" href="favicon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="favicon-192.png?v=2" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=2">
${jsonLd(p)}
${CF_ANALYTICS}`.trim();
}

// The header and footer live in index.html (the artifact source); every other
// page gets those same two blocks swapped in, so the nav is edited in one place.
const HEADER = bodySrc.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
const FOOTER = bodySrc.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
const withChrome = (body) =>
  body
    .replace(/<header class="site-header">[\s\S]*?<\/header>/, HEADER)
    .replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, FOOTER);

function page(p, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(p.title)}</title>
${headNoTitle.replace(/<meta name="description"[^>]*>\s*/, "")}
${seoHead(p)}
</head>
<body>
${body}
</body>
</html>
`;
}

await mkdir(new URL("./docs", import.meta.url), { recursive: true });

// The live homepage is home.html — a complete, standalone animated page (bead
// canvas + scroll effects). index.html stays the artifact source and the place
// the shared header/footer for the other pages are edited. Its own <title> and
// description are replaced by the PAGES entry above.
const home = await readFile(new URL("./home.html", import.meta.url), "utf8");
const homePage = PAGES.find((p) => p.path === "/");
await writeFile(
  new URL("./docs/index.html", import.meta.url),
  home
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(homePage.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/, "")
    .replace("</head>", `${seoHead(homePage)}\n<meta name="theme-color" content="#040610">\n</head>`)
);

// Pages in a subfolder (e.g. blog/<slug>/index.html) get their relative links
// and asset paths pointed back up to the site root.
const toRoot = (html, out) => {
  const up = "../".repeat(out.split("/").length - 1);
  if (!up) return html;
  return html
    .replace(/(href|src)="(?![a-z]+:|#|\/)/g, `$1="${up}`)
    .replace(/url\((?![a-z]+:|\/)/g, `url(${up}`);
};

const prettyDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

for (const p of PAGES.filter((p) => p.file)) {
  let body = await readFile(new URL(`./${p.file}`, import.meta.url), "utf8");
  if (p.article) {
    const d = p.article.dateModified;
    body = body.replace("{{LAST_UPDATED}}", `<time datetime="${d}">${prettyDate(d)}</time>`);
  }
  if (body.includes("{{POST_LIST}}")) {
    // The blog index lists every post (any page with an `article`), newest first.
    const posts = PAGES.filter((q) => q.article).sort((a, b) => b.article.datePublished.localeCompare(a.article.datePublished));
    const items = posts.map((q) => `        <li>
          <time datetime="${q.article.datePublished}">${prettyDate(q.article.datePublished)}</time>
          <h2><a href="${q.path.slice(1)}">${esc(q.article.headline)}</a></h2>
          <p>${esc(q.desc)}</p>
        </li>`);
    body = body.replace("{{POST_LIST}}", `<ul class="posts">\n${items.join("\n")}\n      </ul>`);
  }
  p.body = body;
  const dest = new URL(`./docs/${p.out}`, import.meta.url);
  await mkdir(new URL(".", dest), { recursive: true });
  await writeFile(dest, toRoot(page(p, withChrome(body.trim())), p.out));
}

// sitemap.xml (lastmod = when the page's source last changed) and robots.txt
const lastmod = async (p) => p.article?.dateModified || (await stat(new URL(`./${p.file || "home.html"}`, import.meta.url))).mtime.toISOString().slice(0, 10);
const urls = [];
for (const p of PAGES) urls.push(`  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${await lastmod(p)}</lastmod></url>`);
await writeFile(
  new URL("./docs/sitemap.xml", import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
);
// Crawlers named explicitly so each one has its own "allowed" group.
const ALLOWED_BOTS = ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"];
await writeFile(
  new URL("./docs/robots.txt", import.meta.url),
  `# Every page on this site is public. Search engines and AI assistants are welcome.
${ALLOWED_BOTS.map((bot) => `User-agent: ${bot}\nAllow: /\n`).join("\n")}
User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
);

await mkdir(new URL("./docs/media", import.meta.url), { recursive: true });
await mkdir(new URL("./docs/fonts/google", import.meta.url), { recursive: true });
await mkdir(new URL("./docs/vendor", import.meta.url), { recursive: true });
// Self-hosted copies of Google Fonts (the same WOFF2 files and CSS Google
// serves) and Lenis 1.1.13 from npm, so pages make no third-party requests.
const googleFonts = (await readdir(new URL("./fonts/google", import.meta.url))).filter((f) => f.endsWith(".woff2")).map((f) => `fonts/google/${f}`);
for (const asset of ["favicon.svg", "favicon.ico", "favicon-32.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png", "og-image.png", "media/waterfall-120.mp4", "media/waterfall-120-portrait.mp4", "media/waterfall-120-720.mp4", "media/waterfall-poster.jpg", "media/waterfall-poster-portrait.jpg", "media/fire-100-portrait.mp4", "media/fire-poster-portrait.jpg", "media/storm-120-tall.mp4", "media/storm-poster-tall.jpg", "fonts/Archivo.woff2", "fonts/IBMPlexMono-Medium.woff2", "fonts/IBMPlexSans.woff2", "media/launcher-dashboard.webp", "media/email-chat.webp", "media/mac-mini-box-local-ai.webp", "media/mac-mini-og.jpg", "84c4e52297163e1f9d69b2fedb457eb8.txt", "logo.png", "llms.txt", "fonts/google-fonts.css", "fonts/OFL.txt", ...googleFonts, "vendor/lenis.min.js", "vendor/lenis-LICENSE.txt"]) {
  await copyFile(new URL(`./${asset}`, import.meta.url), new URL(`./docs/${asset}`, import.meta.url));
}
await writeFile(new URL("./docs/.nojekyll", import.meta.url), "");
await writeFile(new URL("./docs/CNAME", import.meta.url), new URL(SITE_URL).host + "\n");

console.log(`built docs/ -> ${PAGES.map((p) => p.out).join(", ")}, sitemap.xml, robots.txt, llms.txt, CNAME`);
