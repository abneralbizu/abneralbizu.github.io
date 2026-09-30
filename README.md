# abnermartinez.dev — portfolio site source

Static HTML and CSS. No build step, no dependencies, no JavaScript. Every file
deploys exactly as it sits here.

## Structure

```
index.html                 home — intro, project list, skills, background, contact
style.css                  all styling (light and dark, responsive)
.nojekyll                  tells GitHub Pages to serve files as-is
projects/
  vulnerability-management-program.html
  hypervisor-lab.html
  ansible-aws-automation.html
  firewall-scan-validation.html
  system-hardening.html
  incident-report.html
```

## Previewing locally

Open `index.html` in a browser. That's it. If you want proper relative-path
behavior, run a local server from this folder instead:

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

1. **Every page states that it is academic or lab work**, in the eyebrow at the
   top and again in the note at the bottom. Never imply commercial client work.
2. **No host addresses, hostnames, credentials, key material, account
   identifiers, or public IPs** from any lab. They add nothing and they are a
   liability.
3. **No claimed tools that weren't used.** In particular: VMware Fusion and
   Proxmox VE, never vSphere/ESXi/vCenter. No SIEM tooling until there is real
   work product behind it.
4. **Group work is labeled as group work**, with the individual contribution
   stated.
5. **Every "What I would do differently" section is real.** It is the most
   credible part of each page and the part interviewers respond to.
