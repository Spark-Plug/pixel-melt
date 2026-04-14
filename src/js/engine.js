import { settings, PRESETS } from './settings.js';

// ══════════════════════════════════════════════
//  PERFORMANCE CONSTANTS & LOOKUP TABLES
// ══════════════════════════════════════════════
const INV255 = 1 / 255;

// sqrt LUT for soft-light blending (0..255 → sqrt(x/255))
const sqrtLUT = new Float32Array(256);
for (let i = 0; i < 256; i++) sqrtLUT[i] = Math.sqrt(i * INV255);

// sin LUT for wave animation (4096 entries, covers 0..2π)
const SIN_LUT_SIZE = 4096;
const SIN_LUT = new Float32Array(SIN_LUT_SIZE);
const SIN_LUT_SCALE = SIN_LUT_SIZE / (Math.PI * 2);
for (let i = 0; i < SIN_LUT_SIZE; i++) SIN_LUT[i] = Math.sin(i / SIN_LUT_SCALE);

function fastSin(x) {
  const idx = ((x % (Math.PI * 2)) + Math.PI * 2) * SIN_LUT_SCALE;
  return SIN_LUT[idx & (SIN_LUT_SIZE - 1)];
}

// ══════════════════════════════════════════════
//  ENGINE STATE
// ══════════════════════════════════════════════
export let imgW, imgH, srcPixels;
let colTop, colBot, colLum;  // colLum: per-column average luminance 0~1
let meltStartY, meltDist, meltSpeed, meltMax, meltDelay, meltDir; // meltDir: +1=down, -1=up
export let running = false;
let accumTime = 0, lastFrameTime = 0;
let bufCanvas, bufCtx, bufH, bufYOff, bufImageData, bufClearArr;
let colorOvrPixels;
let cachedBgGradient = null;  // cached gradient to avoid per-frame recreation
let cachedBgKey = '';         // key to detect when gradient settings change
export let currentImg = null;    // possibly bg-removed version
export let originalImg = null;   // always the raw upload

// DOM refs set by main.js
let canvas, ctx, panel;

export function setDOMRefs(c, cx, p) {
  canvas = c; ctx = cx; panel = p;
}

export function getLastFrameTime() { return lastFrameTime; }
export function setLastFrameTime(t) { lastFrameTime = t; }

// ══════════════════════════════════════════════
//  BACKGROUND REMOVAL (AI-powered via @imgly/background-removal)
// ══════════════════════════════════════════════
let removeBgLib = null; // lazy-loaded

async function loadRemoveBgLib() {
  if (removeBgLib) return removeBgLib;
  // Dynamic import from CDN
  const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
  removeBgLib = mod;
  return mod;
}

// Remove background from an Image element, returns a new Image with transparent bg
export async function removeBackgroundAI(img) {
  const lib = await loadRemoveBgLib();
  // Convert img to blob
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));

  // Run AI removal
  const resultBlob = await lib.removeBackground(blob, {
    // Point to IMG.LY's data CDN so WASM and ONNX model files can be located
    // (dynamic import from jsDelivr can't resolve relative asset paths)
    publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.5.5/dist/',
    progress: (key, current, total) => {
      const el = document.getElementById('removeBgStatus');
      if (el) {
        if (current < total) {
          const pct = Math.round((current / total) * 100);
          el.textContent = `${key}... ${pct}%`;
        } else {
          el.textContent = 'PROCESSING...';
        }
      }
    }
  });

  // Convert result blob to Image
  const url = URL.createObjectURL(resultBlob);
  return new Promise((resolve, reject) => {
    const out = new Image();
    out.onload = () => { URL.revokeObjectURL(url); resolve(out); };
    out.onerror = reject;
    out.src = url;
  });
}

// ══════════════════════════════════════════════
//  IMAGE LOADING
// ══════════════════════════════════════════════
export async function init(img, isReprocess) {
  const loader = document.getElementById('loader');
  loader.classList.add('hidden');

  // Store original on first load (not when re-processing for bg removal)
  if (!isReprocess) originalImg = img;
  currentImg = img;

  const vw = window.innerWidth, vh = window.innerHeight;
  canvas.width = vw; canvas.height = vh;

  const drawH = Math.floor(vh * 0.88);
  const drawW = Math.floor(drawH * (img.width / img.height));
  imgW = drawW; imgH = drawH;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imgW; srcCanvas.height = imgH;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  srcCtx.drawImage(img, 0, 0, imgW, imgH);

  // Cool tint
  let imgData = srcCtx.getImageData(0,0,imgW,imgH);
  let px = imgData.data;
  for (let i=0;i<px.length;i+=4) {
    if (px[i+3]<15) continue;
    const lum=(px[i]*0.299+px[i+1]*0.587+px[i+2]*0.114)/255;
    px[i]=Math.min(255,Math.round(px[i]*0.82+lum*38));
    px[i+1]=Math.min(255,Math.round(px[i+1]*0.88+lum*28));
    px[i+2]=Math.min(255,Math.round(px[i+2]*0.85+lum*52));
  }
  srcCtx.putImageData(imgData,0,0);
  srcPixels = srcCtx.getImageData(0,0,imgW,imgH).data;

  // Buffer with room ABOVE (for UP float) and BELOW (for DOWN melt)
  bufYOff = Math.ceil(imgH * 1.0);
  bufH = bufYOff + Math.ceil(imgH * 2.2);
  bufCanvas = document.createElement('canvas');
  bufCanvas.width = imgW; bufCanvas.height = bufH;
  bufCtx = bufCanvas.getContext('2d', { willReadFrequently: true });
  bufImageData = bufCtx.createImageData(imgW, bufH);
  bufClearArr = new Uint32Array(bufImageData.data.buffer);

  // Column bounds
  colTop = new Int32Array(imgW);
  colBot = new Int32Array(imgW);
  for (let x=0;x<imgW;x++) {
    let top=-1, bot=-1;
    for (let y=0;y<imgH;y++) {
      if (srcPixels[(y*imgW+x)*4+3]>20) { if(top<0) top=y; bot=y; }
    }
    colTop[x]=top; colBot[x]=bot;
  }

  // Per-column average luminance (for layered melt)
  colLum = new Float32Array(imgW);
  for (let x=0;x<imgW;x++) {
    const top=colTop[x], bot=colBot[x];
    if (top<0) { colLum[x]=0; continue; }
    let lumSum=0, cnt2=0;
    for (let y=top;y<=bot;y++) {
      const si=(y*imgW+x)*4;
      if (srcPixels[si+3]<20) continue;
      lumSum += srcPixels[si]*0.299 + srcPixels[si+1]*0.587 + srcPixels[si+2]*0.114;
      cnt2++;
    }
    colLum[x] = cnt2>0 ? (lumSum/cnt2)/255 : 0;
  }

  buildColorOverlay();
  initMeltState();
  running = true;
  lastFrameTime = performance.now();
  requestAnimationFrame(animate);
}

// ══════════════════════════════════════════════
//  BUILD COLOR OVERLAY
// ══════════════════════════════════════════════
export function buildColorOverlay() {
  if (!imgW) return;
  const preset = PRESETS[settings.colorPreset];
  if (!preset || preset.stops.length === 0) {
    colorOvrPixels = new Uint8ClampedArray(imgW * bufH * 4);
    return;
  }

  const ovr = document.createElement('canvas');
  ovr.width = imgW; ovr.height = bufH;
  const oc = ovr.getContext('2d');

  const grd = oc.createLinearGradient(0,0,0,bufH);
  for (const s of preset.stops) {
    grd.addColorStop(s.p, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${(s.c[3]/255).toFixed(3)})`);
  }
  oc.fillStyle = grd;
  oc.fillRect(0,0,imgW,bufH);

  for (const b of (preset.blobs||[])) {
    const bx=imgW*b.x, by=bufH*b.y, br=bufH*b.r;
    const g2 = oc.createRadialGradient(bx,by,0,bx,by,br);
    g2.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${(b.c[3]/255).toFixed(3)})`);
    g2.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
    oc.fillStyle = g2;
    oc.fillRect(0,0,imgW,bufH);
  }

  colorOvrPixels = oc.getImageData(0,0,imgW,bufH).data;
}

// ══════════════════════════════════════════════
//  INIT MELT STATE
// ══════════════════════════════════════════════
export function initMeltState() {
  accumTime = 0;

  meltStartY = new Float32Array(imgW);
  meltDist   = new Float32Array(imgW);
  meltSpeed  = new Float32Array(imgW);
  meltMax    = new Float32Array(imgW);
  meltDelay  = new Float32Array(imgW);
  meltDir    = new Int8Array(imgW);

  const layered = settings.layeredMelt;
  const dir = settings.direction;

  const originPct = settings.meltOrigin / 100;
  const spreadPct = settings.meltSpread / 100;
  const spreadAmt = spreadPct * 0.35;

  let lumMin = 1, lumMax = 0;
  if (layered) {
    for (let x=0;x<imgW;x++) {
      if (colTop[x]<0) continue;
      if (colLum[x] < lumMin) lumMin = colLum[x];
      if (colLum[x] > lumMax) lumMax = colLum[x];
    }
    if (lumMax - lumMin < 0.01) { lumMin = 0; lumMax = 1; }
  }
  const lumRange = lumMax - lumMin;

  const NUM_BANDS = 5;
  const gapScale = settings.bandGap / 50;
  const BAND_BASE_DELAY = [100, 2200, 4500, 7000, 10000].map(d => d * gapScale);
  const BAND_DELAY_RAND = [400, 600, 700, 800, 600].map(d => d * gapScale);

  for (let x=0;x<imgW;x++) {
    const top=colTop[x], bot=colBot[x];
    if (top<0||bot-top<5) { meltDelay[x]=999999; continue; }
    const contentH=bot-top;

    if (dir === 'up') meltDir[x] = -1;
    else if (dir === 'down') meltDir[x] = 1;
    else meltDir[x] = Math.random() < 0.5 ? 1 : -1;

    const rand = (Math.random() * 2 - 1) * spreadAmt;
    const startRatio = Math.max(0.02, Math.min(0.95, originPct + rand));

    if (meltDir[x] === 1) {
      meltStartY[x] = top + contentH * startRatio;
      meltMax[x] = (bot - meltStartY[x]) * 1.5 + 60 + Math.random() * 250;
    } else {
      meltStartY[x] = top + contentH * (1 - startRatio);
      meltMax[x] = (meltStartY[x] - top) * 1.5 + 60 + Math.random() * 250;
    }

    meltSpeed[x] = 0.015 + Math.random() * 0.04;

    if (layered) {
      const normLum = (colLum[x] - lumMin) / lumRange;
      let band = Math.floor((1 - normLum) * NUM_BANDS);
      if (band >= NUM_BANDS) band = NUM_BANDS - 1;
      if (band < 0) band = 0;
      meltDelay[x] = BAND_BASE_DELAY[band] + Math.random() * BAND_DELAY_RAND[band];
      meltSpeed[x] = 0.025 + normLum * 0.025 + Math.random() * 0.02;
    } else {
      meltDelay[x] = 200 + Math.random() * 4000;
    }
  }

  // Column grouping (normal mode only)
  if (!layered) {
    for (let g=0;g<80;g++) {
      const start=Math.floor(Math.random()*imgW);
      const span=2+Math.floor(Math.random()*10);
      const gDelay=100+Math.random()*3500;
      const gSpeed=0.015+Math.random()*0.05;
      for (let j=start;j<Math.min(start+span,imgW);j++) {
        if (meltDelay[j]>=999990) continue;
        meltDelay[j]=gDelay; meltSpeed[j]=gSpeed;
      }
    }
  } else {
    const tmpDelay = new Float32Array(meltDelay);
    const tmpSpeed = new Float32Array(meltSpeed);
    for (let x=1;x<imgW-1;x++) {
      if (meltDelay[x]>=999990) continue;
      let dSum=0, sSum=0, cnt=0;
      for (let dx=-1;dx<=1;dx++) {
        const nx=x+dx;
        if (nx>=0&&nx<imgW&&meltDelay[nx]<999990) {
          dSum+=tmpDelay[nx]; sSum+=tmpSpeed[nx]; cnt++;
        }
      }
      if (cnt>0) {
        meltDelay[x] = meltDelay[x]*0.6 + (dSum/cnt)*0.4;
        meltSpeed[x] = meltSpeed[x]*0.6 + (sSum/cnt)*0.4;
      }
    }
  }

  // Strip width grouping
  const sw = settings.stripWidth / 100;
  if (sw > 0.01) {
    const peak = 1 + sw * 30;

    let cx = 0;
    while (cx < imgW) {
      const r1 = 1 + Math.random() * 34;
      const r2 = Math.max(1, peak + (Math.random()-0.5) * 12);
      const r3 = Math.max(1, peak + (Math.random()-0.5) * 12);
      const w = Math.round(Math.random() < 0.3 ? r1 : (r2 + r3) / 2);
      const clamped = Math.max(1, Math.min(35, w));
      const end = Math.min(cx + clamped, imgW);

      let ld = -1;
      for (let x = cx; x < end; x++) {
        if (meltDelay[x] < 999990) { ld = x; break; }
      }
      if (ld >= 0) {
        const ldStart = meltStartY[ld], ldSpd = meltSpeed[ld];
        const ldDel = meltDelay[ld], ldMax = meltMax[ld];
        const ldDir = meltDir[ld];
        for (let x = cx; x < end; x++) {
          if (meltDelay[x] >= 999990) continue;
          meltStartY[x] = ldStart;
          meltSpeed[x]  = ldSpd;
          meltDelay[x]  = ldDel;
          meltMax[x]    = ldMax;
          meltDir[x]    = ldDir;
        }
      }
      cx = end;
    }
  }
}

// ══════════════════════════════════════════════
//  ANIMATION
// ══════════════════════════════════════════════
function animate(time) {
  if (!running) return;
  requestAnimationFrame(animate);

  const dt = time - lastFrameTime;
  lastFrameTime = time;
  accumTime += dt * settings.speedMult;

  draw();
}

function getPanelOffset() {
  return panel.classList.contains('collapsed') ? 0 : 260;
}

export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

function draw() {
  const cw = canvas.width, ch = canvas.height;

  // Update melt distances
  const doBounce = settings.bounce;
  const bounceRangeMult = settings.bounceRange * 0.01; // hoist out of loop
  for (let x=0;x<imgW;x++) {
    if (meltDelay[x]>=999990||accumTime<meltDelay[x]) { meltDist[x]=0; continue; }
    const t=accumTime-meltDelay[x];
    const grow=meltSpeed[x]*t*0.008;
    const grav=0.000006*t*t*0.0003;
    const raw=grow+grav;
    const wave=fastSin(t*0.00025+x*0.08)*2.5;

    if (doBounce) {
      const mx = meltMax[x] * bounceRangeMult;
      const cycle = grow / (mx > 1 ? mx : 1);
      const phase = cycle % 2;
      const tri = phase < 1 ? phase : 2 - phase;
      const smooth = (fastSin((tri - 0.5) * Math.PI) + 1) * 0.5;
      meltDist[x] = Math.max(0, smooth * mx + wave);
    } else {
      meltDist[x]=Math.max(0, Math.min(raw, meltMax[x]) + wave);
    }
  }

  // Per-pixel buffer (reuse pre-allocated, fast zero)
  bufClearArr.fill(0);
  const dst = bufImageData.data;
  const src = srcPixels;
  const off = bufYOff;
  let dirtyMinY = bufH, dirtyMaxY = 0;

  for (let x=0;x<imgW;x++) {
    const top=colTop[x], bot=colBot[x];
    if (top<0) continue;
    const dist=meltDist[x], msY=meltStartY[x];
    const goUp = meltDir[x] < 0;

    if (dist<0.5) {
      const yMin=top+off, yMax=bot+off;
      if (yMin<dirtyMinY) dirtyMinY=yMin;
      if (yMax>dirtyMaxY) dirtyMaxY=yMax;
      for (let y=top;y<=bot;y++) {
        const si=(y*imgW+x)*4;
        if (src[si+3]<5) continue;
        const di=((y+off)*imgW+x)*4;
        dst[di]=src[si]; dst[di+1]=src[si+1]; dst[di+2]=src[si+2]; dst[di+3]=src[si+3];
      }
      continue;
    }

    if (!goUp) {
      // DOWN: stable above msY, displace below
      for (let y=top;y<=Math.min(Math.floor(msY),bot);y++) {
        const si=(y*imgW+x)*4;
        if (src[si+3]<5) continue;
        const di=((y+off)*imgW+x)*4;
        dst[di]=src[si]; dst[di+1]=src[si+1]; dst[di+2]=src[si+2]; dst[di+3]=src[si+3];
      }
      const meltTop=Math.max(Math.floor(msY),top), meltBot=bot;
      const meltRange=Math.max(1,meltBot-msY);
      let prevBY=-1, pR=0,pG=0,pB=0,pA=0;
      for (let srcY=meltTop;srcY<=meltBot;srcY++) {
        const si=(srcY*imgW+x)*4;
        const sR=src[si],sG=src[si+1],sB=src[si+2],sA=src[si+3];
        let t=(srcY-msY)/meltRange; if(t<0)t=0; if(t>1)t=1; t*=t;
        const by=srcY+off+Math.round(t*dist);
        if (by>=bufH) break;
        if (prevBY>=0&&by>prevBY+1) {
          const gap=by-prevBY;
          for (let gy=prevBY+1;gy<by&&gy<bufH;gy++) {
            const bl=(gy-prevBY)/gap, di=(gy*imgW+x)*4;
            dst[di]=Math.round(pR*(1-bl)+sR*bl); dst[di+1]=Math.round(pG*(1-bl)+sG*bl);
            dst[di+2]=Math.round(pB*(1-bl)+sB*bl); dst[di+3]=Math.round(pA*(1-bl)+sA*bl);
          }
        }
        if (by>=0&&by<bufH) { const di=(by*imgW+x)*4; dst[di]=sR; dst[di+1]=sG; dst[di+2]=sB; dst[di+3]=sA; }
        prevBY=by; pR=sR; pG=sG; pB=sB; pA=sA;
      }
      if (dist>5&&prevBY>=0) {
        const tl=Math.round(dist*1.5), segs=Math.min(tl,120);
        for (let s=1;s<=segs;s++) { const ty=prevBY+s; if(ty>=bufH)break; const fade=1-s/segs, a=fade*fade*0.35; if(a<0.004)break; const di=(ty*imgW+x)*4; if(dst[di+3]<Math.round(pA*a)){dst[di]=pR;dst[di+1]=pG;dst[di+2]=pB;dst[di+3]=Math.round(pA*a);} if(ty>dirtyMaxY)dirtyMaxY=ty; }
      }
      { const yMin=top+off; if(yMin<dirtyMinY)dirtyMinY=yMin; if(prevBY>dirtyMaxY)dirtyMaxY=prevBY; }
    } else {
      // UP: entire column floats
      const contentH2 = Math.max(1, bot - top);
      const normMsY = Math.max(0.1, (msY - top) / contentH2);
      const curvePow = 0.8 + normMsY * 2.2;

      let prevBY = -1, pR=0,pG=0,pB=0,pA=0;
      for (let srcY = bot; srcY >= top; srcY--) {
        const si=(srcY*imgW+x)*4;
        const sR=src[si],sG=src[si+1],sB=src[si+2],sA=src[si+3];
        let t = (bot - srcY) / contentH2;
        t = Math.pow(t, curvePow);
        const by = srcY + off - Math.round(t * dist);
        if (by < 0) break;

        if (prevBY>=0&&by<prevBY-1) {
          const gap=prevBY-by;
          for (let gy=prevBY-1;gy>by&&gy>=0;gy--) {
            const bl=(prevBY-gy)/gap, di=(gy*imgW+x)*4;
            dst[di]=Math.round(pR*(1-bl)+sR*bl); dst[di+1]=Math.round(pG*(1-bl)+sG*bl);
            dst[di+2]=Math.round(pB*(1-bl)+sB*bl); dst[di+3]=Math.round(pA*(1-bl)+sA*bl);
          }
        }
        if (by>=0&&by<bufH) { const di=(by*imgW+x)*4; dst[di]=sR; dst[di+1]=sG; dst[di+2]=sB; dst[di+3]=sA; }
        prevBY=by; pR=sR; pG=sG; pB=sB; pA=sA;
      }
      if (dist>5&&prevBY>=0) {
        const tl=Math.round(dist*1.5), segs=Math.min(tl,120);
        for (let s=1;s<=segs;s++) { const ty=prevBY-s; if(ty<0)break; const fade=1-s/segs, a=fade*fade*0.35; if(a<0.004)break; const di=(ty*imgW+x)*4; if(dst[di+3]<Math.round(pA*a)){dst[di]=pR;dst[di+1]=pG;dst[di+2]=pB;dst[di+3]=Math.round(pA*a);} if(ty<dirtyMinY)dirtyMinY=ty; }
      }
      { const yMax=bot+off; if(yMax>dirtyMaxY)dirtyMaxY=yMax; if(prevBY>=0&&prevBY<dirtyMinY)dirtyMinY=prevBY; }
    }
  }

  // Pixel-level color tint (only dirty rows)
  const cPx = colorOvrPixels;
  const tStr = settings.tintStrength;
  const dMinI = Math.max(0, dirtyMinY) * imgW * 4;
  const dMaxI = Math.min(bufH, dirtyMaxY + 1) * imgW * 4;
  if (cPx && tStr > 0.001) {
    for (let i=dMinI;i<dMaxI;i+=4) {
      if (dst[i+3]<8) continue;
      const cR=cPx[i],cG=cPx[i+1],cB=cPx[i+2],cA=cPx[i+3];
      if (cA<2) continue;

      const strength=(cA*INV255)*tStr;
      const bR=dst[i],bG=dst[i+1],bB=dst[i+2];
      let rR=bR+(cR-bR)*strength, rG=bG+(cG-bG)*strength, rB=bB+(cB-bB)*strength;

      const sl=0.35, sl1=0.65; // sl1 = 1 - sl, precomputed
      const nr=rR*INV255,ng=rG*INV255,nb=rB*INV255;
      const cr=cR*INV255,cg=cG*INV255,cb=cB*INV255;
      // Soft-light blend with sqrt LUT instead of Math.sqrt()
      const rri = Math.min(255, Math.max(0, rR + 0.5)) | 0;
      const rgi = Math.min(255, Math.max(0, rG + 0.5)) | 0;
      const rbi = Math.min(255, Math.max(0, rB + 0.5)) | 0;
      const slR=cr<=.5?nr-(1-2*cr)*nr*(1-nr):nr+(2*cr-1)*(sqrtLUT[rri]-nr);
      const slG=cg<=.5?ng-(1-2*cg)*ng*(1-ng):ng+(2*cg-1)*(sqrtLUT[rgi]-ng);
      const slB=cb<=.5?nb-(1-2*cb)*nb*(1-nb):nb+(2*cb-1)*(sqrtLUT[rbi]-nb);

      dst[i]=Math.min(255,Math.max(0,(rR*sl1+slR*255*sl+0.5)|0));
      dst[i+1]=Math.min(255,Math.max(0,(rG*sl1+slG*255*sl+0.5)|0));
      dst[i+2]=Math.min(255,Math.max(0,(rB*sl1+slB*255*sl+0.5)|0));
    }
  }

  // Saturation & Contrast (pixel-level)
  const sat = settings.saturation * 0.01;
  const con = settings.contrast * 0.01;
  const needsSat = Math.abs(sat - 1) > 0.01;
  const needsCon = Math.abs(con - 1) > 0.01;
  if (needsSat || needsCon) {
    for (let i=dMinI;i<dMaxI;i+=4) {
      if (dst[i+3]<8) continue;
      let r=dst[i], g=dst[i+1], b=dst[i+2];
      if (needsSat) {
        const gray = 0.299*r + 0.587*g + 0.114*b;
        r = gray + (r - gray) * sat;
        g = gray + (g - gray) * sat;
        b = gray + (b - gray) * sat;
      }
      if (needsCon) {
        r = 128 + (r - 128) * con;
        g = 128 + (g - 128) * con;
        b = 128 + (b - 128) * con;
      }
      dst[i]   = r < 0 ? 0 : r > 255 ? 255 : (r + 0.5) | 0;
      dst[i+1] = g < 0 ? 0 : g > 255 ? 255 : (g + 0.5) | 0;
      dst[i+2] = b < 0 ? 0 : b > 255 ? 255 : (b + 0.5) | 0;
    }
  }

  // Put the dirty region to the buffer canvas
  const dY0 = Math.max(0, dirtyMinY);
  const dY1 = Math.min(bufH, dirtyMaxY + 1);
  bufCtx.clearRect(0, 0, imgW, bufH);
  if (dY1 > dY0) bufCtx.putImageData(bufImageData, 0, 0, 0, dY0, imgW, dY1 - dY0);

  // Draw background (cache gradient to avoid per-frame recreation)
  const pw = getPanelOffset();
  if (settings.bgEnabled) {
    if (settings.bgMode === 'gradient') {
      const bgKey = `${ch}|${settings.bgGradTop}|${settings.bgGradBot}`;
      if (bgKey !== cachedBgKey) {
        cachedBgGradient = ctx.createLinearGradient(0,0,0,ch);
        cachedBgGradient.addColorStop(0, settings.bgGradTop);
        cachedBgGradient.addColorStop(1, settings.bgGradBot);
        cachedBgKey = bgKey;
      }
      ctx.fillStyle = cachedBgGradient;
    } else if (settings.bgMode === 'bw') {
      ctx.fillStyle = settings.bgBw;
    } else {
      ctx.fillStyle = settings.bgSolid;
    }
  } else {
    ctx.fillStyle = '#0a0a0c';
  }
  ctx.fillRect(0,0,cw,ch);

  // Draw melt with zoom & pan
  const imgDstX = pw + Math.floor((cw - pw - imgW) / 2);
  const imgDstY = Math.floor(ch * 0.04) - bufYOff;
  const baseX = pw + (cw - pw) / 2;
  const baseY = Math.floor(ch * 0.04) + imgH / 2;
  const z = settings.zoom;

  ctx.save();
  ctx.translate(baseX + settings.panX, baseY + settings.panY);
  ctx.scale(z, z);
  ctx.translate(-baseX, -baseY);
  ctx.drawImage(bufCanvas, 0, 0, imgW, bufH, imgDstX, imgDstY, imgW, bufH);
  ctx.restore();

  // Vignette
  const vig = ctx.createRadialGradient(cw/2,ch*0.35,ch*0.2,cw/2,ch*0.5,ch*0.85);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0,0,cw,ch);
}
