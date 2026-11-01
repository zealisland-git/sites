# sites — many small static websites, one Cloudflare project

This repo is connected to Cloudflare (Workers & Pages → `sites`, Git integration).
Live address: https://sites.zeal-island.workers.dev/
**Pushing to `main` is the publish step.** There is no other deploy command.

- Only the `public/` folder is published.
  Everything outside it (this file, `README.md`, notes) stays in the repo only.
- Each site is one folder: `public/<site-name>/index.html` is served at
  `https://sites.zeal-island.workers.dev/<site-name>/`.
- `public/index.html` is the home page listing every site.

## To add a new site

1. Pick a short lowercase folder name with hyphens (e.g. `spelling-quiz`). Check it is not
   already taken in `public/`.
2. Create `public/<site-name>/index.html` (plus any other files the site needs, inside that
   folder). Keep it static: no build step, no server code, no npm install.
3. Add a link to the site on the home page: one `<li><a href="<site-name>/">Title</a></li>`
   in the `#sites` list, newest first. Remove the "No sites yet." line if it is still there.
4. Commit with a clear message and push to `main`.
5. After 1–2 minutes, load the page with a web fetch tool (the workspace shell can't reach workers.dev) to confirm it is live, then give
   the user the URL.

## To change a site

Edit files inside its folder only, commit, push to `main`, and confirm as above.
Do not touch other sites' folders unless asked.

## Rules

- **Keep every site out of search engines.**
  - Every HTML page must have `<meta name="robots" content="noindex, nofollow">` in `<head>`.
  - Keep `public/_headers`. It sends `X-Robots-Tag: noindex, nofollow` on every path. Do not
    delete or loosen it, and do not add another `_headers` file in a site folder.
  - Do not add a `robots.txt` that blocks crawlers (a blocked crawler never sees the noindex).
- **Anyone with the link can open any site.** Never commit passwords, API keys, or personal
  information (names, emails, phone numbers, school details).
- Links inside a site must be relative (e.g. `href="practice.html"`, `src="img/a.png"`), never
  starting with `/`, because each site lives in a subfolder. Load libraries from a public CDN
  or keep them in the site's folder.
- Do not force-push or rewrite history on `main`.

## If something goes wrong

- **Deploy status and logs:** Cloudflare dashboard → Workers & Pages → `sites` →
  Deployments. Roll back there, or revert the commit and push again.
- **Claude can't reach the repo:** the Claude GitHub App on `zealisland-git` must have access
  to this repo (github.com/settings/installations → Claude → Configure).
