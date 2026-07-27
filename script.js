const MAX_DIMENSION = 1600;

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const previewArea = document.getElementById('preview-area');
const originalCanvas = document.getElementById('original-canvas');
const outputCanvas = document.getElementById('output-canvas');
const downloadButton = document.getElementById('download-button');

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

  try {
    const img = await loadImageFromFile(file);
    drawImageToCanvas(img, originalCanvas, MAX_DIMENSION);
    previewArea.hidden = false;
  } catch (err) {
    showError('Something went wrong loading that image. Please try a different file.');
    console.error(err);
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

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
