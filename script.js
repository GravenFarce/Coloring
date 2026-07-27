const MAX_DIMENSION = 1600;

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const previewArea = document.getElementById('preview-area');
const originalCanvas = document.getElementById('original-canvas');
const outputCanvas = document.getElementById('output-canvas');
const downloadButton = document.getElementById('download-button');

let currentFileName = 'coloring-sheet';
let processingToken = 0;

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

async function handleFile(file) {
  clearError();
  if (!validateImageFile(file)) {
    showError('Please upload an image file (PNG, JPEG, or WebP).');
    return;
  }

  const token = ++processingToken;

  currentFileName = file.name.replace(/\.[^/.]+$/, '');

  previewArea.hidden = true;
  downloadButton.hidden = true;
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

    const outputData = processImageData(imageData);
    outputCanvas.width = originalCanvas.width;
    outputCanvas.height = originalCanvas.height;
    outputCanvas.getContext('2d').putImageData(outputData, 0, 0);

    previewArea.hidden = false;
    downloadButton.hidden = false;
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

function processImageData(imageData, threshold = 210) {
  const { width, height } = imageData;
  const gray = toGrayscale(imageData);
  const blurred = boxBlur3x3(gray, width, height);
  const normalized = localContrastNormalize(blurred, width, height);
  const magnitude = sobelMagnitude(normalized, width, height);
  const bw = thresholdAndInvert(magnitude, threshold);
  return toImageData(bw, width, height);
}

downloadButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `${currentFileName}-coloring-sheet.png`;
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
});
