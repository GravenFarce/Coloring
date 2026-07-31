const MAX_DIMENSION = 1600;

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const previewArea = document.getElementById('preview-area');
const originalCanvas = document.getElementById('original-canvas');
const outputCanvas = document.getElementById('output-canvas');
const downloadButton = document.getElementById('download-button');
const printButton = document.getElementById('print-button');
const emailButton = document.getElementById('email-button');
const successMessage = document.getElementById('success-message');
const tuningControls = document.getElementById('tuning-controls');
const detailSlider = document.getElementById('detail-slider');
const detailValue = document.getElementById('detail-value');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityValue = document.getElementById('sensitivity-value');
const resetButton = document.getElementById('reset-button');

let currentFileName = 'coloring-sheet';
let processingToken = 0;

const DEFAULT_THRESHOLD = 210;
const DEFAULT_GAIN = 3;

let cachedBlurred = null;
let cachedWidth = 0;
let cachedHeight = 0;
let cachedMagnitude = null;
let sensitivityDebounceTimer = null;

function validateImageFile(file) {
  return !!file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function computeDrawSize(width, height, maxDimension) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxDimension) return { width, height };
  const scale = maxDimension / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function drawImageToCanvas(img, canvas, maxDimension) {
  const { width, height } = computeDrawSize(img.naturalWidth, img.naturalHeight, maxDimension);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return ctx;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function showSuccess(msg) {
  successMessage.textContent = msg;
  successMessage.hidden = false;
}

function clearSuccess() {
  successMessage.hidden = true;
  successMessage.textContent = '';
}

async function handleFile(file) {
  clearError();
  clearSuccess();
  if (!validateImageFile(file)) {
    showError('Please upload an image file (PNG, JPEG, or WebP).');
    return;
  }

  const token = ++processingToken;

  currentFileName = file.name.replace(/\.[^/.]+$/, '');

  clearTimeout(sensitivityDebounceTimer);

  previewArea.hidden = true;
  downloadButton.hidden = true;
  printButton.hidden = true;
  emailButton.hidden = true;
  tuningControls.hidden = true;
  statusMessage.hidden = false;

  // Yield to the browser so "Processing…" paints before the heavy
  // synchronous pixel loop below runs.
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (token !== processingToken) return;

  try {
    const img = await loadImageFromFile(file);
    if (token !== processingToken) return;
    const ctx = drawImageToCanvas(img, originalCanvas, MAX_DIMENSION);
    const imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);

    cachedWidth = imageData.width;
    cachedHeight = imageData.height;
    const gray = toGrayscale(imageData);
    cachedBlurred = boxBlur3x3(gray, cachedWidth, cachedHeight);

    detailSlider.value = String(DEFAULT_THRESHOLD);
    detailValue.textContent = String(DEFAULT_THRESHOLD);
    sensitivitySlider.value = String(DEFAULT_GAIN);
    sensitivityValue.textContent = String(DEFAULT_GAIN);

    recomputeFromBlur(DEFAULT_GAIN, DEFAULT_THRESHOLD);

    previewArea.hidden = false;
    downloadButton.hidden = false;
    printButton.hidden = false;
    emailButton.hidden = false;
    tuningControls.hidden = false;
  } catch (err) {
    if (token === processingToken) {
      showError('Something went wrong processing that image. Please try a different file.');
    }
    console.error(err);
  } finally {
    if (token === processingToken) {
      statusMessage.hidden = true;
    }
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

document.addEventListener('paste', (e) => {
  const items = e.clipboardData ? e.clipboardData.items : [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) handleFile(file);
      break;
    }
  }
});

function toGrayscale(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function boxBlur3x3(gray, width, height) {
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += gray[ny * width + nx];
            count++;
          }
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

function localContrastNormalize(gray, width, height, windowRadius = 7, targetMean = 128, targetStd = 64, maxGain = 3) {
  const w = width, h = height;
  const sumTable = new Float64Array((w + 1) * (h + 1));
  const sumSqTable = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x];
      const idx = (y + 1) * (w + 1) + (x + 1);
      sumTable[idx] = v + sumTable[idx - 1] + sumTable[idx - (w + 1)] - sumTable[idx - (w + 1) - 1];
      sumSqTable[idx] = v * v + sumSqTable[idx - 1] + sumSqTable[idx - (w + 1)] - sumSqTable[idx - (w + 1) - 1];
    }
  }

  function windowSum(table, x0, y0, x1, y1) {
    const a = (y1 + 1) * (w + 1) + (x1 + 1);
    const b = y0 * (w + 1) + (x1 + 1);
    const c = (y1 + 1) * (w + 1) + x0;
    const d = y0 * (w + 1) + x0;
    return table[a] - table[b] - table[c] + table[d];
  }

  const minStdForGain = targetStd / maxGain;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - windowRadius);
    const y1 = Math.min(h - 1, y + windowRadius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - windowRadius);
      const x1 = Math.min(w - 1, x + windowRadius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = windowSum(sumTable, x0, y0, x1, y1);
      const sumSq = windowSum(sumSqTable, x0, y0, x1, y1);
      const mean = sum / count;
      const variance = Math.max(0, sumSq / count - mean * mean);
      const stdDev = Math.sqrt(variance);
      const effectiveStd = Math.max(stdDev, minStdForGain);
      out[y * w + x] = (gray[y * w + x] - mean) / effectiveStd * targetStd + targetMean;
    }
  }
  return out;
}

const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

function sobelMagnitude(gray, width, height) {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          const val = gray[ny * width + nx];
          gx += val * SOBEL_X[k];
          gy += val * SOBEL_Y[k];
          k++;
        }
      }
      out[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

function thresholdAndInvert(magnitude, threshold) {
  const out = new Uint8ClampedArray(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    out[i] = magnitude[i] > threshold ? 0 : 255;
  }
  return out;
}

function toImageData(channel, width, height) {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  for (let i = 0, p = 0; p < channel.length; i += 4, p++) {
    data[i] = data[i + 1] = data[i + 2] = channel[p];
    data[i + 3] = 255;
  }
  return imageData;
}

function sampleBorderColor(imageData, borderWidth) {
  const { data, width, height } = imageData;
  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < borderWidth || x >= width - borderWidth || y < borderWidth || y >= height - borderWidth) {
        const i = (y * width + x) * 4;
        rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
        n++;
      }
    }
  }
  return { r: rSum / n, g: gSum / n, b: bSum / n };
}

function floodFillBackgroundByColor(imageData, avgColor, threshold) {
  const { data, width, height } = imageData;
  function colorDist(p) {
    const i = p * 4;
    const dr = data[i] - avgColor.r, dg = data[i + 1] - avgColor.g, db = data[i + 2] - avgColor.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  const background = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qlen = 0;
  function trySeed(x, y) {
    const idx = y * width + x;
    if (!background[idx] && colorDist(idx) < threshold) { background[idx] = 1; queue[qlen++] = idx; }
  }
  for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
  for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }
  let head = 0;
  while (head < qlen) {
    const idx = queue[head++];
    const x = idx % width, y = Math.floor(idx / width);
    if (x > 0 && !background[idx - 1] && colorDist(idx - 1) < threshold) { background[idx - 1] = 1; queue[qlen++] = idx - 1; }
    if (x < width - 1 && !background[idx + 1] && colorDist(idx + 1) < threshold) { background[idx + 1] = 1; queue[qlen++] = idx + 1; }
    if (y > 0 && !background[idx - width] && colorDist(idx - width) < threshold) { background[idx - width] = 1; queue[qlen++] = idx - width; }
    if (y < height - 1 && !background[idx + width] && colorDist(idx + width) < threshold) { background[idx + width] = 1; queue[qlen++] = idx + width; }
  }
  return background;
}

function largestSilhouetteComponent(background, width, height) {
  const silhouette = new Uint8Array(width * height);
  for (let i = 0; i < silhouette.length; i++) silhouette[i] = background[i] ? 0 : 1;

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let bestPixels = null, bestCount = 0;

  const DX8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  for (let start = 0; start < silhouette.length; start++) {
    if (!silhouette[start] || visited[start]) continue;
    let qlen = 0;
    queue[qlen++] = start;
    visited[start] = 1;
    const componentPixels = [start];
    let head = 0;
    while (head < qlen) {
      const idx = queue[head++];
      const x = idx % width, y = Math.floor(idx / width);
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d], ny = y + DY8[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nidx = ny * width + nx;
        if (silhouette[nidx] && !visited[nidx]) {
          visited[nidx] = 1;
          queue[qlen++] = nidx;
          componentPixels.push(nidx);
        }
      }
    }
    if (componentPixels.length > bestCount) {
      bestCount = componentPixels.length;
      bestPixels = componentPixels;
    }
  }

  const out = new Uint8Array(width * height);
  if (bestPixels) for (const idx of bestPixels) out[idx] = 1;
  return { mask: out, count: bestCount };
}

function smoothMask(mask, width, height, radius) {
  const sat = new Int32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y + 1) * (width + 1) + (x + 1);
      sat[idx] = mask[y * width + x] + sat[idx - 1] + sat[idx - (width + 1)] - sat[idx - (width + 1) - 1];
    }
  }
  function windowSum(x0, y0, x1, y1) {
    const a = (y1 + 1) * (width + 1) + (x1 + 1);
    const b = y0 * (width + 1) + (x1 + 1);
    const c = (y1 + 1) * (width + 1) + x0;
    const d = y0 * (width + 1) + x0;
    return sat[a] - sat[b] - sat[c] + sat[d];
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(width - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = windowSum(x0, y0, x1, y1);
      out[y * width + x] = sum > count / 2 ? 1 : 0;
    }
  }
  return out;
}

const MOORE_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const MOORE_DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function traceBoundary(mask, width, height) {
  function isFg(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return mask[y * width + x] === 1;
  }
  let startX = -1, startY = -1;
  for (let i = 0; i < mask.length && startX === -1; i++) {
    if (mask[i]) { startX = i % width; startY = Math.floor(i / width); }
  }
  if (startX === -1) return [];

  const boundary = [[startX, startY]];
  let cx = startX, cy = startY;
  let backDir = 6; // West — guaranteed background/out-of-bounds for a raster-scan-first pixel

  let hasAnyNeighbor = false;
  for (let d = 0; d < 8; d++) if (isFg(cx + MOORE_DX[d], cy + MOORE_DY[d])) { hasAnyNeighbor = true; break; }
  if (!hasAnyNeighbor) return boundary;

  const maxSteps = width * height * 8;
  let steps = 0;
  while (steps < maxSteps) {
    steps++;
    let foundDir = -1, nx = 0, ny = 0;
    for (let i = 1; i <= 8; i++) {
      const dir = (backDir + i) % 8;
      const tx = cx + MOORE_DX[dir], ty = cy + MOORE_DY[dir];
      if (isFg(tx, ty)) { foundDir = dir; nx = tx; ny = ty; break; }
    }
    if (foundDir === -1) break;
    backDir = (foundDir + 4) % 8;
    cx = nx; cy = ny;
    if (cx === startX && cy === startY) break;
    boundary.push([cx, cy]);
  }
  return boundary;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0], dy = lineEnd[1] - lineStart[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point[0] - lineStart[0], point[1] - lineStart[1]);
  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq;
  const projX = lineStart[0] + t * dx, projY = lineStart[1] + t * dy;
  return Math.hypot(point[0] - projX, point[1] - projY);
}

function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points.slice();
  let maxDist = 0, maxIdx = 0;
  const a = points[0], b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], a, b);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function simplifyClosedPolygon(points, epsilon) {
  const n = points.length;
  if (n < 4) return points.slice();
  const mid = Math.floor(n / 2);
  const half1 = points.slice(0, mid + 1);
  const half2 = points.slice(mid).concat([points[0]]);
  const simp1 = douglasPeucker(half1, epsilon);
  const simp2 = douglasPeucker(half2, epsilon);
  return simp1.slice(0, -1).concat(simp2.slice(0, -1));
}

function simplifyToApproxCount(points, targetCount, maxIterations = 25) {
  let lo = 0, hi = 200;
  let best = simplifyClosedPolygon(points, hi);
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const simplified = simplifyClosedPolygon(points, mid);
    if (Math.abs(simplified.length - targetCount) < Math.abs(best.length - targetCount)) best = simplified;
    if (simplified.length > targetCount) lo = mid; else hi = mid;
  }
  return best;
}

function generateDotPoints(imageData, tightness, targetDotCount) {
  const { width, height } = imageData;
  const avgColor = sampleBorderColor(imageData, 5);
  const background = floodFillBackgroundByColor(imageData, avgColor, tightness);
  const { mask: rawMask } = largestSilhouetteComponent(background, width, height);
  const smoothed = smoothMask(rawMask, width, height, 6);

  const smoothedBackground = new Uint8Array(width * height);
  for (let i = 0; i < smoothed.length; i++) smoothedBackground[i] = smoothed[i] ? 0 : 1;
  const { mask: finalMask, count } = largestSilhouetteComponent(smoothedBackground, width, height);

  const fraction = count / (width * height);
  if (fraction < 0.01 || fraction > 0.9) return null;

  const boundary = traceBoundary(finalMask, width, height);
  if (boundary.length < 4) return null;

  return simplifyToApproxCount(boundary, targetDotCount);
}

function renderFromMagnitude(threshold) {
  const bw = thresholdAndInvert(cachedMagnitude, threshold);
  const rendered = toImageData(bw, cachedWidth, cachedHeight);
  outputCanvas.width = cachedWidth;
  outputCanvas.height = cachedHeight;
  outputCanvas.getContext('2d').putImageData(rendered, 0, 0);
}

function recomputeFromBlur(gain, threshold) {
  const normalized = localContrastNormalize(cachedBlurred, cachedWidth, cachedHeight, 7, 128, 64, gain);
  cachedMagnitude = sobelMagnitude(normalized, cachedWidth, cachedHeight);
  renderFromMagnitude(threshold);
}

downloadButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `${currentFileName}-coloring-sheet.png`;
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
});

printButton.addEventListener('click', () => {
  window.print();
});

emailButton.addEventListener('click', async () => {
  clearError();
  clearSuccess();
  try {
    const blob = await new Promise((resolve) => originalCanvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Canvas could not be converted to an image.');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showSuccess('Photo copied to clipboard — paste it into the email (Ctrl+V)!');
  } catch (err) {
    showError('Could not copy the photo to your clipboard. You can still attach it manually.');
    console.error(err);
  }
  const subject = encodeURIComponent('Coloring Sheet Original Photo');
  const body = encodeURIComponent('Paste the photo below (Ctrl+V) before sending — it has been copied to your clipboard.');
  window.location.href = `mailto:varga.ferenc88@gmail.com?subject=${subject}&body=${body}`;
});

detailSlider.addEventListener('input', () => {
  const threshold = Number(detailSlider.value);
  detailValue.textContent = String(threshold);
  if (!cachedMagnitude) return;
  renderFromMagnitude(threshold);
});

sensitivitySlider.addEventListener('input', () => {
  const gain = Number(sensitivitySlider.value);
  sensitivityValue.textContent = String(gain);
  if (!cachedBlurred) return;
  clearTimeout(sensitivityDebounceTimer);
  sensitivityDebounceTimer = setTimeout(() => {
    recomputeFromBlur(gain, Number(detailSlider.value));
  }, 75);
});

resetButton.addEventListener('click', () => {
  if (!cachedBlurred) return;
  clearTimeout(sensitivityDebounceTimer);
  detailSlider.value = String(DEFAULT_THRESHOLD);
  detailValue.textContent = String(DEFAULT_THRESHOLD);
  sensitivitySlider.value = String(DEFAULT_GAIN);
  sensitivityValue.textContent = String(DEFAULT_GAIN);
  recomputeFromBlur(DEFAULT_GAIN, DEFAULT_THRESHOLD);
});
