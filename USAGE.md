# MathDraw user guide

[Back to README](README.md) | [Troubleshooting and help](SUPPORT.md)

For installation and startup, see the [quick start](README.md#install-and-run).
MathDraw processes pictures locally in your browser, without uploading them.

## Create a puzzle

1. Choose a PNG, JPEG, or WebP image, up to 10 MiB and 40 million decoded pixels.
   Simple, high-contrast artwork works best.
2. Keep **Auto size from picture** enabled, or turn it off to set rows and columns
   manually. Optionally enable **Skip near-white background** below the grid settings.
3. Optionally expand **Advanced**, then select **Create puzzle**.
4. Switch between **Puzzle** and **Solution** to preview the activity.
5. Use **Print puzzle** for the uncolored activity or **Print answer key** for the
   colored solution. The browser's print dialog also supports saving a PDF.

Changing any generation option keeps the previous preview but disables printing
until you generate again. Pictures and puzzles are not saved across page reloads;
save a PDF if you want to keep a puzzle.

After the image loads, its original **width and height in pixels** appear below
the preview. These are the decoded image dimensions, with JPEG orientation
applied, not the smaller preview dimensions. Use their proportions to choose a
manual grid within the 4-64 row/column limits; the display does not change your
manual grid values.

## Language

Use **Language / 語言** near the top of the page to select **English** or
**繁體中文（台灣）**. On a first visit, MathDraw uses the first supported browser
language: English variants use English, and Chinese variants use Traditional
Chinese (Taiwan). If no browser language is supported, it falls back to English.

Your explicit choice is saved locally in this browser and takes precedence on
later visits. If browser storage is unavailable, a translated notice explains
that the choice lasts only until reload; the app remains usable.

Changing language translates the controls, validation and existing error
messages, worksheet instructions, color labels, and printed puzzle/answer key.
It does **not** regenerate a puzzle, change its arithmetic or color mappings,
discard your image/settings, change the current view, or make a stale puzzle
printable. The language selector is disabled while printing is being prepared
or the print dialog is open. Browser/operating-system file pickers and print
dialogs follow their own language settings.

在頁面上方的「語言」選擇「繁體中文（台灣）」即可使用繁體中文介面與學習單。
切換語言不會重新出題，也不會清除圖片或設定；列印視窗本身的語言則由瀏覽器決定。

## Options

Grid size and background skipping are on the main setup panel. Math difficulty,
result mapping, and color limits are under **Advanced**.

| Option | Default | Behavior |
| --- | --- | --- |
| Manual grid | 16 columns, 20 rows | 4-64 in either direction; up to 4,096 cells |
| Auto size | On | Matches image proportions within 24 by 24; minimum 4 per dimension |
| Skip near-white background | Off | Leaves edge-connected near-white cells blank; enclosed white details still have problems |
| Allow zero operands | Off | When enabled, operands may start at 0 instead of 1 |
| Maximum operand | 9 | Integer from 2 to 99 |
| Operators | Addition | Any nonempty set of addition, subtraction, and multiplication |
| Maximum result | 99 | Integer from 0 to 9801; inclusive upper bound for every answer |
| Allow zero results | Off | Independently permits answer 0; negative answers are never allowed |
| Multiple results per color | On | Uses the configured result cap; an answer still identifies exactly one color |
| Maximum results per color | 3 | Integer from 1 to 8; applies when multiple results are enabled |
| Maximum colors | 8 | Integer from 1 to 16; actual count may be lower |

## Arithmetic

Multiplication is displayed with the multiplication sign, not an asterisk.
Operator selections specify what is allowed, not a guarantee that every selected
operator appears in a small puzzle.

Zero operands and zero results are separate: `0 + 1` is valid when zero operands
are enabled and zero results are disabled. `3 - 3` requires zero results to be
enabled, but does not require zero operands. A maximum result of 0 can create
a zero-only subtraction activity when zero results are enabled. If no legal
problems remain, the app explains the conflict and disables generation.

## Images and backgrounds

The full image is fitted without cropping or stretching. White margins are added
when necessary, and transparency is composited onto white. White counts as a
palette color and is labeled **Leave white** when it has problems in the color key.

### Experimental foreground-dominant cell colors

On this experiment branch, each cell first ignores all near-white samples
(every RGB channel at least 240), whether or not they connect to an image edge.
The remaining samples are grouped into RGB buckets spanning 16 levels per channel.
The largest group wins; its most frequent actual sampled color represents the
cell. A cell with no remaining samples becomes pure white. Sampling still uses
16 by 16 samples per cell. Equal counts use numeric RGB order for stable results,
not the order pixels are visited.

Even one non-background sample can now determine a mostly white cell, preserving
small marks but also amplifying noise and antialiased edges. Minority details
among competing foreground groups can still disappear. Similar shades on opposite
bucket boundaries can split into different groups. Browser resizing can still
blend source pixels before this step. The later image-wide CIELAB palette selection
and color limits are unchanged.

This sampling experiment applies regardless of **Skip near-white background**.
That separate toggle controls whether edge-connected near-white cells in the
finished grid get math problems; it does not control sample exclusion.

### Skipping backgrounds

Enable **Skip near-white background** to leave background squares without math
problems. Detection uses the final resized, simplified grid: every RGB channel
must be at least 240, and cells must connect to an outer edge through shared
sides. Diagonal-only contact does not connect a region. Enclosed white/near-white
details still have problems, even when they share the background color. Resizing
and color simplification can change which regions connect.

Skipped squares remain in the grid and should be left uncolored; the solution
shows them as white. The color key includes only colors used by actual problems.
An entirely near-white background image produces a blank worksheet with an
explanation; turn the toggle off or choose another picture to get problems.

## Colors and result mappings

Similar shades are merged to keep colors perceptually separated. The palette is
also limited by the number of legal math answers. Multi-map results are listed
together beside their swatch, and every listed result is used in the puzzle.
An answer always maps to exactly one color across the whole worksheet.

In **Advanced**, set **Maximum results per color** to 1-8 (default 3).
This is an upper bound: limited cells or allowed answers may reduce the count.
Turning multi-map off uses one result per active color and retains your configured
cap for later use. Larger keys can require larger paper, without shrinking text.

## Printing

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
Use the closest pencils or crayons you have.
