# imagesTOpdf

A web tool to convert images into a PDF document directly in the browser.

## Features

- **Quality Preservation**: Keeps original image resolution and quality without forced downscaling.
- **Target File Size Limit**: Option to limit the output PDF size (default is 7 MB, with presets for 2 MB, 5 MB, 10 MB, or custom values).
- **Page Ordering**: Drag and drop cards or use arrow buttons to arrange pages in any sequence.
- **Rotation**: Rotate individual images by 90, 180, 270, or 360 degrees, or rotate all pages at once.
- **Document Filters**: Apply filters such as Original, Black and White, Document Scan (brightens paper background and darkens text), Brighten, and High Contrast.
- **Page Layout**: Choose between Fit to Image (matches original aspect ratio), A4, or US Letter, with customizable margins and orientation.
- **Preview**: View the generated PDF inside the browser before downloading.
- **Supported Formats**: Accepts JPG, PNG, WebP, HEIC, TIFF, BMP, and SVG files, as well as pasted images from the clipboard.
- **Client-Side Processing**: Runs locally in the browser without uploading files to an external server.

## Local Usage

### macOS
Double-click `start.command` in Finder to launch the local server and open the tool in your browser (`http://localhost:5174`).

### Terminal
```bash
./start.sh
```
Or run directly with Python:
```bash
python3 app.py
```

## Deployment

The tool runs as a static site and can be hosted on GitHub Pages:

1. In repository settings, navigate to **Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose the `gh-pages` branch and `/ (root)` folder (or `main` branch and `/docs` folder).
4. Save the configuration.

## Project Structure

```
imagesTOpdf/
├── app.py              # Local Python server
├── start.command       # macOS Finder launcher
├── start.sh            # Shell launcher
├── README.md           # Documentation
├── web/                # Web application files
│   ├── index.html      # User interface
│   ├── style.css       # Styles
│   ├── app.js          # Application logic
│   ├── favicon.svg     # Icon
│   ├── .nojekyll       # GitHub Pages configuration
│   └── vendor/         # Bundled offline libraries
└── docs/               # Static mirror for GitHub Pages
```

## License

MIT License.
