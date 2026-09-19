# MathDraw implementation plan

Status: V1 and V2 complete. V3 height/result controls and README in progress.

The V2 section below supersedes V1 limits where explicitly noted. V1 sections
remain as the historical implementation and decision record.

## 1. Goal

Build a browser-based tool that turns an uploaded picture into a printable
color-by-addition puzzle for children. The output is an N-row by M-column grid.
Every cell contains an addition problem with two operands from 1 through 9.
Solving the problem gives a number that maps to a color in a single shared key.
Coloring the cells recreates a pixel-style version of the uploaded picture.

## 2. Agreed decisions

- React, TypeScript, and Vite; no backend.
- Process images locally in the browser; do not upload them to a server.
- Design for paper use, with an uncolored puzzle and a separate solution preview.
- Provide separate "Print puzzle" and "Print answer key" actions.
- Fit each printout onto one portrait A4 or Letter page.
- Allow 4 through 24 rows and 4 through 24 columns, independently.
- Default to 20 rows and 16 columns.
- Derive at most 8 colors from the uploaded image, rather than using a fixed
  crayon palette. Selected colors must be perceptually separated.
- Preserve image proportions and show the entire image, adding white margins
  when the image and grid have different aspect ratios.
- Initialize a local Git repository, track this plan in Git, and use small,
  meaningful commits. Each implementation iteration includes sub-agent review.
- Create and commit the plan now, then wait for user approval before coding.

## 3. Proposed v1 behavior

The following details make the implementation precise and are subject to plan
review; they are not additional user-confirmed decisions.

### Input and generation

1. Show an image picker, row and column fields, and a "Create puzzle" button.
2. Accept a single PNG, JPEG, or WebP image, up to 10 MiB. Reject unsupported,
   undecodable, empty, or excessively large images with an inline error.
   Use a decoded-image limit of 40 million pixels; enforce it as soon as image
   dimensions become available, before allocating processing canvases.
   This is not a guarantee against decoder memory use for hostile images.
3. Require integer dimensions between 4 and 24. Label rows and columns explicitly
   and reject invalid entries rather than silently clamping them.
4. Keep image processing asynchronous where appropriate, show a busy state, and
   prevent stale asynchronous results from replacing a newer selection.
5. Enable generation only with valid inputs and enable printing only when a
   completed puzzle exists. Show processing and print preparation failures.
6. Keep the completed puzzle stable until the user explicitly creates a new one.
   If inputs change, identify the current preview as the previous puzzle and
   disable printing until the new settings have been generated successfully.

### Image fitting and cell sampling

- Apply the browser's decoded image orientation.
- Composite transparency onto white.
- Fit the complete image, centered, into a white rectangular canvas whose aspect
  ratio matches columns / rows. Use square grid cells without distortion.
- Render to a bounded intermediate canvas with a fixed sampling resolution per
  cell, then average each cell's samples in linear-light RGB. Convert the averages
  back to sRGB for subsequent color processing. This provides predictable
  area-based downsampling without allocating a full-resolution source canvas.
- White margins are part of the puzzle: they receive problems and participate in
  the same color mapping. White counts toward the 8-color limit; label a pure
  white key entry "Leave white." Do not make empty cells a hidden exception.
- When sampling produces pure-white cells, reserve white as a palette color so
  margins stay white. Merge near-white candidates into white as needed.
- At coarse grid sizes, a thin margin may share every affected cell with image
  content. Its averaged colors may not remain white after quantization; exact
  preservation of sub-cell margins is not possible.

### Distinct image-derived palette

- Convert sampled sRGB colors to CIELAB using the D65 white point.
- Use deterministic, frequency-weighted clustering with farthest-point
  initialization and a bounded iteration count to produce at most 8 colors.
  Reserve one of those slots for white when required by the sampling rule.
- Select representative colors from actual sampled cell colors (weighted
  medoids) so output colors are reproducible and remain valid sRGB.
- Use CIE76 Delta E >= 25 as the initial minimum pairwise separation threshold.
  This is a measurable v1 heuristic, not a guarantee for every printer, paper,
  lighting condition, or type of color vision.
- After clustering, repeatedly merge the closest pair below the threshold,
  recompute its representative, and recheck all pairs. A merged cluster
  containing reserved white must retain white as its representative.
- Assign each cell to the nearest final palette color in Lab space. Remove
  unused palette entries. Verify both the maximum count and pairwise distance
  on the actual final sRGB palette, not just intermediate cluster centers.
- Permit 1 through 8 colors; do not invent extra colors for monochrome or
  low-contrast images. Fewer clearly separated colors are preferable to eight
  similar shades.
- Present a short note that simplified colors may differ from the source and
  that children may use the closest available pencil or crayon.

### Addition problems and shared key

- Give each palette entry one distinct result from 2 through 18. Use a
  randomized subset without replacement; do not reuse a result for two colors.
- Precompute every ordered operand pair (a, b) with 1 <= a, b <= 9 for each sum.
- For each cell, choose a pair from the list for its assigned color's result.
  Both repeated operands and reversed pairs are valid. Repeated problems are
  unavoidable for some sums and are allowed.
- Never use zero, subtraction, multiplication, or two-digit operands.
- Store the generated palette, result mapping, and problems together as one
  immutable puzzle snapshot. React re-renders, tab changes, and printing must
  not regenerate the problems or change the mapping.
- Sort the shared key by numeric result. Each entry shows the result, a bordered
  color swatch, a stable color label such as "Color 1," and its hex value.
  Do not infer misleading natural-language names for arbitrary derived colors.

## 4. Screen and print design

### On screen

- Provide a clear empty state, compact setup controls, uploaded-image preview,
  and a prominent generation action.
- Use a responsive layout and a horizontally scrollable puzzle preview on
  narrow screens; do not shrink arithmetic below a readable size to fit a phone.
- Display puzzle and solution as separate labeled views, with the puzzle view
  selected by default. Keep both print actions clearly available.
- The puzzle view has white square cells, dark outlines, centered addition
  problems, concise instructions, a name field, and the shared result-color key.
- The solution view shows the same grid filled with the assigned colors and no
  arithmetic overlay. It includes the same key so adults can check the activity.
- Associate form labels, errors, and help text with inputs; support keyboard
  operation, visible focus, and meaningful image descriptions. Represent the
  arithmetic grid with table semantics and use text alongside every key swatch.

### Printing

- Print the generated snapshot, not live form state or the original image.
- "Print puzzle" prints only instructions, the uncolored arithmetic grid, a
  name field, and the shared key. It never reveals the solution.
- "Print answer key" prints only the colored solution grid and shared key, with
  an unmistakable "Answer key" heading.
- Hide application controls, source-image preview, and all unrelated views.
- Use one shared print layout component parameterized by print mode. Mount the
  selected mode and wait for rendering to complete before calling window.print.
  Clean up print-mode state when printing finishes or is canceled.
- Make normal browser printing default to the puzzle; only the explicit
  answer-key action selects the solution.
- Use a centered content area no larger than 180 mm wide by 245 mm tall,
  with portrait page rules and 10 mm margins. The grid has a square-cell size
  capped at 7.5 mm; at 24 by 24 it occupies 180 mm by 180 mm, leaving room
  for the heading, instructions, and a compact two-row key.
- Use at least 10 pt arithmetic text at maximum grid size and avoid wrapping
  each expression. Use compact expressions such as `9+9` and verify their fit
  with the actual print font. Enforce page-break avoidance for the grid and key.
- Render color fills and swatches using inline SVG fill attributes rather than
  relying solely on CSS background printing; also request exact print colors.
- Explain that the key requires color printing, recommend 100% scale and
  disabling browser headers/footers, and note that print settings can override
  the application's layout or colors.
- Validate both A4 and Letter output. Browser/PDF print layouts are the v1
  target; actual printer color accuracy cannot be guaranteed.

## 5. Technical structure

- `src/domain/`: types and pure functions for color conversion, cell sampling,
  palette reduction, operand enumeration, and puzzle generation.
- `src/image/`: browser image validation, decoding, bounded canvas work, and
  resource lifecycle management.
- `src/components/`: input controls, puzzle grid, solution grid, shared key,
  and screen/print layout components.
- `src/App.tsx`: input state, asynchronous generation lifecycle, generated
  snapshot, view selection, and print orchestration.
- Keep domain code independent of React and browser APIs where possible.
- Inject randomness into puzzle generation so invariants can be tested
  deterministically without changing production behavior.
- Revoke object URLs and release bitmap resources when replaced or unmounted.
  Never retain unnecessary full-size image copies.
- No remote APIs, remote fonts, analytics, or image-processing services.
- Use Vitest for domain/component tests and Playwright for browser and print
  coverage. Add these as project tooling during scaffolding; do not introduce
  additional test frameworks later without a concrete need.
- Include npm scripts for development, tests, type checking, and production
  builds, a lockfile, and a `.gitignore` for dependencies and generated output.

## 6. Validation and acceptance criteria

### Domain coverage

- Dimensions accept the inclusive limits and reject fractional, missing,
  nonnumeric, and out-of-range values.
- Known sRGB/Lab reference values and conversion round trips stay within
  documented numerical tolerances.
- Landscape, portrait, square, and transparent fixtures preserve proportions
  and produce the expected white composition/margins.
- Every generated grid contains exactly rows * columns cells.
- Every final palette has 1 through 8 entries, no unused entries, and pairwise
  Delta E >= 25. Include solid-color, near-identical-color, grayscale, and
  greater-than-eight-color fixtures.
- Reserved white remains exactly white, counts toward the palette limit, and
  does not violate final palette separation.
- Every operand is an integer from 1 through 9; every result is from 2 through
  18 and matches the assigned palette entry's globally unique sum.
- Exercise all 17 possible sums, including 2 and 18, rather than testing only
  whichever sums happen to be selected randomly.
- Each solution cell uses exactly the color assigned to its puzzle cell.
- A stored puzzle does not change across screen and print rendering.

### Browser and print coverage

- Upload supported fixtures, change dimensions, generate, switch views, and
  confirm the on-screen key matches both grids.
- Check invalid dimensions, unsupported formats, a corrupt image, excessive
  file size, and decoded-dimension limits; show useful errors and recovery.
- Replace an image during generation and ensure stale work cannot win.
- Confirm local-only processing without external network requests after the
  application's local assets have loaded.
- Confirm mobile overflow, keyboard access, accessible form errors, and busy
  states.
- Inspect print-media rendering for puzzle, answer key, and default browser
  print paths, including print cancellation and switching print modes.
- Generate A4 and Letter PDFs at minimum, default, maximum, and extreme-aspect
  grid dimensions (4 by 24 and 24 by 4). Assert one page, square cells, no
  clipping, readable text, complete keys, and no solution on puzzle printouts.
  Use PDF inspection support only as necessary for these assertions.
- Inspect representative output visually in addition to automated assertions;
  disclose if the environment cannot support browser/PDF inspection.
- Run targeted checks per iteration and the full existing project suite before
  final delivery. Do not claim validation that was not performed.

## 7. Implementation iterations and commit policy

Each iteration follows the same sequence: implement its scope, run relevant
checks, request an independent spawned sub-agent review of its uncommitted
diff, address actionable findings, rerun affected checks, and commit. A review
is part of the iteration, not deferred to the very end. Keep review outcomes
in this plan's progress section and summarize them in the commit body.

1. **Plan only (current stage)**
   - Initialize the local repository.
   - Write this detailed plan, review it for consistency, and commit it.
   - Stop and wait for user approval; do not scaffold or install dependencies.
2. **Application foundation**
   - Scaffold React/TypeScript/Vite, test tooling, scripts, and ignore rules.
   - Add the accessible setup screen and static responsive page structure.
   - Review and commit this independently runnable foundation.
3. **Image-to-palette pipeline**
   - Implement validated local decoding, aspect-preserving cell sampling,
     perceptual palette reduction, and their targeted tests.
   - Wire image input and generation status into a working color-grid preview.
   - Review and commit the functional processing slice.
4. **Puzzle generation and preview**
   - Implement unique sums, operand selection, stable puzzle snapshots,
     arithmetic and solution views, and the shared key.
   - Cover invariants, regeneration, and asynchronous input changes.
   - Review and commit the playable on-screen puzzle.
5. **Paper output**
   - Implement isolated print modes, physical sizing, SVG colors, and print
     lifecycle handling.
   - Validate A4/Letter one-page output and print-mode isolation.
   - Review and commit the printable feature.
6. **Integrated completion**
   - Complete browser coverage and fix only issues related to the planned v1.
   - Record usage instructions and actual validation results in this plan.
   - Request a final spawned sub-agent review of changes since the previous
     review, address findings, and commit any resulting meaningful changes.
   - Confirm the working tree is clean and deliver the implemented application.

Use focused conventional commit messages, stage only intended files, and never
commit uploaded user images, generated PDFs, dependencies, or secrets. Do not
push to a remote repository unless separately requested.

## 8. Out of scope

- Accounts, a backend, cloud uploads, saved projects, and share links.
- Multiplication, subtraction, division, zero operands, or configurable levels.
- Manual pixel editing, palette editing, crop tools, and palette-size controls.
- Multi-page puzzles, grids larger than 24 in either direction, and print
  layouts other than portrait A4/Letter.
- Downloadable image/PDF export beyond the browser's print-to-PDF function.
- Matching colors to a particular crayon brand or guaranteeing print fidelity.

## 9. Progress

- [x] Discuss core technical and paper-use decisions with the user.
- [x] Initialize the local repository.
- [x] Draft the detailed plan.
- [x] Independently review and commit the plan.
- [x] Receive user approval to implement.
- [x] Application foundation, reviewed and committed.
- [x] Image-to-palette pipeline, reviewed and committed.
- [x] Puzzle generation and preview, reviewed and committed.
- [x] Paper output, reviewed and committed.
- [x] Integrated completion, reviewed and committed.

### Plan review

An independent spawned sub-agent reviewed the plan before its initial commit
and found no blockers. Both suggested clarifications were incorporated:
sub-cell white margins cannot always survive sampling/quantization, and printed
expressions must use compact formatting with actual-font fit verification.
The user subsequently approved implementation and authorized autonomous
decisions, with problems and decisions recorded in this repository.

## 10. Implementation decision log

### Development runtime

Problem: Node.js and npm are not installed or available on PATH.
Decision: Install an official, checksum-verified Node.js 24 LTS portable runtime
under ignored `.tools/`, without changing machine-wide configuration. Document
how to use it locally; users with a compatible Node installation can use npm
normally.

### Foundation review and validation

Scaffolded the responsive, accessible setup screen with strict TypeScript,
Vitest, Playwright, and the scaffold's Oxlint configuration. Added `pdfjs-dist`
as development-only tooling for the planned one-page PDF assertions. Independent
code-review sub-agent found no significant issues. Passed 15 domain tests,
the setup browser test, production build, and lint.

### Image processing decisions and review

Problem: Sampling quality, responsiveness, and resource use need concrete limits.
Decision: Use 16 by 16 samples per cell (maximum canvas 384 by 384), at most eight
clustering iterations, and at most 576 unique input samples. Yield before
generation so busy feedback paints; keep bounded processing on the main thread
rather than adding worker messaging for this small workload. Decode with
`createImageBitmap` and explicitly close bitmaps/revoke preview URLs on replacement,
stale completion, errors, and unmount.

Problem: Browser tests execute DOM code but their runner is Node-based.
Decision: Type-check browser tests with DOM types and bundler module resolution,
matching Playwright's transformation of TypeScript imports.

Independent code-review sub-agent found no significant issues in the image and
palette iteration. Passed 38 domain tests, 4 browser tests (including exact white
margins and transparency), production build, and lint.

### Puzzle review and validation

Added deep-frozen, caller-independent puzzle snapshots; all 17 sums have complete
operand-pair coverage. The single shared key is sorted by sum, and screen view
changes never regenerate arithmetic. Added worksheet table semantics and
keyboard-focusable horizontal overflow rather than shrinking mobile arithmetic.
Independent code-review sub-agent found no significant issues. Passed 21 new
puzzle domain tests, 5 targeted image/puzzle browser tests, build, and lint.

### Printing decisions and review

Problem: Native browser printing can be invoked while settings are stale.
Decision: Both explicit print actions are disabled for stale/busy/failed
generation. Browser printing in that state prints a short instruction rather
than silently printing an outdated worksheet. Inputs are temporarily locked
while an explicit print is preparing/open; `afterprint` (including cancellation)
restores editing and the safe default puzzle mode.

Problem: Print fonts and DOM rendering must finish before opening the dialog.
Decision: Commit the print mode synchronously, await local fonts and two animation
frames, then call the browser's print function. Reuse the same worksheet
component/snapshot for screen and print; hide the entire screen shell in print.

Problem: PDF text extraction may combine a complete row into one text item.
Decision: Assert extracted arithmetic sequences against every source cell rather
than assuming one PDF text item per cell.

Independent code-review sub-agent found no significant issues. All 23 print
browser cases pass, including 20 A4/Letter PDFs at the planned dimension extremes,
maximum eight-color keys, exact arithmetic, 10 pt minimum text, square-cell
geometry, complete keys, one-page output, cancellation, stale-state blocking, and
explicit failure recovery. Rasterized and visually inspected maximum-size Letter
puzzle and answer-key PDFs with background printing disabled; colors, grids,
headings, and two-row keys are visible and fit the page. Build and lint pass.

### Integrated completion decisions

Problem: Large real images would make memory-limit tests unnecessarily costly.
Decision: Unit-test the exact decoded-pixel boundary and use a controlled browser
decoder stub to verify that oversized dimensions close the bitmap before any
processing canvas allocation. Real PNG, JPEG, WebP, transparency, and JPEG EXIF
rotation are covered separately with browser-generated image fixtures.

Problem: Asynchronous races are hard to reproduce with wall-clock timing.
Decision: Gate one decoder completion and one generation yield with explicit test
events, replace inputs, then release the old work. Assert that the newest puzzle
survives and stale bitmap resources are released.

Problem: Horizontally scrolling mobile previews can be mistaken for clipped output.
Decision: Keep arithmetic readable and add an explicit sideways-scroll hint,
associated with the keyboard-focusable preview region. Desktop and mobile
screenshots were visually inspected using a locally generated flower image.

Problem: Test tooling requires a recent Node.js runtime.
Decision: Declare Node.js >= 22.13.0 in the package manifest, with Node.js 24 LTS
recommended. The verified portable runtime used here is Node.js 24.21.0.
No machine-wide PATH, repository remotes, or remote deployments were configured.

### Final integrated review and results

The final independent code-review sub-agent found no significant issues in the
completion increment. All implementation increments received their own spawned
sub-agent review before commit. The final full run passed:

- 60 Vitest tests across six domain/image test files.
- 37 Playwright browser cases, including 20 single-page A4/Letter PDFs.
- Strict TypeScript checks, Oxlint, and the production Vite build.

The browser checks include actual supported image decoding, transparent and
oriented images, shared arithmetic/color mapping, immutable view switching,
image replacement races, failure recovery, mobile overflow, and print isolation.
PDF assertions cover page dimensions, complete keys, square cells, minimum font
size, exact arithmetic order, and text staying inside page bounds. Desktop/mobile
screenshots and maximum-size printed puzzle/answer-key rasterizations were also
visually inspected. No unperformed physical-printer or cross-browser validation
is implied.

## 11. Running and using MathDraw

### Start on this machine

From the repository directory in PowerShell, make the already-installed portable
runtime available to the current terminal if Node is not otherwise on PATH:

```powershell
$nodeDirectory = (Get-ChildItem .tools -Directory -Filter 'node-*-win-x64' | Select-Object -First 1).FullName
$env:PATH = "$nodeDirectory;$env:PATH"
npm.cmd run dev -- --host 127.0.0.1
```

Open the local URL printed by Vite. The development server normally uses port
5173, or another port if that one is occupied. A production preview is also
running at `http://127.0.0.1:5173` for the implementation handoff. It is local to
this machine and is not a remotely deployed website.

### Fresh checkout

Install Node.js 24 LTS (or a compatible version meeting `package.json`), then run:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

The portable `.tools` runtime and `node_modules` are intentionally not committed.
Dependency downloads occur during development setup, not when users process
images in the application.

### Create a paper activity

1. Choose a PNG, JPEG, or WebP picture. Simple, high-contrast pictures work best.
2. Enable "Auto size from picture" for an image-proportioned grid within 24 by 24,
   or choose 4-64 columns and 4-24 rows manually.
3. Optionally expand "Advanced" to set zero operands, maximum operand (2-99),
   allowed operators, multiple results per color, and maximum colors (1-16).
   Defaults remain addition, nonzero operands through 9, one result per color,
   and at most 8 colors. Then select "Create puzzle."
4. Use "Puzzle" or "Solution" to inspect the generated activity. Changing setup
   fields does not alter the existing puzzle; generate again to apply changes.
5. Select "Print puzzle" for the child's uncolored worksheet, or "Print answer
   key" for the adult's colored solution. Printing never uses the screen's view
   selection to guess which sheet you want.
6. For default arithmetic and up to 24 columns, use portrait A4 or Letter.
   For wider grids, longer problems, or larger keys, follow the displayed paper
   dimensions and select sufficiently large paper/orientation. Always use 100%
   scale, color printing, and disable browser headers/footers. "Save as PDF"
   works through the same dialog. Cells are not automatically shrunk to A4;
   insufficient paper or browser overrides can clip or scale the output.

The key is shared by every cell. A "Leave white" entry still has a problem to solve,
but that square should not be colored. Image colors are simplified and may not
exactly match available crayons. Neither the original image nor generated puzzles
are saved across a page refresh; save a PDF before leaving if needed.

Multiple results per color uses up to three answers, listed vertically beside
one swatch. An answer never refers to two colors. Subtraction never produces
negative answers, but equal operands may produce zero even with zero operands
disabled. Requested color counts are maximums: similar shades, image content,
and the available arithmetic results may reduce the actual count.

### Development commands

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run preview -- --host 127.0.0.1
```

For targeted browser coverage on Windows, use test filenames rather than paths,
for example `npm.cmd run test:e2e -- image.spec.ts puzzle.spec.ts`.
Playwright uses its own local test server on port 4173, and saves generated PDFs
and failure traces under ignored `test-results`. Production output goes to
ignored `dist`; it can be served by a static web host.

### Known boundaries

- Chromium browser and PDF rendering are the validated v1 baseline. Current
  Chrome or Edge is recommended; other browsers and physical printers have not
  been independently verified.
- CIE76 distance >= 25 is a palette-separation heuristic, not a promise of
  printer color accuracy or distinguishability for every kind of color vision.
- Coarse grids discard fine picture details, including margins smaller than a
  cell. Images with transparency are composited onto white.
- Decoded-size checks happen after the browser has decoded the source, so they
  do not eliminate decoder memory use for malicious image files.

## 12. V2: sizing and advanced puzzle settings

### Confirmed requirements and decisions

- Add an auto-size toggle outside Advanced. Fit the decoded image aspect ratio
  into at most 24 columns by 24 rows; show the calculated dimensions. Keep
  existing manual defaults (16 columns, 20 rows) and default auto size off.
- For auto size, set the longer dimension to 24 and round the proportional
  shorter dimension, clamped to the existing minimum of 4. Very narrow images
  still get white margins; never stretch or crop. Preserve the manual values
  when toggling back.
- Manual columns range from 4 to 64; rows remain 4 to 24. Warn above 24 columns
  that 24 best fits A4 and larger paper is needed. Do not shrink cells or
  deliberately tile a puzzle across pages. Allow users to choose larger paper.
- Put difficulty, multi-map, and maximum colors in a collapsed-by-default
  "Advanced" section, using accessible native controls.
- Difficulty: zero operands off by default; maximum operand is an integer
  from 2 to 99, default 9; selectable operator set is `+`, `-`, `*`, default
  addition only. At least one operator must remain selected.
- Subtraction results must be nonnegative. The zero toggle only controls
  operands; subtraction can produce zero even with zero operands disabled.
- Multi-map defaults off. When on, assign at most three distinct results per
  color, grouped together in the printed key. A result always determines
  exactly one color throughout the puzzle.
- Maximum colors is an integer from 1 to 16, default 8. Keep perceptual color
  separation and reserved-white behavior. The actual palette can be smaller
  than requested, including when the chosen arithmetic has fewer results.

### Implementation approach

1. **Sizing and wider layouts**
   - Split row and column limits; update domain guards and image sample capacity
     to a maximum of 1,536 cells (24 by 64).
   - Add deterministic auto dimensions from oriented image width/height.
   - Wire auto/manual setup, stale-snapshot handling, and width warnings.
   - Size print content to the actual grid, not a fixed 180 mm clipping box.
     Preserve 7.5 mm cells and 10 pt text for existing arithmetic. Use user-
     selected paper orientation/size and report required physical dimensions.
   - Add targeted domain, browser, and larger-paper PDF coverage.
2. **Advanced arithmetic and palettes**
   - Enumerate all legal operand/operator combinations, grouped by result,
     bounded by 100 squared operand pairs times three operators.
   - Validate settings once at domain entry points; compute result capacity
     before quantizing the image, capping the requested palette accordingly.
     Explain arithmetic-related color reductions in the UI, never fail silently.
   - Give every palette color one distinct result first. In multi-map mode,
     distribute remaining results fairly up to three per color, never allocating
     more results than the color has cells. Use every allocated result at least
     once, so the key has no unused results.
   - Store operators, grouped results, and settings in the frozen snapshot;
     screens and printouts must use the snapshot, not later control changes.
   - Keep a compact key grouped by color and sorted by its lowest result.
     Allow one result per line for up to four-digit multiplication answers.
   - Enlarge cells for longer expressions rather than shrinking fonts. Report
     when wider cells or larger legends require larger paper, even at 24 columns.
   - Generalize addition-only headings/instructions, retaining the familiar
     default addition wording where it remains accurate.
3. **Integrated validation and handoff**
   - Cover auto-size boundaries and oriented images, 64-column generation,
     setting defaults and validation, collapsed controls, all operator subsets,
     zero semantics, operands 2 and 99, nonnegative subtraction, and actual
     grouped mappings in the screen and PDF.
   - Cover insufficient-result palettes, one-color input, 16-color limits,
     multi-map scarce results/rare colors, frozen snapshots, and stale printing.
   - Exercise maximum-width and advanced-expression PDFs on sufficiently large
     custom paper, asserting readable cells, full text, correct mappings, and
     one page. Preserve all default A4/Letter regressions.
   - Independently review each iteration with a spawned sub-agent, address
     findings, and commit each meaningful increment. Record decisions here.

### V2 progress

- [x] Discuss technical/behavioral choices with the user.
- [x] Record the V2 plan in Git before implementation.
- [x] Auto sizing and wider readable worksheets, reviewed and committed.
- [x] Advanced arithmetic, multi-map, and palette controls, reviewed and committed.
- [x] Integrated validation, documentation, and final review committed.

### V2 source-maintenance note

An existing untracked `OIP.webp` was present at the beginning of this feature
request. It is user-owned input and will not be modified, removed, or committed.

### V2 sizing iteration review

Auto sizing uses oriented bitmap dimensions, preserving manual entries across
toggle changes. Width is bounded at 64, with a corresponding 1,536-cell pipeline
limit. Printed cells remain 7.5 mm with 10 pt arithmetic; print content grows
with the grid. Physical paper advice includes 10 mm margins on every edge.
The user must select suitable paper and 100% scale; CSS no longer forces portrait
orientation. Independent sub-agent review found no significant issues. Passed
35 targeted domain tests, 26 browser/print cases, production build, and lint,
including 64-column custom-paper PDFs and all existing A4/Letter print cases.

### V2 advanced iteration decisions and review

- Operator checkboxes specify the allowed set, not a promise that every operator
  will appear in every small puzzle. Problems are sampled from legal expressions
  for each assigned result. `*` is displayed as entered, with an explanatory
  multiplication note on mixed/multiplication worksheets.
- Results are allocated once per color first; additional results are allocated
  in shuffled round-robin passes, capped at three and at the color's cell count.
  Shuffled per-color schedules guarantee that every listed result is actually
  used. Fewer results are legitimate when math capacity or cell counts are small.
- Preserve original physical cell size for three-character expressions; enlarge
  all cells in the snapshot to 12 mm for longer expressions, maintaining square
  cells and 10 pt text. Screen cells likewise grow from 32 to 48 pixels.
- Group key entries by color, sort by the smallest answer, and place answers on
  separate lines so three four-digit multiplication results remain legible.
  Physical height recommendations account for legend row count and result lines.
- Chromium's fractional table-column distribution can add less than one CSS pixel
  to the final column at 64 columns. Advanced print assertions allow this
  sub-0.27-mm rounding difference, while independently enforcing cell size,
  minimum font size, expression fit, page count, and complete content.

The independent sub-agent review found no significant issues. Passed 60 targeted
domain tests, 32 targeted browser/print cases, production build, and lint. The
maximum-width advanced case includes more than eight separated colors, three
answers per color, four-digit results, and exact arithmetic/key extraction from
both puzzle and answer-key PDFs on sufficiently large paper.

### V2 integrated results

Added mapping-invariant coverage across all seven operator subsets, both operand
limits (2 and 99), both zero settings, and both mapping modes. Added layout
boundary tests and mobile checks that every Advanced change disables old
printouts without mutating their snapshot. Updated the run/use instructions and
page description to reflect configurable math rather than addition only.

The complete run passed 104 Vitest tests, 47 Playwright browser cases, strict
type checking, lint, and the production build. Browser coverage includes 20
default A4/Letter PDFs plus four wider/advanced custom-paper PDFs. Expanded
Advanced controls and grouped keys were visually inspected on desktop/mobile;
maximum-width advanced puzzle and answer-key PDFs were rasterized and visually
inspected. All source-image processing remained local.

The existing local preview at `http://127.0.0.1:5173` serves the rebuilt V2
application. The user-owned `OIP.webp` remains unmodified and untracked.
The final independent sub-agent review found no significant issues in this
completion increment. Each V2 implementation iteration was reviewed before its
own meaningful commit, following the same source-maintenance workflow as V1.

## 13. V3: taller grids, result controls, and project README

### Requirements and implementation decisions

- Align manual rows with columns: both accept 4-64, with a maximum of 4,096
  cells. Auto size remains the previously agreed A4-oriented 24-by-24 maximum.
  Warn for dimensions above 24 and retain readable physical cells and larger-
  paper advice, now including tall worksheets.
- Display the multiplication sign (Unicode U+00D7) in puzzle expressions and
  operator labels. Keep `*` as the internal operator identifier so computation
  is unchanged. Centralize operator display formatting, shared by screen,
  print, and expression-length layout decisions.
- Add Advanced "Maximum result", default 99, and "Allow zero results", default
  false. Zero operands and zero results are independent constraints.
- Decision: allow an integer maximum result from 0 to 9801, the natural maximum
  attainable with the existing 99-by-99 operand limit. A maximum of zero is
  useful for an explicitly enabled zero-result-only activity.
- Filter legal expressions before calculating result capacity, assigning
  colors, or multi-map results. Continue to prohibit negative results. When no
  legal result exists, explain the conflicting settings and disable generation;
  never pass a zero-color palette limit into image processing.
- Changing either result option marks the old snapshot stale and disables
  printing until regeneration. Freeze both options with generated snapshots.
- Add the requested `README.md` covering requirements, installation, local run,
  production build/preview, test commands, architecture, developer workflow,
  current options, print limitations, and local-image privacy.

### Iterations and validation

1. Raise the row/domain/image capacity, wire tall-grid warnings, and cover
   64-by-64 generation plus tall/custom-paper output. Review and commit.
2. Add result constraints and multiplication display across domain/UI/print.
   Update tests that intentionally need zero results or results above 99 to
   opt into those settings; retain default behavior coverage. Exercise empty
   result sets, zero-only puzzles, independent operand/result zeros, palette
   capacity, multi-map, invalid limits, and rendered/PDF multiplication symbols.
   Review and commit.
3. Write README and update current usage instructions. Run the complete suite,
   inspect representative output, perform a final review, and commit.

### V3 progress

- [x] Record implementation approach before coding.
- [x] Align height and width limits, reviewed and committed.
- [x] Result controls and multiplication sign, reviewed and committed.
- [ ] README, integrated validation, and final review committed.

The existing user-owned `OIP.webp` remains untouched and untracked.

### V3 height iteration

Rows now share the 64-column maximum directly, expanding the existing image and
palette guard to 4,096 cells. Added taller-grid advice before generation, kept
auto size within 24 by 24, and verified restoring a manual 64-row value after
toggling auto size. Independent sub-agent review found no significant issues.
Passed 58 targeted domain tests, 12 browser cases, build, and lint, including
complete 64-by-64 puzzle and answer-key PDFs on larger paper.

### V3 result/display iteration

Result constraints are applied while enumerating expressions, so the UI's
capacity, reduced palette, assigned results, and printed key all agree. An empty
maximum-result input is invalid, not an implicit zero. Empty legal-result sets
produce a specific actionable message and cannot reach palette generation.
Zero-only subtraction can use positive operands; enabling zero operands alone
does not enable zero answers. Existing high-result print coverage now opts
explicitly into maximum result 9801.

Multiplication keeps its internal `*` identifier; one display helper emits U+00D7
for controls, expressions, and print instructions. Exact extracted PDF expression
sequences verify the multiplication glyph and absence of asterisks. Independent
sub-agent review found no significant issues. Passed 72 targeted domain tests,
10 browser cases, production build, and lint.
