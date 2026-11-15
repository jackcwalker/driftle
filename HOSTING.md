# Cloudflare hosting

Driftle uses Cloudflare Workers Static Assets on the free plan. All gameplay runs
in the browser; no Worker script, database, secret, paid service or live geological
API is required. The GitHub repository remains the source of truth.

## Build and verify

Node.js 22+ and npm are required for publishing only. The original local game
still runs with `python3 -m http.server 4173`, without installing anything.

```sh
npm ci
npm test
npm run build
npm run deploy:check
npm run preview
```

`build` creates `dist/` from the actual game entry point, active scientific assets
and attribution documents. It omits repository metadata, preparation tools, tests,
old model data and the terrain comparison route. Generated output and Wrangler
state are ignored by Git. The build checks Cloudflare's file-count and per-file
limits. Missing paths return 404 instead of the game HTML.

`deploy:check` validates the Cloudflare configuration and package without uploading.
`preview` serves that exact package locally through Cloudflare's runtime.

## Friend playtest

The initial demo uses a direct upload of the verified `dist/` files to a free
`workers.dev` address. No custom domain or GitHub application connection is
needed for this playtest. To update it, rebuild and upload the new `dist/` archive
to the same Worker, or use the authenticated manual publishing command below.
Automatic GitHub updates are optional and can be connected later.

## Optional GitHub integration

In Cloudflare **Workers & Pages → Create application → GitHub**:

| Setting | Value |
| --- | --- |
| Repository | `jackcwalker/driftle` |
| Worker/project name | `driftle` |
| Production branch | `main` |
| Root directory | repository root |
| Build command | `npm test && npm run build` |
| Deploy command | `npm run deploy` |
| Preview command | `npm run deploy:preview` |

Use the committed lockfile and pinned Wrangler development dependency. Allow the
Cloudflare GitHub application access to this repository only. The official app
currently requests read/write repository administration, contents, checks,
deployments and pull requests, plus read-only metadata; it listens to push and
pull-request events. Its installation therefore needs explicit approval even
though its scope can be restricted to this one repository. Cloudflare manages
its build credential; no token belongs in the repository. Preview branches should
not change production.

Manual publishing, after `wrangler login` or an appropriately scoped Cloudflare
credential in the environment:

```sh
npm test
npm run build
npm run deploy
```

## Domain and HTTPS

First verify the generated `workers.dev` URL: map loads, picks score, drift reaches
Today, zoom works and source notices are available. Then add `driftle.games` under
**Settings → Domains & Routes → Add → Custom domain**. Cloudflare generates DNS and
HTTPS certificates. The domain must be an active Cloudflare zone; if it is
registered elsewhere, its registrar can stay unchanged while nameservers point
to Cloudflare. Preserve any existing mail and verification records during DNS
onboarding. Add `www` with a redirect to the apex if needed. No domain purchase,
registrar transfer or paid SSL product is necessary.

## Caching and updates

Cloudflare's default revalidation/ETag policy applies to HTML, modules and JSON,
so a new release does not strand old code behind long browser cache lifetimes.
Terrain imagery and owner masks have a one-day browser cache; their requested URLs
include source hashes. No service worker is installed. `_headers` sets MIME sniffing
protection and a normal referrer policy without blocking WebGL, image decoding or
the canvas-based game.

## References

- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-workers-static-assets-for-new-projects
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

Live account, integration, deployment and domain status are recorded only after
they have been verified; this file by itself is not proof of deployment.
