# MathDraw implementation plan

Status: Implementation approved; work in progress.

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
- [ ] Integrated completion, reviewed and committed.

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
