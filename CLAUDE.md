# sites — many small static websites, one Cloudflare project

This repo is connected to Cloudflare (Workers & Pages → `sites`, Git integration).
Live address: https://sites.zeal-island.workers.dev/
**Pushing to `main` is the publish step.** There is no other deploy command.

- The `public/` folder is published as static files. `worker/` and `wrangler.jsonc` are the one
  shared bit of server code (see "Server code" below). Everything else (this file, `README.md`,
  notes) stays in the repo only.
- Each site is one folder: `public/<site-name>/index.html` is served at
  `https://sites.zeal-island.workers.dev/<site-name>/`.
- `public/index.html` is the home page listing every site.

## To add a new site

1. Pick a short lowercase folder name with hyphens (e.g. `spelling-quiz`). Check it is not
   already taken in `public/`.
2. Create `public/<site-name>/index.html` (plus any other files the site needs, inside that
   folder). Keep it static: no build step, no npm install. If a site really needs to store data
   on the server, see "Server code" below.
3. Add a link to the site on the home page: one `<li><a href="<site-name>/">Title</a></li>`
   in the `#sites` list, newest first. Remove the "No sites yet." line if it is still there.
4. Commit with a clear message and push to `main`.
5. After 1–2 minutes, confirm the page is live, then give the user the URL.
   `sites.zeal-island.workers.dev` is on the cloud environment's network allowlist, so the
   workspace shell can reach it (e.g. `curl -sSL https://sites.zeal-island.workers.dev/<site-name>/`),
   as can a web fetch tool or a headless browser. If a request is refused, check that the domain is
   still allowed in the environment's network settings.

## To change a site

Edit files inside its folder only, commit, push to `main`, and confirm as above.
Do not touch other sites' folders unless asked.

## Server code (shared Worker + D1 database)

- `wrangler.jsonc` (repo root) configures the Cloudflare Worker named `sites`. It serves `public/`
  as static assets and runs `worker/index.js` **only** for requests under `/api/*`
  (`run_worker_first`). Every other request is a plain static file, as before.
- Each site that needs server storage gets its own path, `/api/<site-name>/...`, and its own
  table-name prefix in the shared D1 database (binding `DB`). Example: ASCII Art Studio uses
  `/api/ascii-art/` and tables `aa_libraries`, `aa_devices`, `aa_items`. Tables are created by
  the Worker itself (`CREATE TABLE IF NOT EXISTS`), so there is no migration step.
  Brain Blast Arena uses `/api/brain-blast/` and tables `bb_players`, `bb_devices`, `bb_stages`
  (code in `worker/brain-blast.js`; its stages are data in `public/brain-blast/stages.js`).
- Pages call the API with relative URLs, e.g. `new URL('../api/ascii-art/', location.href)`.
- API responses must send `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`
  (`_headers` only covers static files).
- Stay inside the Workers Free plan: 100,000 Worker requests/day, 10 ms CPU per request
  (avoid parsing big JSON bodies), D1 5 GB total, 500 MB per database, 5 million rows read and
  100,000 rows written per day. Cap sizes per user so one visitor cannot fill the database.
- Never hard-code secrets. Store user keys and codes only as hashes.
- Test locally before pushing: the Worker is plain JavaScript, so it can run against Node's
  built-in `node:sqlite` as a stand-in for D1.
- Do not change the Worker `name`, the `assets` block or the D1 `database_id` unless asked. A
  wrong value breaks the deploy (Cloudflare keeps the last good version live).

## Rules

- **Keep every site out of search engines.**
  - Every HTML page must have `<meta name="robots" content="noindex, nofollow">` in `<head>`.
  - Keep `public/_headers`. It sends `X-Robots-Tag: noindex, nofollow` on every path. Do not
    delete or loosen it, and do not add another `_headers` file in a site folder.
  - Do not add a `robots.txt` that blocks crawlers (a blocked crawler never sees the noindex).
- **Anyone with the link can open any site.** Never commit passwords, API keys, or personal
  information (names, emails, phone numbers, school details). Anyone can also call `/api/*`, so
  server code must check who is asking and must not let one visitor read another's data.
- Links inside a site must be relative (e.g. `href="practice.html"`, `src="img/a.png"`), never
  starting with `/`, because each site lives in a subfolder. Load libraries from a public CDN
  or keep them in the site's folder.
- Do not force-push or rewrite history on `main`.

## If something goes wrong

- **Deploy status and logs:** Cloudflare dashboard → Workers & Pages → `sites` →
  Deployments. Roll back there, or revert the commit and push again. Worker errors show under
  `sites` → Logs.
- **Database:** Cloudflare dashboard → Storage & databases → D1 → the database named in
  `wrangler.jsonc`. Its Console tab runs SQL directly.
- **Claude can't reach the repo:** the Claude GitHub App on `zealisland-git` must have access
  to this repo (github.com/settings/installations → Claude → Configure).
