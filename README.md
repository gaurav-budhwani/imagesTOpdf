# IMAGEStoPDF — High-Fidelity Image to PDF Studio

A minimal, lightning-fast, and 100% private in-browser tool to assemble, rotate, filter, and convert multiple images into pristine PDF documents.

Designed to match the aesthetic and engineering precision of **HEICto-**.

---

## ⚡ Highlights

- **Lossless Fidelity**: Preserves maximum original image quality and native resolutions without forced lossy re-encoding or artifacts.
- **Configurable Compression**: Choose from *Lossless (100%)*, *High Quality (85%)*, *Balanced (72%)*, *Compact (55%)*, or custom slider + resolution limiters.
- **Interactive Page Management**:
  - **Drag-and-Drop Reordering**: Smoothly drag cards to adjust page order before compiling.
  - **Precision Arrow Controls**: Move Left (←) / Move Right (→) for touch and keyboard accessibility.
  - **4-Way Rotation**: Rotate any individual page by 90°, 180°, 270°, or 360° with real-time thumbnail updates.
  - **Batch Tools**: Rotate all pages, apply filters to all pages, or sort alphabetically / by file size.
- **Document Filters**:
  - **Original**: Natural color and dynamic range.
  - **B&W / Grayscale**: Clean monochrome conversion for black & white printing.
  - **Document Scan (Crisp Paper)**: Adaptive contrast curve that brightens shadowed/yellowed paper backgrounds to crisp white and deepens text ink.
  - **Brighten (+25%)**: Exposure boost for dimly lit smartphone photos.
  - **Sharpen & High Contrast**: Enhances fine text edges and handwriting legibility.
- **Flexible Page Geometry**:
  - **Fit Image**: Creates pages sized to each image's native aspect ratio with zero blank borders.
  - **Standard Paper**: A4 and US Letter with Auto / Portrait / Landscape orientation.
  - **Configurable Margins**: None (0 mm), Small (5 mm), Standard (12 mm), or Wide (20 mm).
- **Live PDF Preview**: Inspect the fully compiled PDF directly in an in-memory browser viewer before downloading.
- **100% Client-Side & Private**: All image decoding, canvas manipulation, and PDF compilation run entirely inside your browser's RAM via `pdf-lib`. No files are ever uploaded to any cloud server.
- **Multi-Format Ingestion**: Supports JPG, PNG, WebP, HEIC/HEIF (iPhone photos), TIFF, BMP, SVG, and clipboard screenshot pasting (`Cmd+V` / `Ctrl+V`).

---

## 🚀 Quick Start (Local Desktop)

### macOS (Finder 1-Click)
Double-click **`start.command`** in macOS Finder. It starts the local server and automatically opens your default browser at `http://localhost:5174`.

### Terminal (macOS / Linux)
```bash
./start.sh
# Or directly with Python 3:
python3 app.py
```

---

## 🌐 Web Deployment (GitHub Pages)

This project has zero server dependencies. You can host it on GitHub Pages in two simple ways:

1. **Deploy from `/docs` folder**:
   In your GitHub repository settings under **Pages**, set **Source** to `Deploy from a branch`, select `main`, and choose folder `/docs`.
2. **Deploy to `gh-pages` branch**:
   Point GitHub Pages to the `web/` directory or root of a `gh-pages` branch.

Your tool will be live at `https://<your-username>.github.io/<repo-name>/`.

---

## 📁 Project Structure

```
imagesTOpdf/
├── app.py              # Lightweight local Python HTTP server (zero external pip packages)
├── start.command       # Double-clickable macOS Finder launcher
├── start.sh            # Terminal startup script
├── README.md           # Documentation
├── web/                # Complete client-side web application
│   ├── index.html      # Semantic HTML5 UI
│   ├── style.css       # Dark/Light zinc design system
│   ├── app.js          # In-browser PDF generation engine (pdf-lib, canvas filters, drag-and-drop)
│   ├── favicon.svg     # Vector icon
│   └── .nojekyll       # GitHub Pages compatibility flag
└── docs/               # Direct mirror of web/ for GitHub Pages static hosting
```

---

## 📄 License

MIT License. Free and open source for personal and commercial use.
