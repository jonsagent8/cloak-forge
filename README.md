# Cloak Forge

Marketing site for Cloak Forge — private, on-device AI automation setup.

- `index.html` — page source (also published as a Claude Artifact)
- `privacy.fragment.html` — privacy page body
- `favicon.svg`
- `build.mjs` — wraps the fragments into standalone docs in `docs/`
- `docs/` — the built site, served by GitHub Pages

## Build

```
node build.mjs
```

No dependencies (Node built-ins only).
