// ══════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════
export const settings = {
  speedMult: 1.0,
  tintStrength: 0.45,
  colorPreset: 'ethereal',
  bgEnabled: true,
  bgMode: 'solid',       // solid | gradient | bw
  bgSolid: '#1e1e20',
  bgGradTop: '#1a0a1e',
  bgGradBot: '#0a1a1e',
  bgBw: '#000000',
  layeredMelt: false,
  meltOrigin: 35,      // % from top where melt boundary sits (0=top, 95=bottom)
  meltSpread: 40,      // % random variation around origin
  bandGap: 50,         // layered mode: gap between bands (0=simultaneous, 100=very staggered)
  stripWidth: 30,      // 0=fine(1-2px), 100=coarse(10-30px)
  direction: 'down',   // 'down' | 'up' | 'mixed'
  bounce: false,
  bounceRange: 50,     // 5-100%: how far pixels travel before bouncing back
  saturation: 100,     // 0-250, 100=normal
  contrast: 100,       // 0-250, 100=normal
  removeBg: false,          // manual trigger, default off
  zoom: 1.0,
  panX: 0, panY: 0,
};

// Snapshot of defaults for reset
export const DEFAULT_SETTINGS = JSON.parse(JSON.stringify(settings));

// ══════════════════════════════════════════════
//  COLOR PRESETS
// ══════════════════════════════════════════════
export const PRESETS = {
  ethereal: {
    label: 'ETHEREAL',
    preview: 'linear-gradient(180deg,#a0bee0,#d2a0b4,#e1b49b,#d7d291,#beafc8)',
    stops: [
      { p:0.0,  c:[160,190,220,0]  },
      { p:0.08, c:[160,190,220,15] },
      { p:0.18, c:[210,160,180,56] },
      { p:0.32, c:[225,180,155,71] },
      { p:0.45, c:[215,210,145,56] },
      { p:0.58, c:[190,175,200,41] },
      { p:0.72, c:[160,160,155,20] },
      { p:1.0,  c:[50,50,55,8]    },
    ],
    blobs: [
      { x:.3, y:.3, r:.22, c:[220,150,175,46] },
      { x:.65,y:.42,r:.18, c:[210,205,140,41] },
      { x:.4, y:.52,r:.25, c:[155,185,215,26] },
      { x:.7, y:.28,r:.16, c:[225,175,150,41] },
      { x:.2, y:.45,r:.20, c:[200,165,200,31] },
    ],
  },
  arctic: {
    label: 'ARCTIC',
    preview: 'linear-gradient(180deg,#4a90c8,#70b8d8,#a0dce8,#c8eaf0,#90b8d0)',
    stops: [
      { p:0.0,  c:[60,120,180,0]  },
      { p:0.1,  c:[70,140,200,20] },
      { p:0.25, c:[100,180,220,50] },
      { p:0.4,  c:[140,210,235,60] },
      { p:0.55, c:[160,220,240,45] },
      { p:0.7,  c:[120,190,215,30] },
      { p:0.85, c:[80,140,170,15] },
      { p:1.0,  c:[40,60,80,5]    },
    ],
    blobs: [
      { x:.35,y:.3, r:.25, c:[80,180,230,40] },
      { x:.6, y:.5, r:.20, c:[130,210,240,35] },
      { x:.25,y:.55,r:.18, c:[100,160,200,30] },
      { x:.7, y:.35,r:.15, c:[160,225,245,25] },
    ],
  },
  ember: {
    label: 'EMBER',
    preview: 'linear-gradient(180deg,#e85030,#e87830,#d84880,#c83060,#a02848)',
    stops: [
      { p:0.0,  c:[200,60,30,0]   },
      { p:0.1,  c:[220,80,40,20]  },
      { p:0.22, c:[235,120,50,55] },
      { p:0.38, c:[225,90,60,65]  },
      { p:0.52, c:[210,60,90,50]  },
      { p:0.66, c:[180,50,80,35]  },
      { p:0.8,  c:[140,40,60,18]  },
      { p:1.0,  c:[60,20,25,5]    },
    ],
    blobs: [
      { x:.4, y:.3, r:.22, c:[240,100,50,45] },
      { x:.6, y:.45,r:.20, c:[220,70,80,40] },
      { x:.3, y:.55,r:.18, c:[200,50,100,30] },
      { x:.7, y:.3, r:.15, c:[250,140,60,35] },
    ],
  },
  neon: {
    label: 'NEON',
    preview: 'linear-gradient(180deg,#e040e0,#40c0e0,#40e080,#e0e040,#e040a0)',
    stops: [
      { p:0.0,  c:[200,50,200,0]  },
      { p:0.1,  c:[220,60,210,20] },
      { p:0.22, c:[60,190,230,55] },
      { p:0.38, c:[60,225,130,60] },
      { p:0.52, c:[220,220,60,45] },
      { p:0.66, c:[225,60,160,40] },
      { p:0.8,  c:[160,60,200,20] },
      { p:1.0,  c:[40,20,50,5]    },
    ],
    blobs: [
      { x:.3, y:.3, r:.22, c:[230,60,220,45] },
      { x:.65,y:.4, r:.20, c:[60,200,240,40] },
      { x:.4, y:.55,r:.18, c:[60,240,120,35] },
      { x:.7, y:.55,r:.16, c:[240,240,60,30] },
    ],
  },
  sunset: {
    label: 'SUNSET',
    preview: 'linear-gradient(180deg,#ff7e5f,#feb47b,#ff6b81,#c56090,#8060a0)',
    stops: [
      { p:0.0,  c:[255,120,90,0]  },
      { p:0.1,  c:[255,130,95,18] },
      { p:0.22, c:[255,180,120,50]},
      { p:0.38, c:[255,160,100,60]},
      { p:0.52, c:[255,100,130,50]},
      { p:0.66, c:[200,95,145,38] },
      { p:0.8,  c:[130,95,160,20] },
      { p:1.0,  c:[50,30,55,5]    },
    ],
    blobs: [
      { x:.35,y:.3, r:.24, c:[255,160,110,42] },
      { x:.6, y:.45,r:.20, c:[255,110,130,38] },
      { x:.25,y:.5, r:.18, c:[200,100,150,30] },
      { x:.7, y:.3, r:.16, c:[255,190,130,35] },
    ],
  },
  void: {
    label: 'VOID',
    preview: 'linear-gradient(180deg,#333,#1a1a1a,#111)',
    stops: [],
    blobs: [],
  },
};
