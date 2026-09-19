# MathDraw

Turn a picture into a printable color-by-math puzzle. Solve the problems, match
answers to the shared color key, and color the squares to reveal a pixel picture.

MathDraw runs entirely in your browser. Images stay on your device; there are no
uploads, accounts, or backend services. The interface and worksheets support
English and Traditional Chinese (Taiwan).

## Install and run

Install [Node.js](https://nodejs.org/) and npm. Node.js 24 LTS is recommended;
the minimum supported version is 22.13.0. A current desktop Chrome or Edge
browser is recommended for printing.

From the project directory:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

These commands use Windows PowerShell. On macOS/Linux, use `npm` instead of
`npm.cmd`. Open the URL printed by Vite, normally **http://127.0.0.1:5173**.
If that port is occupied, use the URL Vite chooses. Stop the server with **Ctrl+C**;
do not open `index.html` directly.

## Make a puzzle

Choose a PNG, JPEG, or WebP image, adjust the grid and optional settings, then
select **Create puzzle**. Switch between **Puzzle** and **Solution**, or use
**Print puzzle** / **Print answer key** to print or save a PDF.

Pictures and puzzles are not saved across reloads. Save a PDF before leaving if
you want to keep your work. Changing generation settings requires creating a new
puzzle before printing; changing language does not.

## Documentation

| Guide | Contents |
| --- | --- |
| [User guide](USAGE.md) | Image limits, language, grid and math options, background skipping, colors, and printing |
| [Contributing](CONTRIBUTING.md) | Developer setup, build and preview, tests, architecture, translations, and branch/PR workflow |
| [Support](SUPPORT.md) | Troubleshooting, getting help, and reporting a problem |
| [Implementation history](PLAN.md) | Historical plans, technical decisions, and review records; use the guides above for current instructions |

## License

MathDraw uses [The Coffeeware License (Revision 42)](LICENSE.md).
Keep the license notice when reusing the code. If we meet and you find it useful,
you can buy me a coffee.
