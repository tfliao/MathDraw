# MathDraw

Turn a picture into a printable color-by-math puzzle. Each square contains a
math problem; its answer selects a color from a shared key. Coloring the squares
reveals the pixel picture.

MathDraw is a React + TypeScript + Vite application with no backend. Images are
decoded and processed locally in the browser, not uploaded to a service.

## Requirements

- Node.js 24 LTS recommended; the project requires Node.js >= 22.13.0.
- npm, included with Node.js.
- A current desktop Chrome or Edge browser is recommended for printing.

Install Node.js from [nodejs.org](https://nodejs.org/), then open a terminal in the
project's root directory. The commands below use `npm.cmd` and `npx.cmd` for
Windows PowerShell; on macOS/Linux, use `npm` and `npx` instead.

## Install and run

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`. If the port is
occupied, Vite may choose another one. Stop the server with **Ctrl+C**.
Use the server URL rather than opening `index.html` directly.

Some existing local workspaces may contain an ignored portable Node runtime.
It is not included in Git or required for a fresh installation. If it already
exists under `.tools`, this makes it available in the current PowerShell terminal:

```powershell
$nodeDirectory = (Get-ChildItem .tools -Directory -Filter 'node-*-win-x64' | Select-Object -First 1).FullName
if (-not $nodeDirectory) { throw 'No portable Node runtime found. Install Node.js first.' }
$env:PATH = "$nodeDirectory;$env:PATH"
```

## Create a puzzle

1. Choose a PNG, JPEG, or WebP image, up to 10 MiB and 40 million decoded pixels.
   Simple, high-contrast artwork works best.
2. Enable **Auto size from picture**, or set rows and columns manually.
3. Optionally expand **Advanced**, then select **Create puzzle**.
4. Switch between **Puzzle** and **Solution** to preview the activity.
5. Use **Print puzzle** for the uncolored activity or **Print answer key** for
   the colored solution. The browser's print dialog also supports saving a PDF.

Changing any generation option keeps the previous preview but disables printing
until you generate again. Pictures and puzzles are not saved across page reloads;
save a PDF if you want to keep a puzzle.

### Options

| Option | Default | Behavior |
| --- | --- | --- |
| Manual grid | 16 columns, 20 rows | 4-64 in either direction; up to 4,096 cells |
| Auto size | Off | Matches image proportions within 24 by 24; minimum 4 per dimension |
| Allow zero operands | Off | When enabled, operands may start at 0 instead of 1 |
| Maximum operand | 9 | Integer from 2 to 99 |
| Operators | Addition | Any nonempty set of addition, subtraction, and multiplication |
| Maximum result | 99 | Integer from 0 to 9801; inclusive upper bound for every answer |
| Allow zero results | Off | Independently permits answer 0; negative answers are never allowed |
| Multiple results per color | Off | Up to 3 answers per color; an answer still identifies exactly one color |
| Maximum colors | 8 | Integer from 1 to 16; actual count may be lower |

Multiplication is displayed with the multiplication sign, not an asterisk.
Operator selections specify what is allowed, not a guarantee that every selected
operator appears in a small puzzle.

Zero operands and zero results are separate: `0 + 1` is valid when zero operands
are enabled and zero results are disabled. `3 - 3` requires zero results to be
enabled, but does not require zero operands. A maximum result of 0 can create
a zero-only subtraction activity when zero results are enabled. If no legal
problems remain, the app explains the conflict and disables generation.

The full image is fitted without cropping or stretching. White margins are added
when necessary, and transparency is composited onto white. White counts as a
palette color and is labeled **Leave white**.

Similar shades are merged to keep colors perceptually separated. The palette is
also limited by the number of legal math answers. Multi-map results are listed
together beside their swatch, and every listed result is used in the puzzle.

### Printing

Default arithmetic and grids up to 24 by 24 fit a portrait A4 or Letter page.
Larger grids, longer expressions, or larger keys can require larger paper.
Follow the physical paper dimensions displayed above the print help:

- Select sufficiently large paper and the appropriate orientation.
- Use **100% scale**, color printing, and turn browser headers/footers off.
- Cells stay readable: normally 7.5 mm, increasing to 12 mm for longer
  expressions. Arithmetic remains at least 10 pt.
- MathDraw does not automatically shrink large grids to A4 or tile them across
  pages. Insufficient paper may clip the puzzle; browser/printer settings can
  also override scaling and layout.

Normal browser printing defaults to the uncolored puzzle. The answer key is
printed only through its explicit action. Printing with stale/invalid settings
shows an instruction to regenerate instead of silently printing the old puzzle.

PDF layouts are exercised in Chromium. Other browsers, physical printers,
available crayon shades, and color-vision differences can affect the result.

## Production build

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1
```

The build type-checks the project and writes static assets to `dist`. Preview
normally serves them on port 4173; use its printed URL. It is a local inspection
server, not a production deployment service. Deploy the contents of `dist` to a
static web host. No server-side application or environment secrets are required.

## Deploy to GitHub Pages

MathDraw is already a static web app: no conversion or backend hosting is needed.
GitHub Actions can build it and publish `dist` to GitHub Pages. Image processing
and printing continue to work in the visitor's browser.

The following is a **setup guide**, not an already-configured deployment. No
Pages workflow is currently included in the repository.

### 1. Publish the source repository

Create an empty GitHub repository, for example `MathDraw`. Do not initialize a
second README or license there when pushing this existing Git history. A public
repository is the simplest option for GitHub Free; check your plan's Pages
availability if you want a private repository.

If this local repository does not already have an `origin`, replace
`YOUR-USERNAME` below and run:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/MathDraw.git
git push -u origin master
```

The examples use `master`, the branch used by this project. If you use `main`
instead, change both the push command and the workflow branch below. If an
`origin` already exists, inspect it with `git remote -v` rather than adding it
again. Publish only intended source commits, not personal images or secrets.

### 2. Enable GitHub Actions publishing

In the GitHub repository, open **Settings > Pages**. Under **Build and deployment**,
set **Source** to **GitHub Actions**.

For a repository named `MathDraw`, the project-site URL will normally be:

```text
https://YOUR-USERNAME.github.io/MathDraw/
```

### 3. Add the deployment workflow

Create `.github\workflows\deploy-pages.yml` with the following content, then commit
and push that file. The workflow runs on Ubuntu, so its commands use `npm`, not
`npm.cmd`.

```yaml
name: Deploy MathDraw to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: read

concurrency:
  group: pages
  cancel-in-progress: false

env:
  BASE_PATH: /MathDraw/

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out source
        uses: actions/checkout@v6
      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: npm
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm test
      - name: Lint
        run: npm run lint
      - name: Build for the repository path
        run: npm run build -- --base="$BASE_PATH"
      - name: Upload built site
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy site
        id: deployment
        uses: actions/deploy-pages@v4
```

Set `BASE_PATH` to your actual hosting path, including both slashes:

| Hosting location | `BASE_PATH` |
| --- | --- |
| `https://YOUR-USERNAME.github.io/MathDraw/` | `/MathDraw/` |
| A project repository with another name | `/YOUR-REPOSITORY-NAME/` |
| Root site in `YOUR-USERNAME.github.io`, or a custom domain served at its root | `/` |

The repository name and path are case-sensitive. The build flag configures Vite's
asset URLs for Pages without changing `vite.config.ts` or the normal local
development path. Do not publish the source `index.html` directly: publish the
generated `dist` artifact. No `gh-pages` branch, personal access token, or
committed `dist` directory is required for this workflow.

The build command includes type checking. This deployment example runs unit
tests and lint but not Playwright; run the browser/PDF suite separately as
described under Development.

### 4. Open the deployed site

Open the repository's **Actions** tab and wait for the deployment workflow to
finish. The `github-pages` environment and **Settings > Pages** provide the
published URL. Later pushes to the configured branch rebuild the site. You can
also use **Run workflow** once the workflow is on the default branch.

Check that the page loads, generate a puzzle, and open its print preview. The
public site does not upload visitors' pictures to GitHub.

### Preview the Pages path locally

Before deploying, you can simulate the project-site path:

```powershell
npm.cmd run build -- --base=/MathDraw/
npm.cmd run preview -- --host 127.0.0.1 --base=/MathDraw/
```

Open `http://127.0.0.1:4173/MathDraw/`, or the equivalent path on the port printed
by Vite. Use your repository's actual path in both commands. Rebuild with plain
`npm.cmd run build` to restore a root-path build for normal local preview.

### Troubleshooting

| Symptom | What to check |
| --- | --- |
| Blank page or missing JavaScript/CSS | `BASE_PATH` matches the repository name and the deployed URL; rebuild after changing it |
| Site returns 404 | Pages source is GitHub Actions, deployment succeeded, and you are using the published project path |
| Workflow does not start | Its `push.branches` matches the branch you pushed; Actions are enabled for the repository |
| Deployment permission/environment error | Pages is enabled, the deploy job has `pages: write` and `id-token: write`, and `github-pages` environment rules permit your branch |
| Old content after a push | Wait for the latest deployment to succeed, then refresh the browser |

GitHub Pages exposes the built client code publicly; do not place credentials
in the application. Repository visibility and site visibility are separate
concerns. Custom domains require additional Pages/DNS configuration beyond this
guide.

References: [Vite static deployment](https://vite.dev/guide/static-deploy.html)
and [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Development

### Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Development server with hot reload |
| `npm.cmd run typecheck` | Type-check application, configuration, and browser tests |
| `npm.cmd run lint` | Run Oxlint |
| `npm.cmd test` | Run Vitest unit/domain tests |
| `npm.cmd run build` | Type-check and generate the production bundle |
| `npm.cmd run test:e2e` | Run Playwright browser and PDF tests |

Install Playwright's Chromium browser once before running browser tests:

```powershell
npx.cmd playwright install chromium
```

Run focused tests during development:

```powershell
npm.cmd test -- src\domain\settings.test.ts src\domain\puzzle.test.ts
npm.cmd run test:e2e -- results.spec.ts advanced-print.spec.ts
```

Use filenames for Playwright selectors on Windows; they are regular-expression
selectors, not filesystem paths. Browser tests launch their own server on port
4173, so stop any preview/test server using that port first. Generated PDFs and
failure traces go to ignored `test-results`.

### Code organization

| Location | Responsibility |
| --- | --- |
| `src\domain\dimensions.ts` | Manual limits and auto-size calculations |
| `src\domain\color.ts`, `sampling.ts`, `palette.ts` | Color math, cell sampling, separated palettes |
| `src\domain\settings.ts`, `puzzle.ts` | Legal expressions, result filtering, immutable puzzles |
| `src\domain\layout.ts` | Physical worksheet dimensions and paper recommendations |
| `src\image` | Local image validation/decoding and resource lifecycle |
| `src\components` | Advanced controls, shared worksheet, print orchestration |
| `src\App.tsx` | Setup state, generation, stale snapshots, screen/print integration |
| `src\print.css` | Print-only layout and physical sizing |
| `e2e` | Browser tests, generated image fixtures, and PDF assertions |
| `PLAN.md` | Implementation history, technical decisions, and review records |

### Important invariants

- Enumerate legal problems and filter results before determining palette capacity.
  Handle empty result sets explicitly; never generate a zero-color puzzle.
- An answer maps to exactly one color globally. A color may have up to three
  answers in multi-map mode, and each listed answer must occur in a cell.
- Keep the generated puzzle and settings frozen. View switches and printing
  must not reroll problems; edited controls must mark the snapshot stale.
- Internal multiplication uses `*`. Use `operatorSymbol` / `problemText` for
  display so screen and print use the same multiplication sign.
- Preserve the final palette's CIE76 distance of at least 25 and reserved-white
  behavior, even when increasing the requested color count.
- Respect current grid/image limits; release old bitmaps and object URLs, and
  discard stale asynchronous work.
- Reuse `Worksheet` for screen and print. Keep readable cell/font sizes, and
  test larger paper whenever changing geometry or key layout.

Keep changes focused, add relevant coverage, review before committing, and make
small meaningful commits. Update documentation when behavior changes. Do not
commit uploaded images, `node_modules`, `.tools`, `dist`, PDFs, or test artifacts.

Dependencies and browser binaries are downloaded during development setup.
Processing a user's picture does not require any external service.
