/**
 * IMAGEStoPDF — High-Fidelity Client-Side PDF Studio
 * 100% In-Memory Processing, Lossless Quality, Reordering, Rotation & Filters
 */

// ============================================================================
// State & Global Definitions
// ============================================================================

const STATE = {
  items: [], // Array of page objects
  isGenerating: false,
  currentPreviewBlobUrl: null,
  draggedIndex: null,
};

// Document & Layout Constants
const PAGE_SIZES = {
  fit: null, // Dynamic per image
  a4: { width: 595.28, height: 841.89 },       // Standard A4 in points (72 pt/in)
  letter: { width: 612.0, height: 792.0 },     // US Letter in points
};

// DOM Element References
const DOM = {
  themeToggle: document.getElementById('themeToggle'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  pagesSection: document.getElementById('pagesSection'),
  pagesGrid: document.getElementById('pagesGrid'),
  pagesCountBadge: document.getElementById('pagesCountBadge'),
  actionBar: document.getElementById('actionBar'),
  actionDocTitle: document.getElementById('actionDocTitle'),
  actionDocMeta: document.getElementById('actionDocMeta'),

  // Settings
  pageFormatSelect: document.getElementById('pageFormatSelect'),
  pageOrientationSelect: document.getElementById('pageOrientationSelect'),
  pageMarginSelect: document.getElementById('pageMarginSelect'),
  compressionSelect: document.getElementById('compressionSelect'),
  customDrawer: document.getElementById('customDrawer'),
  customQualitySlider: document.getElementById('customQualitySlider'),
  customQualityVal: document.getElementById('customQualityVal'),
  maxDimensionSelect: document.getElementById('maxDimensionSelect'),
  docTitleInput: document.getElementById('docTitleInput'),
  docAuthorInput: document.getElementById('docAuthorInput'),
  addPageNumbersCheckbox: document.getElementById('addPageNumbersCheckbox'),
  exportSeparateCheckbox: document.getElementById('exportSeparateCheckbox'),

  // Batch actions
  applyFilterAllBtn: document.getElementById('applyFilterAllBtn'),
  filterDropdownMenu: document.getElementById('filterDropdownMenu'),
  rotateAllBtn: document.getElementById('rotateAllBtn'),
  sortMenuBtn: document.getElementById('sortMenuBtn'),
  sortDropdownMenu: document.getElementById('sortDropdownMenu'),
  addMoreBtn: document.getElementById('addMoreBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),

  // Bottom action buttons
  previewPdfBtn: document.getElementById('previewPdfBtn'),
  generatePdfBtn: document.getElementById('generatePdfBtn'),
  generateBtnText: document.getElementById('generateBtnText'),

  // Modals
  previewDialog: document.getElementById('previewDialog'),
  previewModalTitle: document.getElementById('previewModalTitle'),
  previewModalMeta: document.getElementById('previewModalMeta'),
  pdfPreviewIframe: document.getElementById('pdfPreviewIframe'),
  modalDownloadBtn: document.getElementById('modalDownloadBtn'),
  closePreviewBtn: document.getElementById('closePreviewBtn'),

  processingDialog: document.getElementById('processingDialog'),
  processingTitle: document.getElementById('processingTitle'),
  processingSubtitle: document.getElementById('processingSubtitle'),
  progressBar: document.getElementById('progressBar'),
  progressPercent: document.getElementById('progressPercent'),
};

// ============================================================================
// Initialization & Theme
// ============================================================================

function initTheme() {
  const saved = localStorage.getItem('img2pdf-theme') || 
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', saved);

  DOM.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('img2pdf-theme', next);
  });
}

// ============================================================================
// File Ingestion & Decoding
// ============================================================================

async function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList);
  showProcessing('Ingesting images...', `Loading ${files.length} image(s)`, 0);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = Math.round(((i + 1) / files.length) * 100);
    updateProgress(progress, `Reading ${file.name}...`);

    try {
      const item = await processIncomingFile(file);
      if (item) {
        STATE.items.push(item);
      }
    } catch (err) {
      console.error(`Failed to load ${file.name}:`, err);
    }
  }

  hideProcessing();
  renderPagesGrid();
  updateUIState();
}

/**
 * Decode file into a PageItem with dimensions and thumbnail
 */
async function processIncomingFile(file) {
  const isHeic = /\.(heic|heif|heics)$/i.test(file.name) || 
                 file.type === 'image/heic' || file.type === 'image/heif';

  let imageSource = null;
  let rawBlob = file;

  if (isHeic) {
    // Try native createImageBitmap first (supported on Safari/iOS & macOS)
    try {
      imageSource = await createImageBitmap(file);
    } catch (e) {
      // Fallback: use heic-to module
      try {
        const { default: heicTo } = await import('https://cdn.jsdelivr.net/npm/heic-to@1.6.7/+esm');
        rawBlob = await heicTo(file, { type: 'image/jpeg', quality: 0.95 });
        imageSource = await loadImageElementFromBlob(rawBlob);
      } catch (heicErr) {
        console.warn('HEIC decoding failed:', heicErr);
        throw new Error(`HEIC format could not be decoded: ${heicErr.message}`);
      }
    }
  } else {
    // Standard image formats (JPG, PNG, WebP, GIF, SVG, BMP, TIFF)
    imageSource = await loadImageElementFromBlob(file);
  }

  const width = imageSource.naturalWidth || imageSource.width;
  const height = imageSource.naturalHeight || imageSource.height;

  const item = {
    id: 'page_' + Math.random().toString(36).substring(2, 9),
    file: rawBlob,
    name: file.name,
    size: rawBlob.size,
    type: rawBlob.type || 'image/jpeg',
    width: width,
    height: height,
    rotation: 0, // 0, 90, 180, 270
    filter: 'original',
    source: imageSource,
  };

  return item;
}

function loadImageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Image failed to decode'));
    };
    img.src = url;
  });
}

// ============================================================================
// Canvas Rendering & Document Filters Engine
// ============================================================================

/**
 * Render image to canvas applying rotation and selected filter
 */
function renderItemToCanvas(item, targetWidth, targetHeight, forThumbnail = false) {
  const rotation = item.rotation % 360;
  const isRotated90or270 = rotation === 90 || rotation === 270;

  // Determine output canvas size
  const origW = item.width;
  const origH = item.height;

  let canvasW = isRotated90or270 ? origH : origW;
  let canvasH = isRotated90or270 ? origW : origH;

  // If rendering for thumbnail, scale down smoothly
  if (forThumbnail) {
    const maxThumb = 320;
    const ratio = Math.min(maxThumb / canvasW, maxThumb / canvasH, 1);
    canvasW = Math.round(canvasW * ratio);
    canvasH = Math.round(canvasH * ratio);
  } else if (targetWidth && targetHeight) {
    canvasW = targetWidth;
    canvasH = targetHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.save();

  // Handle Rotation around canvas center
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  // Draw image centered
  const drawW = isRotated90or270 ? canvasH : canvasW;
  const drawH = isRotated90or270 ? canvasW : canvasH;
  ctx.drawImage(item.source, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.restore();

  // Apply Pixel Filters
  if (item.filter !== 'original') {
    applyFilterToCanvas(ctx, canvasW, canvasH, item.filter);
  }

  return canvas;
}

/**
 * High-performance client-side pixel manipulation for document scans & filters
 */
function applyFilterToCanvas(ctx, width, height, filterType) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  if (filterType === 'bw') {
    // Standard Grayscale (ITU-R BT.601)
    for (let i = 0; i < len; i += 4) {
      const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
    }
  } else if (filterType === 'scan') {
    // Document Scan (Crisp Paper): Removes paper shadows and boosts contrast
    for (let i = 0; i < len; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      let val = y;

      if (y > 165) {
        // Light paper / background: push aggressively towards pure white
        const factor = (y - 165) / 90;
        val = y + (255 - y) * factor;
      } else if (y < 125) {
        // Ink / text: deepen towards dark charcoal/black
        const factor = (125 - y) / 125;
        val = y * (1 - factor * 0.5);
      }
      val = Math.max(0, Math.min(255, Math.round(val)));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  } else if (filterType === 'brighten') {
    // Brighten (+25% Exposure) for underexposed documents
    for (let i = 0; i < len; i += 4) {
      data[i] = Math.min(255, Math.round(data[i] * 1.25 + 15));
      data[i + 1] = Math.min(255, Math.round(data[i + 1] * 1.25 + 15));
      data[i + 2] = Math.min(255, Math.round(data[i + 2] * 1.25 + 15));
    }
  } else if (filterType === 'sharpen') {
    // High Contrast S-Curve
    for (let i = 0; i < len; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = data[i + c] / 255;
        // Cubic sigmoid S-curve
        v = v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v);
        data[i + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================================
// UI Rendering & Grid Management
// ============================================================================

function renderPagesGrid() {
  const container = DOM.pagesGrid;
  container.innerHTML = '';

  STATE.items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-index', index);
    card.draggable = true;

    // Card Header
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <span class="page-num-pill">Page ${index + 1}</span>
      <div class="card-nav-buttons">
        <button type="button" class="nav-arrow-btn" data-action="move-left" ${index === 0 ? 'disabled' : ''} title="Move Left (←)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button type="button" class="nav-arrow-btn" data-action="move-right" ${index === STATE.items.length - 1 ? 'disabled' : ''} title="Move Right (→)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <button type="button" class="card-delete-btn" data-action="delete" title="Remove page">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    // Thumbnail Container
    const thumbBox = document.createElement('div');
    thumbBox.className = 'thumbnail-box';

    const canvas = renderItemToCanvas(item, null, null, true);
    canvas.className = 'card-canvas';
    thumbBox.appendChild(canvas);

    // Rotation Badge
    if (item.rotation > 0) {
      const rotBadge = document.createElement('span');
      rotBadge.className = 'rotation-badge';
      rotBadge.textContent = `${item.rotation}°`;
      thumbBox.appendChild(rotBadge);
    }

    // Card Body Controls
    const body = document.createElement('div');
    body.className = 'card-body';

    const dimsText = (item.rotation % 180 === 90) ? `${item.height} × ${item.width}` : `${item.width} × ${item.height}`;
    const sizeKb = (item.size / 1024).toFixed(0);

    body.innerHTML = `
      <div class="card-meta-text" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
      <div class="card-meta-text">${dimsText} px • ${sizeKb} KB</div>
      
      <div class="card-actions-row">
        <button type="button" class="btn-card-action" data-action="rotate-ccw" title="Rotate 90° Counter-Clockwise">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          <span>-90°</span>
        </button>
        <button type="button" class="btn-card-action" data-action="rotate-cw" title="Rotate 90° Clockwise">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          <span>+90°</span>
        </button>
      </div>

      <select class="card-filter-select" data-action="filter" title="Select filter for this page">
        <option value="original" ${item.filter === 'original' ? 'selected' : ''}>Original Color</option>
        <option value="bw" ${item.filter === 'bw' ? 'selected' : ''}>B&W Grayscale</option>
        <option value="scan" ${item.filter === 'scan' ? 'selected' : ''}>Document Scan</option>
        <option value="brighten" ${item.filter === 'brighten' ? 'selected' : ''}>Brighten (+25%)</option>
        <option value="sharpen" ${item.filter === 'sharpen' ? 'selected' : ''}>Sharpen Text</option>
      </select>
    `;

    card.appendChild(header);
    card.appendChild(thumbBox);
    card.appendChild(body);

    attachCardDragListeners(card, index);
    attachCardActionListeners(card, index);

    container.appendChild(card);
  });
}

function updateUIState() {
  const count = STATE.items.length;
  const hasItems = count > 0;

  DOM.pagesSection.hidden = !hasItems;
  DOM.actionBar.hidden = !hasItems;

  DOM.pagesCountBadge.textContent = `${count} ${count === 1 ? 'Page' : 'Pages'}`;

  if (hasItems) {
    const rawTitle = DOM.docTitleInput.value.trim() || 
      sanitizeDocName(STATE.items[0].name.replace(/\.[^/.]+$/, '')) || 'Document';
    DOM.actionDocTitle.textContent = `${rawTitle}.pdf`;
    
    // Estimate size
    const totalBytes = STATE.items.reduce((acc, it) => acc + it.size, 0);
    const estMb = (totalBytes / (1024 * 1024)).toFixed(1);
    DOM.actionDocMeta.textContent = `${count} ${count === 1 ? 'page' : 'pages'} • Source ~${estMb} MB`;
  }
}

// ============================================================================
// Drag and Drop Card Reordering
// ============================================================================

function attachCardDragListeners(card, index) {
  card.addEventListener('dragstart', (e) => {
    STATE.draggedIndex = index;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    clearDragBorders();
    STATE.draggedIndex = null;
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (STATE.draggedIndex === null || STATE.draggedIndex === index) return;

    const rect = card.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    clearDragBorders();
    if (e.clientX < midX) {
      card.classList.add('drag-target-left');
    } else {
      card.classList.add('drag-target-right');
    }
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-target-left', 'drag-target-right');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    clearDragBorders();

    if (STATE.draggedIndex === null || STATE.draggedIndex === index) return;

    const rect = card.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    let targetIndex = e.clientX < midX ? index : index + 1;

    if (STATE.draggedIndex < targetIndex) {
      targetIndex--;
    }

    const [movedItem] = STATE.items.splice(STATE.draggedIndex, 1);
    STATE.items.splice(targetIndex, 0, movedItem);

    renderPagesGrid();
    updateUIState();
  });
}

function clearDragBorders() {
  document.querySelectorAll('.page-card').forEach(c => {
    c.classList.remove('drag-target-left', 'drag-target-right');
  });
}

// ============================================================================
// Card Action Handlers
// ============================================================================

function attachCardActionListeners(card, index) {
  card.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'move-left' && index > 0) {
      swapItems(index, index - 1);
    } else if (action === 'move-right' && index < STATE.items.length - 1) {
      swapItems(index, index + 1);
    } else if (action === 'delete') {
      STATE.items.splice(index, 1);
      renderPagesGrid();
      updateUIState();
    } else if (action === 'rotate-cw') {
      rotateItem(index, 90);
    } else if (action === 'rotate-ccw') {
      rotateItem(index, -90);
    }
  });

  // Filter change
  const filterSelect = card.querySelector('.card-filter-select');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      STATE.items[index].filter = e.target.value;
      refreshCardThumbnail(card, STATE.items[index]);
    });
  }
}

function swapItems(idxA, idxB) {
  const temp = STATE.items[idxA];
  STATE.items[idxA] = STATE.items[idxB];
  STATE.items[idxB] = temp;
  renderPagesGrid();
}

function rotateItem(index, delta) {
  const item = STATE.items[index];
  item.rotation = (item.rotation + delta + 360) % 360;
  renderPagesGrid();
}

function refreshCardThumbnail(card, item) {
  const thumbBox = card.querySelector('.thumbnail-box');
  thumbBox.innerHTML = '';
  const canvas = renderItemToCanvas(item, null, null, true);
  canvas.className = 'card-canvas';
  thumbBox.appendChild(canvas);

  if (item.rotation > 0) {
    const rotBadge = document.createElement('span');
    rotBadge.className = 'rotation-badge';
    rotBadge.textContent = `${item.rotation}°`;
    thumbBox.appendChild(rotBadge);
  }
}

// ============================================================================
// PDF & ZIP Library Loaders (Offline-First + Multi-CDN Resilience)
// ============================================================================

async function ensurePdfLibLoaded() {
  if (window.PDFLib) return window.PDFLib;

  // 1. Wait briefly if local script tag is loading
  for (let i = 0; i < 15; i++) {
    if (window.PDFLib) return window.PDFLib;
    await new Promise((r) => setTimeout(r, 80));
  }

  // 2. Fallback to local vendor script if not yet loaded
  try {
    await loadScript('./vendor/pdf-lib.min.js');
    if (window.PDFLib) return window.PDFLib;
  } catch (e) {
    console.warn('Local vendor/pdf-lib.min.js not reachable, falling back to CDNs...');
  }

  // 3. Fallback to cdnjs
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.9/pdf-lib.min.js');
    if (window.PDFLib) return window.PDFLib;
  } catch (e) {}

  // 4. Fallback to unpkg
  try {
    await loadScript('https://unpkg.com/pdf-lib@1.17.9/dist/pdf-lib.min.js');
    if (window.PDFLib) return window.PDFLib;
  } catch (e) {}

  // 5. Fallback to jsdelivr
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.9/dist/pdf-lib.min.js');
    if (window.PDFLib) return window.PDFLib;
  } catch (e) {}

  throw new Error('PDF-Lib could not be loaded. Please ensure ./vendor/pdf-lib.min.js is present or check your internet connection.');
}

async function ensureJsZipLoaded() {
  if (window.JSZip) return window.JSZip;

  for (let i = 0; i < 10; i++) {
    if (window.JSZip) return window.JSZip;
    await new Promise((r) => setTimeout(r, 60));
  }

  try {
    await loadScript('./vendor/jszip.min.js');
    if (window.JSZip) return window.JSZip;
  } catch (e) {}

  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    if (window.JSZip) return window.JSZip;
  } catch (e) {}

  return window.JSZip;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

// ============================================================================
// PDF Generation Engine (using pdf-lib)
// ============================================================================

/**
 * Builds the PDF document from the current items and settings
 */
async function buildPdfDocument(onProgress) {
  const PDFLib = await ensurePdfLibLoaded();
  const { PDFDocument, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  // Document Metadata
  const docTitle = DOM.docTitleInput.value.trim() || 
    (STATE.items[0] ? sanitizeDocName(STATE.items[0].name.replace(/\.[^/.]+$/, '')) : 'Document');
  const docAuthor = DOM.docAuthorInput.value.trim() || 'IMAGEStoPDF Studio';

  pdfDoc.setTitle(docTitle);
  pdfDoc.setAuthor(docAuthor);
  pdfDoc.setCreator('IMAGEStoPDF (https://gaurav-budhwani.github.io/imagesTOpdf/)');

  // Settings
  const format = DOM.pageFormatSelect.value; // 'fit', 'a4', 'letter'
  const orientation = DOM.pageOrientationSelect.value; // 'auto', 'portrait', 'landscape'
  const marginPt = parseFloat(DOM.pageMarginSelect.value) || 0;
  const compressionPreset = DOM.compressionSelect.value;
  const addPageNumbers = DOM.addPageNumbersCheckbox.checked;

  const totalPages = STATE.items.length;

  for (let i = 0; i < totalPages; i++) {
    const item = STATE.items[i];
    if (onProgress) {
      const pct = Math.round(((i + 1) / totalPages) * 100);
      onProgress(pct, `Processing page ${i + 1} of ${totalPages}...`);
    }

    // Determine target quality and compression
    let quality = 0.85;
    let maxDim = 0;

    if (compressionPreset === 'lossless') {
      quality = 1.0;
      maxDim = 0;
    } else if (compressionPreset === 'high') {
      quality = 0.85;
      maxDim = 0;
    } else if (compressionPreset === 'balanced') {
      quality = 0.72;
      maxDim = 2560;
    } else if (compressionPreset === 'compact') {
      quality = 0.55;
      maxDim = 1800;
    } else if (compressionPreset === 'custom') {
      quality = parseInt(DOM.customQualitySlider.value, 10) / 100;
      maxDim = parseInt(DOM.maxDimensionSelect.value, 10);
    }

    // Get image bytes
    let imageBytes;
    let isJpg = true;

    // Check if we can do true 100% bit-for-bit lossless pass-through:
    // (Only when 0° rotation, original filter, no compression downsampling, and input is already JPG)
    const canPassThrough = (item.rotation === 0) && 
                           (item.filter === 'original') && 
                           (compressionPreset === 'lossless') && 
                           (item.type === 'image/jpeg' || item.type === 'image/jpg');

    if (canPassThrough) {
      imageBytes = await item.file.arrayBuffer();
      isJpg = true;
    } else {
      // Render to full resolution canvas with rotation and filters
      const rot = item.rotation % 360;
      const isRotated = rot === 90 || rot === 270;
      let targetW = isRotated ? item.height : item.width;
      let targetH = isRotated ? item.width : item.height;

      // Apply resolution downscale limit if configured
      if (maxDim > 0 && (targetW > maxDim || targetH > maxDim)) {
        const ratio = Math.min(maxDim / targetW, maxDim / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const canvas = renderItemToCanvas(item, targetW, targetH, false);

      if (compressionPreset === 'lossless' && item.type === 'image/png') {
        const blob = await canvasToBlob(canvas, 'image/png');
        imageBytes = await blob.arrayBuffer();
        isJpg = false;
      } else {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        imageBytes = await blob.arrayBuffer();
        isJpg = true;
      }
    }

    // Embed into PDF
    const embeddedImage = isJpg ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes);
    const imgW = embeddedImage.width;
    const imgH = embeddedImage.height;

    // Calculate Page Dimensions & Image Placement
    let pageWidth, pageHeight;
    let drawX, drawY, drawW, drawH;

    if (format === 'fit') {
      // Page dimensions match the image aspect ratio plus margins
      pageWidth = imgW + 2 * marginPt;
      pageHeight = imgH + 2 * marginPt;
      drawX = marginPt;
      drawY = marginPt;
      drawW = imgW;
      drawH = imgH;
    } else {
      // Standard paper size (A4 / Letter)
      const baseSize = PAGE_SIZES[format];
      let isLandscape;

      if (orientation === 'portrait') {
        isLandscape = false;
      } else if (orientation === 'landscape') {
        isLandscape = true;
      } else {
        // Auto orientation based on image aspect ratio
        isLandscape = imgW > imgH;
      }

      pageWidth = isLandscape ? Math.max(baseSize.width, baseSize.height) : Math.min(baseSize.width, baseSize.height);
      pageHeight = isLandscape ? Math.min(baseSize.width, baseSize.height) : Math.max(baseSize.width, baseSize.height);

      // Fit inside printable area
      const printableW = Math.max(10, pageWidth - 2 * marginPt);
      const printableH = Math.max(10, pageHeight - 2 * marginPt);

      const scale = Math.min(printableW / imgW, printableH / imgH);
      drawW = imgW * scale;
      drawH = imgH * scale;

      // Center the image inside the printable box
      drawX = marginPt + (printableW - drawW) / 2;
      drawY = marginPt + (printableH - drawH) / 2;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });

    // Optional Page Numbers
    if (addPageNumbers) {
      const pageText = `${i + 1} / ${totalPages}`;
      page.drawText(pageText, {
        x: pageWidth / 2 - 14,
        y: Math.max(8, marginPt / 2),
        size: 9,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

// ============================================================================
// Actions: Download & Preview
// ============================================================================

async function triggerPdfDownload() {
  if (STATE.items.length === 0 || STATE.isGenerating) return;

  STATE.isGenerating = true;
  showProcessing('Generating PDF...', 'Compiling document in memory', 0);

  try {
    const isSeparate = DOM.exportSeparateCheckbox.checked;

    if (isSeparate && window.JSZip) {
      // Export each image as an individual PDF wrapped in a ZIP
      await exportSeparatePdfsAsZip();
    } else {
      // Single Combined PDF
      const pdfBlob = await buildPdfDocument((pct, status) => updateProgress(pct, status));
      
      const rawTitle = DOM.docTitleInput.value.trim() || 
        sanitizeDocName(STATE.items[0].name.replace(/\.[^/.]+$/, '')) || 'Document';
      const filename = `${rawTitle}.pdf`;

      downloadBlob(pdfBlob, filename);
    }
  } catch (err) {
    console.error('PDF Generation Failed:', err);
    alert(`Could not build PDF: ${err.message}`);
  } finally {
    hideProcessing();
    STATE.isGenerating = false;
  }
}

async function triggerPdfPreview() {
  if (STATE.items.length === 0 || STATE.isGenerating) return;

  STATE.isGenerating = true;
  showProcessing('Building Preview...', 'Compiling PDF pages', 0);

  try {
    const pdfBlob = await buildPdfDocument((pct, status) => updateProgress(pct, status));

    if (STATE.currentPreviewBlobUrl) {
      URL.revokeObjectURL(STATE.currentPreviewBlobUrl);
    }

    STATE.currentPreviewBlobUrl = URL.createObjectURL(pdfBlob);
    DOM.pdfPreviewIframe.src = STATE.currentPreviewBlobUrl;

    const rawTitle = DOM.docTitleInput.value.trim() || 
      sanitizeDocName(STATE.items[0].name.replace(/\.[^/.]+$/, '')) || 'Document';
    DOM.previewModalTitle.textContent = `${rawTitle}.pdf`;
    DOM.previewModalMeta.textContent = `${STATE.items.length} pages • ${(pdfBlob.size / 1024).toFixed(0)} KB`;

    DOM.previewDialog.showModal();
  } catch (err) {
    console.error('Preview Generation Failed:', err);
    alert(`Could not generate preview: ${err.message}`);
  } finally {
    hideProcessing();
    STATE.isGenerating = false;
  }
}

async function exportSeparatePdfsAsZip() {
  const JSZip = await ensureJsZipLoaded();
  if (!JSZip) {
    throw new Error('JSZip library could not be loaded.');
  }
  const zip = new JSZip();
  const total = STATE.items.length;

  for (let i = 0; i < total; i++) {
    const item = STATE.items[i];
    updateProgress(Math.round(((i + 1) / total) * 100), `Generating PDF ${i + 1} of ${total}...`);

    // Temporarily slice single item
    const singlePdf = await buildSinglePdfFromItem(item, i + 1);
    const baseName = sanitizeDocName(item.name.replace(/\.[^/.]+$/, ''));
    zip.file(`${String(i + 1).padStart(2, '0')}_${baseName}.pdf`, singlePdf);
  }

  updateProgress(95, 'Compressing ZIP archive...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, 'Images_PDF_Collection.zip');
}

async function buildSinglePdfFromItem(item, pageNumber) {
  const PDFLib = await ensurePdfLibLoaded();
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();

  const canvas = renderItemToCanvas(item, null, null, false);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  const imgBytes = await blob.arrayBuffer();

  const embedded = await doc.embedJpg(imgBytes);
  const page = doc.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: embedded.width,
    height: embedded.height,
  });

  const bytes = await doc.save();
  return bytes;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ============================================================================
// Progress & Modals Helpers
// ============================================================================

function showProcessing(title, subtitle, percent = 0) {
  DOM.processingTitle.textContent = title;
  DOM.processingSubtitle.textContent = subtitle;
  DOM.progressBar.style.width = `${percent}%`;
  DOM.progressPercent.textContent = `${percent}%`;
  DOM.processingDialog.showModal();
}

function updateProgress(percent, subtitle) {
  DOM.progressBar.style.width = `${percent}%`;
  DOM.progressPercent.textContent = `${percent}%`;
  if (subtitle) {
    DOM.processingSubtitle.textContent = subtitle;
  }
}

function hideProcessing() {
  DOM.processingDialog.close();
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

function setupEventListeners() {
  // File input
  DOM.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    DOM.fileInput.value = '';
  });

  // Drop zone click
  DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
  DOM.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      DOM.fileInput.click();
    }
  });

  // Drag & drop on drop zone
  DOM.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.dropZone.classList.add('drag-active');
  });

  DOM.dropZone.addEventListener('dragleave', () => {
    DOM.dropZone.classList.remove('drag-active');
  });

  DOM.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.dropZone.classList.remove('drag-active');
    handleFiles(e.dataTransfer.files);
  });

  // Global window paste (Cmd+V / Ctrl+V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      handleFiles(files);
    }
  });

  // Add more button
  DOM.addMoreBtn.addEventListener('click', () => DOM.fileInput.click());

  // Clear all button
  DOM.clearAllBtn.addEventListener('click', () => {
    if (STATE.items.length === 0) return;
    if (confirm('Are you sure you want to remove all pages?')) {
      STATE.items = [];
      renderPagesGrid();
      updateUIState();
    }
  });

  // Rotate all button
  DOM.rotateAllBtn.addEventListener('click', () => {
    STATE.items.forEach(it => {
      it.rotation = (it.rotation + 90) % 360;
    });
    renderPagesGrid();
  });

  // Filter dropdown
  DOM.applyFilterAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.filterDropdownMenu.hidden = !DOM.filterDropdownMenu.hidden;
    DOM.sortDropdownMenu.hidden = true;
  });

  DOM.filterDropdownMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const filter = btn.dataset.filter;
    STATE.items.forEach(it => { it.filter = filter; });
    DOM.filterDropdownMenu.hidden = true;
    renderPagesGrid();
  });

  // Sort dropdown
  DOM.sortMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.sortDropdownMenu.hidden = !DOM.sortDropdownMenu.hidden;
    DOM.filterDropdownMenu.hidden = true;
  });

  DOM.sortDropdownMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    const sort = btn.dataset.sort;
    applySorting(sort);
    DOM.sortDropdownMenu.hidden = true;
  });

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    DOM.filterDropdownMenu.hidden = true;
    DOM.sortDropdownMenu.hidden = true;
  });

  // Settings: Page format change
  DOM.pageFormatSelect.addEventListener('change', () => {
    const isFit = DOM.pageFormatSelect.value === 'fit';
    document.getElementById('orientationSettingGroup').style.opacity = isFit ? '0.4' : '1';
    document.getElementById('orientationSettingGroup').style.pointerEvents = isFit ? 'none' : 'auto';
  });

  // Settings: Compression preset change
  DOM.compressionSelect.addEventListener('change', () => {
    DOM.customDrawer.hidden = DOM.compressionSelect.value !== 'custom';
  });

  // Settings: Custom slider
  DOM.customQualitySlider.addEventListener('input', () => {
    DOM.customQualityVal.textContent = `${DOM.customQualitySlider.value}%`;
  });

  // Action Bar Buttons
  DOM.generatePdfBtn.addEventListener('click', triggerPdfDownload);
  DOM.previewPdfBtn.addEventListener('click', triggerPdfPreview);

  // Preview Modal Actions
  DOM.closePreviewBtn.addEventListener('click', () => DOM.previewDialog.close());
  DOM.modalDownloadBtn.addEventListener('click', () => {
    DOM.previewDialog.close();
    triggerPdfDownload();
  });

  // Keyboard shortcut: Cmd/Ctrl + Enter generates PDF
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerPdfDownload();
    }
  });
}

function applySorting(mode) {
  if (mode === 'name-asc') {
    STATE.items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  } else if (mode === 'name-desc') {
    STATE.items.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  } else if (mode === 'size-desc') {
    STATE.items.sort((a, b) => b.size - a.size);
  } else if (mode === 'reverse') {
    STATE.items.reverse();
  }
  renderPagesGrid();
}

// ============================================================================
// Utilities
// ============================================================================

function sanitizeDocName(name) {
  return (name || 'Document').replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 50);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Boot
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  updateUIState();
});

