# MathDraw support

[Back to README](README.md) | [User guide](USAGE.md) | [Developer guide](CONTRIBUTING.md)

## Getting help

Start with the [user guide](USAGE.md) for settings and printing, or the
[developer guide](CONTRIBUTING.md) for installation details, commands, and tests.
If these guides do not answer your question, search the repository's
[GitHub issues](https://github.com/tfliao/MathDraw/issues). Open a new issue if
there is no existing report that matches your problem.

## Common problems

| Problem | What to try |
| --- | --- |
| Node.js or npm is not found | Install a supported Node.js version from the [quick start](README.md#install-and-run). Existing Windows workspaces may use the [optional portable runtime](CONTRIBUTING.md#optional-portable-node-runtime). |
| Opening `index.html` shows a blank page | Start the development server using the README commands and open its printed URL rather than the file directly. |
| The local URL is not the expected port | Use the URL printed by Vite. The default development port is 5173; another running server can make Vite choose a different port. |
| Browser tests cannot start on port 4173 | Stop your preview server on that port, or start preview with `npm.cmd run preview -- --host 127.0.0.1 --port 5174`. Tests require their own port 4173 server. |
| Production preview still shows an older version | Run `npm.cmd run build` again, then refresh the preview page. Preview serves `dist`, not live source changes. |
| A picture is rejected | Use a nonempty, decodable PNG/JPEG/WebP file no larger than 10 MiB and 40 million pixels. Resize it or try another picture. |
| **Create puzzle** is disabled | Choose a valid picture and correct invalid grid/Advanced settings. Select at least one operator; the chosen operands, result cap, and zero settings must permit an answer. Wait for any loading or print preparation to finish. |
| A puzzle has fewer colors or answers than requested | The limits are maximums. Optional similar-color merging and legal math answers may reduce the palette; each mapped answer needs a non-background cell. See [colors and mappings](USAGE.md#colors-and-result-mappings). |
| A small image looks different even at the same grid size | Refresh to use the latest build. Match columns to original width and rows to height; turn off **Merge similar colors** and **Skip near-white background**. Color capacity still applies. Inspect the processing summary and download a debugging bundle if differences remain. |
| Some squares have no problem | **Skip near-white background** leaves edge-connected near-white cells blank. Disable it to give every square a problem. An all-background picture has no problems or color key. |
| Background skipping removes more detail than expected | Detection uses the resized, simplified grid. Try a larger grid or disable background skipping; enclosed regions can become connected after simplification. See [background behavior](USAGE.md#images-and-backgrounds). |
| Print buttons are disabled after editing | Select **Create puzzle** again to apply the current settings. The old preview is intentionally not printable while stale. Close an open print dialog to resume editing. |
| The worksheet is clipped, scaled, or has unexpected colors | Follow the displayed paper dimensions and the [printing guide](USAGE.md#printing). Use sufficiently large paper, 100% scale, color printing, and no browser headers/footers. |
| The language choice is not remembered | Browser storage may be blocked or unavailable. The selector still works for the current page; the displayed notice explains the limitation. |
| File-picker or print-dialog buttons stay in another language | Those dialogs follow browser/operating-system settings, not the MathDraw language selector. |

## Reporting a problem

Include enough information to reproduce it:

- Browser and operating-system versions, and whether you are using a local build.
- The commit or PR you are trying, if known.
- Steps to reproduce, expected behavior, and what actually happened.
- Grid size, math/background/color options, and selected language.
- Any visible error message. For printing issues, include paper size, orientation,
  scale, and whether the problem happens in a saved PDF or on a physical printer.
- A small, non-sensitive sample image or screenshot when needed to reproduce it.
- For image-quality issues, optionally include a debugging bundle from the
  generated preview on a local loopback host. It captures original bytes, settings, intermediate colors,
  and the exact result without requiring a screenshot or a second generation.

Debug downloading is intentionally unavailable on GitHub Pages and other non-local
hosts, including LAN IP addresses. To capture a bundle, run the application locally
using the README instructions, open its `localhost`/loopback URL, and regenerate
the puzzle using the same image and settings. Processing statistics remain visible
on the public site.

The bundle is JSON, not an archive or executable. Its `source.dataUrl` holds the
original file; `stages.sampled`, `stages.quantized`, and `stages.solution` hold PNG
data URLs. `diagnostics` records applied/requested algorithms, whether identity
copy was used, effective color capacity, sample resolution, and pre-palette RGBs.
`stats` distinguishes palette changes from background whitening. Compare these
stages to locate the change rather than assuming every difference comes from resizing.
To inspect locally in a browser, copy one image data URL into the address bar.

MathDraw does not upload your pictures automatically. Attaching a file to a
public issue does share it publicly: do not include private images, credentials,
or personal information. A simple generated sample is preferable to a personal
photo. Debug bundles include the original file's embedded metadata (potentially
including location information); review it before sharing. Remove sensitive
details from screenshots and logs.
