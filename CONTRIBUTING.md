# Contributing to MathDraw

[Back to README](README.md) | [User guide](USAGE.md) | [Support](SUPPORT.md)

MathDraw is a React + TypeScript + Vite static application. Keep image processing
local to the browser and preserve the same puzzle across screen and print views.

## Development setup

Follow the [README installation instructions](README.md#install-and-run).
Node.js 24 LTS is recommended; the minimum is 22.13.0. The examples below use
`npm.cmd` and `npx.cmd` in Windows PowerShell; use `npm` and `npx` on macOS/Linux.

Dependencies and browser binaries are downloaded during development setup.
Processing a user's picture does not require an external service.

### Optional portable Node runtime

Some existing local workspaces contain an ignored portable Node runtime under
`.tools`. It is not included in Git or required for a fresh installation. If it
already exists, add it to the current PowerShell terminal's PATH:

```powershell
$nodeDirectory = (Get-ChildItem .tools -Directory -Filter 'node-*-win-x64' | Select-Object -First 1).FullName
if (-not $nodeDirectory) { throw 'No portable Node runtime found. Install Node.js first.' }
$env:PATH = "$nodeDirectory;$env:PATH"
```

## Branch and pull request workflow

Do not create a new pull request for every follow-up request. While the current
PR is open, continue on its branch and push follow-up commits to that same PR.
Create the next PR only after the preceding PR has been merged.

When beginning that next branch, start from the latest remote default branch.
This repository's default branch is named `master`. Save any existing work before
switching branches; do not overwrite unrelated changes.

```powershell
git fetch origin
git switch --no-track -c feat/short-description origin/master
```

Keep changes focused, add relevant coverage, and make small meaningful commits.
Review locally, including an independent spawned-agent review when working with
an assistant, and address findings before committing. Record significant decisions
and review outcomes in [PLAN.md](PLAN.md), without rewriting historical decisions.
Update current guides when behavior changes.

Push only your feature branch:

```powershell
git push -u origin feat/short-description
```

Open a pull request targeting `master`. The repository owner performs final
review and merges or closes the PR. Assistants must never push directly to
`master`, merge a PR, or close it. This applies to code, documentation, and
workflow changes.

Do not commit uploaded images, `node_modules`, `.tools`, `dist`, PDFs, test
artifacts, credentials, or secrets.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Development server with hot reload |
| `npm.cmd run typecheck` | Type-check application, configuration, and browser tests |
| `npm.cmd run lint` | Run Oxlint |
| `npm.cmd test` | Run Vitest unit/domain tests |
| `npm.cmd run build` | Type-check and generate the production bundle |
| `npm.cmd run preview` | Serve the existing production build locally |
| `npm.cmd run test:e2e` | Run Playwright browser and PDF tests |

### Build and preview locally

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1
```

The build writes static assets to `dist`. Preview normally serves them on port
4173; use the URL it prints. It is a local inspection server, not a production
deployment service. No server-side application or environment secrets are needed.
Rebuild to include subsequent changes in the production preview.

### Tests

Install Playwright's Chromium browser once before running browser tests:

```powershell
npx.cmd playwright install chromium
```

Use the smallest relevant checks while developing. Documentation-only changes
need content and link review, not application builds or tests.

```powershell
npm.cmd test -- src\domain\settings.test.ts src\domain\puzzle.test.ts
npm.cmd run test:e2e -- results.spec.ts advanced-print.spec.ts
npm.cmd test -- src\i18n\locale.test.ts
npm.cmd run test:e2e -- language.spec.ts
```

Use filenames for Playwright selectors on Windows; they are regular-expression
selectors, not filesystem paths. Browser tests launch their own server on port
4173, so stop your preview/test server using that port first, or run your preview
on a different port. Generated PDFs and failure traces go to ignored `test-results`.

Existing English browser tests explicitly use `en-US`; language tests override
the browser locale where needed. Chinese PDF coverage requires available CJK
fonts in the Chromium environment. PDF assertions normalize whitespace and
Unicode compatibility characters because Chinese glyphs may be extracted as
separate text items or equivalent radicals.

## Code organization

| Location | Responsibility |
| --- | --- |
| `src\domain\dimensions.ts` | Manual limits and auto-size calculations |
| `src\domain\color.ts`, `sampling.ts`, `palette.ts` | Color math, cell sampling, separated palettes |
| `src\domain\settings.ts`, `puzzle.ts` | Legal expressions, result filtering, immutable puzzles |
| `src\domain\background.ts` | Near-white classification and edge-connected background detection |
| `src\domain\layout.ts` | Physical worksheet dimensions and paper recommendations |
| `src\image` | Local image validation/decoding and resource lifecycle |
| `src\i18n` | Typed English/Traditional Chinese catalogs, language detection, preference persistence |
| `src\components` | Advanced controls, shared worksheet, print orchestration |
| `src\App.tsx` | Setup state, generation, stale snapshots, screen/print integration |
| `src\print.css` | Print-only layout and physical sizing |
| `e2e` | Browser tests, generated image fixtures, and PDF assertions |
| `PLAN.md` | Historical plans, technical decisions, and review records |

## Important invariants

- Enumerate legal problems and filter results before determining palette capacity.
  Handle empty result sets explicitly; never generate a zero-color puzzle.
- An answer maps to exactly one color globally. A color may have up to eight
  answers in multi-map mode (default cap 3), and each listed answer must occur in
  a problem cell.
- Background cells have no arithmetic. Allocate results and key entries using
  only problem cells, preserve enclosed white details, and handle empty keys.
- Keep generated puzzles and settings frozen. View switches and printing must
  not reroll problems; edited generation controls must mark the snapshot stale.
- Internal multiplication uses `*`. Use `operatorSymbol` / `problemText` for
  display so screen and print use the same multiplication sign.
- Preserve the final palette's CIE76 distance of at least 25 and reserved-white
  behavior, even when increasing the requested color count.
- The foreground-sampling experiment excludes near-white samples, then chooses
  the most frequent actual sample from the largest 16-level RGB bucket per cell.
  Use white if no foreground remains. Share the near-white predicate with background
  detection, retain deterministic ties, and test the image-to-palette pipeline.
- For images matching grid dimensions exactly, bypass foreground voting and copy
  white-composited source pixels before palette reduction. Never smooth artificial
  enlargement into the sampling canvas; retain smoothing for actual shrinking.
- Respect current grid/image limits; release old bitmaps and object URLs, and
  discard stale asynchronous work.
- Reuse `Worksheet` for screen and print. Keep readable cell/font sizes, and
  test larger paper whenever changing geometry or key layout.
- Language changes are presentation-only: do not regenerate or invalidate a
  puzzle. Resolve worksheet color labels and stored error codes in the active
  language at render time rather than storing translated text in puzzle state.

## Maintaining translations

`src\i18n\en.ts` defines the `Messages` shape; `src\i18n\zh-TW.ts` implements the
same keys and function signatures. Add or update both catalogs together,
including accessible names, validation, print instructions, page title, and
description. Keep numeric formatting arguments in their documented order
(rows/columns can differ between messages), and test singular/plural output
where relevant. Keep the selector's language names in their own languages.

Use the active messages for rendered copy. Recognized failures carry a
`UserFacingError` code so an existing error can change language; unexpected
causes are logged and use a translated fallback instead of exposing raw
exception text. Keep palette colors, result mappings, and expressions independent
of translated labels. Run the locale unit tests and the language browser/PDF
tests when modifying catalogs or switching behavior.
