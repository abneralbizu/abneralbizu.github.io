# abnermartinez.dev — portfolio site source

Static HTML, CSS and JavaScript. No build step. Every file deploys exactly as
it sits here.

## Structure

```
index.html          home — the 3D packet journey; all text is real HTML
home.css            home page styles (3D mode + static/reduced-motion mode)
main.js             the Three.js scene: route, gates, threats, packet, vault
favicon.svg
img/abner.jpg       headshot
img/og.jpg          link-preview image for LinkedIn and messaging apps
img/work/           redacted screenshots used on the writeup pages
downloads/          redacted coursework PDFs linked from the writeup pages
vendor/             Three.js r170 + bloom post-processing, pinned and self-hosted
style.css           styles for the six project writeup pages
.nojekyll           tells GitHub Pages to serve files as-is
projects/           the full writeups: academic labs plus client work
```

## How the home page behaves

- Scrolling moves a camera along a fixed route; each of the seven layer
  sections maps to one gate on that route (STATIONS in main.js).
- Visitors with "reduce motion" turned on, or a browser without WebGL, get a
  static layout with the same content, decided before first paint.
- Phones and low-core devices get fewer particles and no bloom. If a device
  can't hold frame rate, bloom and resolution drop automatically after ~2s.
- "Skip to projects" is the first focusable element on the page.

## Previewing locally

The home page uses JavaScript modules, so it must be served over http.
Opening index.html directly as a file won't load the 3D scene. From this folder:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Deploying to GitHub Pages

1. Create a repo on GitHub named `abneralbizu.github.io` (use your own username
   if it differs). Public.
2. From this folder:

```
git init
git add .
git commit -m "Portfolio site"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
git push -u origin main
```

3. In the repo, go to Settings → Pages. Set Source to "Deploy from a branch",
   branch `main`, folder `/ (root)`. Save.
4. Live at `https://<your-username>.github.io` within a minute or two.

## Deploying to Netlify

Either connect the GitHub repo (Netlify → Add new site → Import an existing
project → GitHub → pick the repo → leave build command blank, publish
directory `/`), or drag this whole folder onto https://app.netlify.com/drop.

Connecting the repo is better: every `git push` redeploys automatically.

## Adding a project page

Copy any file in `projects/` and replace the content. The structure each page
follows:

- `.eyebrow` — course and date, so the academic context is stated up front
- `<h1>` — the title
- `.summary` — one paragraph, what this was and what came out of it
- `.meta` — tool chips
- `## What I did` / `## What I found` / `## What I would do differently`
- `.note` at the bottom — the coursework disclosure

Then add a matching `<a class="card">` block to the `#work` section of
`index.html`.

## Ground rules for content

These are deliberate. Keep them.

1. **Every page states what kind of work it is**, in the kicker at the top and
   again in the note at the bottom. Academic pages say academic. Client pages say
   "Client work · Continental Investments International Network" and are
   published only with the client's permission (given Oct 2026 for NCCMN and the
   other Continental clients). Never present coursework as client work, and never
   say a client site is live until it is.
2. **No host addresses, hostnames, credentials, key material, account
   identifiers, or public IPs** from any lab. They add nothing and they are a
   liability.
3. **No claimed tools that weren't used.** In particular: VMware Fusion and
   Proxmox VE, never vSphere/ESXi/vCenter. No SIEM tooling until there is real
   work product behind it.
4. **Group work is labeled as group work**, with the individual contribution
   stated.
5. **Downloads and screenshots are redacted before they go in.** Every PDF in
   `downloads/` is rebuilt as page images (no text layer, no metadata) with lab
   addresses, hostnames, usernames, credentials and contact details blacked
   out, and checked with OCR afterward. Never drop an original assignment file
   into this folder.
6. **Every "What I would do differently" section is real.** It is the most
   credible part of each page and the part interviewers respond to.
