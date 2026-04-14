import { settings } from './settings.js';
import { init, setDOMRefs, imgH, running } from './engine.js';
import { resetRemoveBgCache } from './controls.js';

// ══════════════════════════════════════════════
//  DOM SETUP
// ══════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const fileInput = document.getElementById('fileInput');
const panel = document.getElementById('panel');

// Pass DOM refs to engine
setDOMRefs(canvas, ctx, panel);

// ══════════════════════════════════════════════
//  IMAGE LOADING
// ══════════════════════════════════════════════
function handleImage(file) {
  resetRemoveBgCache();
  const r = new FileReader();
  r.onload = e => { const img = new Image(); img.onload = () => init(img); img.src = e.target.result; };
  r.readAsDataURL(file);
}
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleImage(e.target.files[0]); });
loader.addEventListener('dragover', e => e.preventDefault());
loader.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0]); });

// Also accept drops on canvas
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0]); });

// Auto-load
{ const img = new Image(); img.onload = () => init(img);
  img.onerror = () => { const i2 = new Image(); i2.onload = () => init(i2); i2.src = 'david.png'; };
  img.src = 'david.jpg'; }

// ══════════════════════════════════════════════
//  SCROLL ZOOM (pivot around mouse cursor)
// ══════════════════════════════════════════════
function getPanelOffset() {
  return panel.classList.contains('collapsed') ? 0 : 260;
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const oldZ = settings.zoom;
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZ = Math.min(8, Math.max(0.3, oldZ * factor));

  const mx = e.clientX;
  const my = e.clientY;

  const pw = getPanelOffset();
  const cw = canvas.width, ch = canvas.height;
  const pivotX = pw + (cw - pw) / 2;
  const pivotY = ch * 0.04 + (imgH || 0) / 2;

  settings.panX += (mx - pivotX - settings.panX) * (1 - newZ / oldZ);
  settings.panY += (my - pivotY - settings.panY) * (1 - newZ / oldZ);
  settings.zoom = newZ;
}, { passive: false });

// ══════════════════════════════════════════════
//  MOUSE DRAG TO PAN
// ══════════════════════════════════════════════
let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

canvas.addEventListener('mousedown', e => {
  isDragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  panStartX = settings.panX; panStartY = settings.panY;
  canvas.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  settings.panX = panStartX + (e.clientX - dragStartX);
  settings.panY = panStartY + (e.clientY - dragStartY);
});
window.addEventListener('mouseup', () => {
  isDragging = false;
  canvas.classList.remove('dragging');
});

// ══════════════════════════════════════════════
//  RESIZE
// ══════════════════════════════════════════════
window.addEventListener('resize', () => {
  if (!running) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
