import { settings, DEFAULT_SETTINGS, PRESETS } from './settings.js';
import { init, initMeltState, buildColorOverlay, currentImg, originalImg, removeBackgroundAI, setLastFrameTime } from './engine.js';

// ══════════════════════════════════════════════
//  PANEL CONTROLS
// ══════════════════════════════════════════════

const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panelToggle');
const fileInput = document.getElementById('fileInput');

// ── Theme toggle ──
const themeBtn = document.getElementById('themeBtn');
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? 'RETRO' : 'MODERN';
  try { localStorage.setItem('pixelmelt-theme', theme); } catch(e) {}
}
const savedTheme = (() => { try { return localStorage.getItem('pixelmelt-theme'); } catch(e) { return null; } })();
if (savedTheme) applyTheme(savedTheme);

themeBtn.onclick = () => {
  const current = document.body.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'retro' : 'dark');
};

// Panel toggle
panelToggle.onclick = () => {
  panel.classList.toggle('collapsed');
  panelToggle.textContent = panel.classList.contains('collapsed') ? '▸' : '◂';
};

// Speed
const speedRange = document.getElementById('speedRange');
const speedVal = document.getElementById('speedVal');
speedRange.oninput = () => {
  settings.speedMult = parseFloat(speedRange.value);
  speedVal.textContent = settings.speedMult.toFixed(1) + '×';
};

// Direction
const dirSeg = document.getElementById('dirSeg');
dirSeg.querySelectorAll('.seg').forEach(btn => {
  btn.onclick = () => {
    dirSeg.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.direction = btn.dataset.dir;
    if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
  };
});

// Bounce
const bounceToggle = document.getElementById('bounceToggle');
const bounceLabel = document.getElementById('bounceLabel');
const bounceRangeWrap = document.getElementById('bounceRangeWrap');
const bounceRangeSlider = document.getElementById('bounceRangeSlider');
const bounceRangeVal = document.getElementById('bounceRangeVal');
bounceToggle.onclick = () => {
  settings.bounce = !settings.bounce;
  bounceToggle.classList.toggle('on', settings.bounce);
  bounceLabel.textContent = settings.bounce ? 'ON' : 'OFF';
  bounceRangeWrap.style.display = settings.bounce ? 'block' : 'none';
};
bounceRangeSlider.oninput = () => {
  settings.bounceRange = parseInt(bounceRangeSlider.value);
  bounceRangeVal.textContent = settings.bounceRange + '%';
};

// Layered melt
const layeredToggle = document.getElementById('layeredToggle');
const layeredLabel = document.getElementById('layeredLabel');
const layeredHint = document.getElementById('layeredHint');
const bandGapWrap = document.getElementById('bandGapWrap');
layeredToggle.onclick = () => {
  settings.layeredMelt = !settings.layeredMelt;
  layeredToggle.classList.toggle('on', settings.layeredMelt);
  layeredLabel.textContent = settings.layeredMelt ? 'ON' : 'OFF';
  layeredHint.style.display = settings.layeredMelt ? 'block' : 'none';
  bandGapWrap.style.display = settings.layeredMelt ? 'block' : 'none';
  if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
};

// Melt zone: Origin
const originRange = document.getElementById('originRange');
const originVal = document.getElementById('originVal');
originRange.oninput = () => {
  settings.meltOrigin = parseInt(originRange.value);
  originVal.textContent = settings.meltOrigin + '%';
  if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
};

// Melt zone: Spread
const spreadRange = document.getElementById('spreadRange');
const spreadVal = document.getElementById('spreadVal');
spreadRange.oninput = () => {
  settings.meltSpread = parseInt(spreadRange.value);
  spreadVal.textContent = settings.meltSpread + '%';
  if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
};

// Melt zone: Strip Width
const stripRange = document.getElementById('stripRange');
const stripVal = document.getElementById('stripVal');
stripRange.oninput = () => {
  settings.stripWidth = parseInt(stripRange.value);
  stripVal.textContent = settings.stripWidth + '%';
  if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
};

// Melt zone: Band Gap (layered only)
const bandGapRange = document.getElementById('bandGapRange');
const bandGapVal = document.getElementById('bandGapVal');
bandGapRange.oninput = () => {
  settings.bandGap = parseInt(bandGapRange.value);
  bandGapVal.textContent = settings.bandGap + '%';
  if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
};

// Tint strength
const tintRange = document.getElementById('tintRange');
const tintVal = document.getElementById('tintVal');
tintRange.oninput = () => {
  settings.tintStrength = parseInt(tintRange.value) / 100;
  tintVal.textContent = parseInt(tintRange.value) + '%';
};

// Presets
const presetGrid = document.getElementById('presetGrid');
for (const [key, preset] of Object.entries(PRESETS)) {
  const sw = document.createElement('div');
  sw.className = 'swatch' + (key === settings.colorPreset ? ' active' : '');
  sw.dataset.preset = key;
  sw.style.background = preset.preview;
  sw.innerHTML = `<div class="swatch-label">${preset.label}</div>`;
  sw.onclick = () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    settings.colorPreset = key;
    buildColorOverlay();
  };
  presetGrid.appendChild(sw);
}

// BG toggle
const bgToggle = document.getElementById('bgToggle');
const bgToggleLabel = document.getElementById('bgToggleLabel');
const bgOptions = document.getElementById('bgOptions');
bgToggle.onclick = () => {
  settings.bgEnabled = !settings.bgEnabled;
  bgToggle.classList.toggle('on', settings.bgEnabled);
  bgToggleLabel.textContent = settings.bgEnabled ? 'ON' : 'OFF';
  bgOptions.classList.toggle('visible', settings.bgEnabled);
};

// BG mode segmented control
const bgModeSeg = document.getElementById('bgModeSeg');
const bgSolidRow = document.getElementById('bgSolidRow');
const bgGradRow = document.getElementById('bgGradRow');
const bgBwRow = document.getElementById('bgBwRow');

bgModeSeg.querySelectorAll('.seg').forEach(btn => {
  btn.onclick = () => {
    bgModeSeg.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.bgMode = btn.dataset.mode;
    bgSolidRow.style.display = settings.bgMode === 'solid' ? 'flex' : 'none';
    bgGradRow.style.display = settings.bgMode === 'gradient' ? 'flex' : 'none';
    bgBwRow.style.display = settings.bgMode === 'bw' ? 'flex' : 'none';
  };
});

// BG color inputs
document.getElementById('bgColor1').oninput = e => settings.bgSolid = e.target.value;
document.getElementById('bgGradTop').oninput = e => settings.bgGradTop = e.target.value;
document.getElementById('bgGradBot').oninput = e => settings.bgGradBot = e.target.value;

// BW buttons
document.querySelectorAll('.bw-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.bw-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.bgBw = btn.dataset.bw;
  };
});

// Saturation
const satRange = document.getElementById('satRange');
const satVal = document.getElementById('satVal');
satRange.oninput = () => {
  settings.saturation = parseInt(satRange.value);
  satVal.textContent = settings.saturation + '%';
};

// Contrast
const conRange = document.getElementById('conRange');
const conVal = document.getElementById('conVal');
conRange.oninput = () => {
  settings.contrast = parseInt(conRange.value);
  conVal.textContent = settings.contrast + '%';
};

// Remove BG (AI-powered)
const removeBgToggle = document.getElementById('removeBgToggle');
const removeBgLabel = document.getElementById('removeBgLabel');
const removeBgStatus = document.getElementById('removeBgStatus');
let removeBgProcessing = false;
let removeBgCachedImg = null; // cache the AI result to avoid re-processing

// Called when a new image is uploaded to clear the cache
export function resetRemoveBgCache() {
  removeBgCachedImg = null;
  if (settings.removeBg) {
    settings.removeBg = false;
    removeBgToggle.classList.remove('on');
    removeBgLabel.textContent = 'OFF';
    removeBgStatus.style.display = 'none';
  }
}

removeBgToggle.onclick = async () => {
  if (removeBgProcessing) return;
  settings.removeBg = !settings.removeBg;
  removeBgToggle.classList.toggle('on', settings.removeBg);

  if (settings.removeBg && originalImg) {
    if (removeBgCachedImg) {
      // Use cached result
      removeBgLabel.textContent = 'ON';
      await init(removeBgCachedImg, true);
    } else {
      // Run AI removal
      removeBgProcessing = true;
      removeBgLabel.textContent = '';
      removeBgStatus.style.display = 'block';
      removeBgStatus.textContent = 'LOADING MODEL...';
      try {
        const result = await removeBackgroundAI(originalImg);
        removeBgCachedImg = result;
        removeBgStatus.textContent = 'DONE';
        setTimeout(() => { removeBgStatus.style.display = 'none'; }, 1000);
        removeBgLabel.textContent = 'ON';
        await init(result, true);
      } catch (e) {
        console.error('BG removal failed:', e);
        removeBgStatus.textContent = 'FAILED';
        setTimeout(() => { removeBgStatus.style.display = 'none'; }, 2000);
        settings.removeBg = false;
        removeBgToggle.classList.remove('on');
        removeBgLabel.textContent = 'OFF';
      }
      removeBgProcessing = false;
    }
  } else if (!settings.removeBg && originalImg) {
    // Restore original
    removeBgLabel.textContent = 'OFF';
    removeBgStatus.style.display = 'none';
    await init(originalImg, true);
  }
};

// Reset melt
document.getElementById('resetBtn').onclick = () => {
  if (!currentImg) return;
  initMeltState();
  setLastFrameTime(performance.now());
};

// Upload
document.getElementById('uploadBtn').onclick = () => fileInput.click();

// ── Sync UI to settings ──
function syncUIToSettings() {
  speedRange.value = settings.speedMult; speedVal.textContent = settings.speedMult.toFixed(1)+'×';
  originRange.value = settings.meltOrigin; originVal.textContent = settings.meltOrigin+'%';
  spreadRange.value = settings.meltSpread; spreadVal.textContent = settings.meltSpread+'%';
  stripRange.value = settings.stripWidth; stripVal.textContent = settings.stripWidth+'%';
  bandGapRange.value = settings.bandGap; bandGapVal.textContent = settings.bandGap+'%';
  tintRange.value = Math.round(settings.tintStrength*100); tintVal.textContent = Math.round(settings.tintStrength*100)+'%';
  satRange.value = settings.saturation; satVal.textContent = settings.saturation+'%';
  conRange.value = settings.contrast; conVal.textContent = settings.contrast+'%';

  dirSeg.querySelectorAll('.seg').forEach(b => {
    b.classList.toggle('active', b.dataset.dir === settings.direction);
  });

  bounceToggle.classList.toggle('on', settings.bounce);
  bounceLabel.textContent = settings.bounce ? 'ON' : 'OFF';
  bounceRangeWrap.style.display = settings.bounce ? 'block' : 'none';
  bounceRangeSlider.value = settings.bounceRange;
  bounceRangeVal.textContent = settings.bounceRange + '%';
  layeredToggle.classList.toggle('on', settings.layeredMelt);
  layeredLabel.textContent = settings.layeredMelt ? 'ON' : 'OFF';
  layeredHint.style.display = settings.layeredMelt ? 'block' : 'none';
  bandGapWrap.style.display = settings.layeredMelt ? 'block' : 'none';

  bgToggle.classList.toggle('on', settings.bgEnabled);
  bgToggleLabel.textContent = settings.bgEnabled ? 'ON' : 'OFF';
  bgOptions.classList.toggle('visible', settings.bgEnabled);

  bgModeSeg.querySelectorAll('.seg').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === settings.bgMode);
  });
  bgSolidRow.style.display = settings.bgMode === 'solid' ? 'flex' : 'none';
  bgGradRow.style.display = settings.bgMode === 'gradient' ? 'flex' : 'none';
  bgBwRow.style.display = settings.bgMode === 'bw' ? 'flex' : 'none';
  document.getElementById('bgColor1').value = settings.bgSolid;
  document.getElementById('bgGradTop').value = settings.bgGradTop;
  document.getElementById('bgGradBot').value = settings.bgGradBot;

  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.preset === settings.colorPreset);
  });

  // Remove BG
  removeBgToggle.classList.toggle('on', settings.removeBg);
  removeBgLabel.textContent = settings.removeBg ? 'ON' : 'OFF';
  removeBgStatus.style.display = 'none';
}

// Reset ALL to defaults
document.getElementById('defaultsBtn').onclick = () => {
  Object.assign(settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  syncUIToSettings();
  buildColorOverlay();
  if (currentImg) { initMeltState(); setLastFrameTime(performance.now()); }
};
