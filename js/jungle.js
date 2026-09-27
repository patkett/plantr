// --- JUNGLE CURTAIN TRANSITION ---
// Monstera leaves swing in from both sides (each at its own speed) until the
// screen is covered, the callback swaps the screen underneath, then the
// leaves swing out again. Falls back to an instant swap while a transition
// is still running.

// Ligne-claire look (matches the user-selection illustration): flat fills,
// uniform dark ink outlines, veins drawn as lines, no shading.
const JUNGLE_INK = '#173124';
const JUNGLE_LEAF_COLORS = ['#3b7a4b', '#4c8c55', '#5c9e5d', '#6faa62', '#8db96b', '#a6c47c', '#2f6a41', '#7fa85f'];
const JUNGLE_LEAVES_PER_SIDE = 9;
const JUNGLE_OUTLINE = 2.6;   // stroke widths in viewBox units (200 x 300)
const JUNGLE_VEIN = 1.5;
// Leaf motion (seconds). The JS timeline below is derived from these so the
// swap happens once the slowest leaf has arrived.
const JUNGLE_LEAF_DUR_MIN = 0.35;
const JUNGLE_LEAF_DUR_MAX = 0.67;
const JUNGLE_LEAF_DELAY_MAX = 0.16;
const JUNGLE_COVER_MS = Math.round((JUNGLE_LEAF_DUR_MAX + JUNGLE_LEAF_DELAY_MAX) * 1000); // 830

let jungleState = 'open'; // 'open' | 'closing' | 'closed' | 'opening'
let jungleLeafSeq = 0;

const jungleSvg = inner => `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" stroke="${JUNGLE_INK}" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
const jungleVeins = (d, clipId) => `<path d="${d}" fill="none" stroke-width="${JUNGLE_VEIN}"${clipId ? ` clip-path="url(#${clipId})"` : ''}/>`;

// --- Monstera: lobed outline with fenestrations; the right half is described
// once and mirrored (viewBox 0 0 200 300, midrib at x = 100).
const JUNGLE_HALF = [
  // [c1x,c1y, c2x,c2y, x,y]  — cubic segments from the top notch down to the tip
  [124, 8, 176, 18, 190, 58],     // top lobe
  [196, 74, 154, 70, 126, 74],    // deep slit back towards the midrib
  [152, 76, 202, 88, 194, 120],   // lobe 2
  [190, 138, 152, 128, 128, 128], // slit
  [152, 132, 198, 152, 186, 182], // lobe 3
  [180, 198, 150, 186, 126, 182], // slit
  [146, 188, 184, 214, 170, 238], // lobe 4
  [162, 252, 140, 242, 122, 234], // slit
  [138, 242, 160, 266, 144, 282], // lobe 5
  [134, 294, 114, 300, 100, 300]  // tip
];
const JUNGLE_MONSTERA_PATH = (() => {
  let d = 'M100,30';
  JUNGLE_HALF.forEach(([a, b, c, e, x, y]) => { d += ` C${a},${b} ${c},${e} ${x},${y}`; });
  [...JUNGLE_HALF].reverse().forEach(([a, b, c, e], idx, arr) => {
    const prev = idx + 1 < arr.length ? arr[idx + 1] : null;
    const [x, y] = prev ? [prev[4], prev[5]] : [100, 30];
    d += ` C${200 - c},${e} ${200 - a},${b} ${200 - x},${y}`;
  });
  d += ' Z';
  // fenestrations (holes) along the midrib
  d += ' M100,78 C110,78 114,92 114,104 C114,116 108,126 100,126 C92,126 86,116 86,104 C86,92 90,78 100,78 Z';
  d += ' M118,160 C127,160 130,174 129,188 C128,200 122,206 116,205 C108,204 106,190 108,176 C109,166 112,160 118,160 Z';
  d += ' M82,196 C90,196 94,208 93,220 C92,230 87,236 81,235 C74,234 72,222 74,210 C75,201 77,196 82,196 Z';
  d += ' M136,104 C142,104 145,112 144,120 C143,127 139,131 135,130 C130,129 129,120 130,113 C131,107 133,104 136,104 Z';
  d += ' M64,120 C70,120 73,128 72,136 C71,143 67,147 63,146 C58,145 57,136 58,129 C59,123 61,120 64,120 Z';
  return d;
})();

function monsteraLeafSvg(color) {
  const clipId = `jl-clip-${++jungleLeafSeq}`;
  return jungleSvg(`
    <defs><clipPath id="${clipId}"><path d="${JUNGLE_MONSTERA_PATH}" clip-rule="evenodd"/></clipPath></defs>
    <path d="${JUNGLE_MONSTERA_PATH}" fill="${color}" fill-rule="evenodd" stroke-width="${JUNGLE_OUTLINE}"/>
    ${jungleVeins('M100,44 L186,40 M100,100 L196,102 M100,158 L190,164 M100,214 L176,224 M100,262 L150,270 M100,44 L14,40 M100,100 L4,102 M100,158 L10,164 M100,214 L24,224 M100,262 L50,270', clipId)}
    <path d="M100,32 L100,298" fill="none" stroke-width="${JUNGLE_OUTLINE}"/>`);
}

// --- Pinnate palm frond: a rachis with slender pointed leaflets on both sides.
function palmFrondSvg(color) {
  let leaflets = '';
  const count = 11;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const y = 284 - t * 236;
    const len = 118 * (1 - 0.45 * t);
    const w = 6.5 * (1 - 0.3 * t);
    const ang = -36 - t * 34;
    [1, -1].forEach(side => {
      leaflets += `<g transform="translate(100,${y.toFixed(1)}) scale(${side},1) rotate(${ang.toFixed(1)})">
        <path d="M0,0 Q${(len * 0.45).toFixed(1)},${-w} ${len.toFixed(1)},0 Q${(len * 0.45).toFixed(1)},${w} 0,0 Z" fill="${color}" stroke-width="${JUNGLE_OUTLINE}"/>
        <path d="M4,0 L${(len - 8).toFixed(1)},0" fill="none" stroke-width="${JUNGLE_VEIN}"/>
      </g>`;
    });
  }
  return jungleSvg(`
    ${leaflets}
    <path d="M97,298 L100,34 L103,298 Z" fill="${color}" stroke-width="${JUNGLE_OUTLINE}"/>
    <path d="M100,50 Q92,20 100,4 Q108,20 100,50 Z" fill="${color}" stroke-width="${JUNGLE_OUTLINE}"/>`);
}

// --- Fan palm: narrow pleated segments radiating from one point.
function fanPalmSvg(color) {
  let segs = '';
  const count = 13;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ang = -82 + t * 164;
    const len = 240 - Math.abs(t - 0.5) * 80;
    const w = 7.5;
    segs += `<g transform="translate(100,272) rotate(${ang.toFixed(1)})">
      <path d="M0,0 L${-w},${(-len * 0.88).toFixed(1)} L0,${-len} L${w},${(-len * 0.88).toFixed(1)} Z" fill="${color}" stroke-width="${JUNGLE_OUTLINE}"/>
      <path d="M0,-14 L0,${(-len * 0.9).toFixed(1)}" fill="none" stroke-width="${JUNGLE_VEIN}"/>
    </g>`;
  }
  return jungleSvg(`
    ${segs}
    <path d="M97,300 L100,262 L103,300 Z" fill="${color}" stroke-width="${JUNGLE_OUTLINE}"/>`);
}

// --- Banana leaf: long blade with a thick midrib and parallel slanted veins.
const JUNGLE_BANANA_PATH = 'M100,8 C142,30 170,130 156,236 C146,290 112,300 100,300 C88,300 54,290 44,236 C30,130 58,30 100,8 Z';
function bananaLeafSvg(color) {
  const clipId = `jl-clip-${++jungleLeafSeq}`;
  let veins = '';
  for (let y = 36; y < 282; y += 16) veins += `M100,${y} L190,${y + 30} M100,${y} L10,${y + 30} `;
  return jungleSvg(`
    <defs><clipPath id="${clipId}"><path d="${JUNGLE_BANANA_PATH}"/></clipPath></defs>
    <path d="${JUNGLE_BANANA_PATH}" fill="${color}" stroke-width="${JUNGLE_OUTLINE}"/>
    ${jungleVeins(veins, clipId)}
    <path d="M100,12 L100,298" fill="none" stroke-width="${JUNGLE_OUTLINE + 1}"/>`);
}

const JUNGLE_LEAF_KINDS = [monsteraLeafSvg, monsteraLeafSvg, palmFrondSvg, fanPalmSvg, bananaLeafSvg];

function buildJungleCurtain() {
  let curtain = document.getElementById('jungle-curtain');
  if (curtain) return curtain;
  curtain = document.createElement('div');
  curtain.id = 'jungle-curtain';
  curtain.className = 'hidden';
  curtain.setAttribute('aria-hidden', 'true');
  let html = '<div class="jungle-panel left"></div><div class="jungle-panel right"></div>';
  ['left', 'right'].forEach(side => {
    for (let i = 0; i < JUNGLE_LEAVES_PER_SIDE; i++) {
      const size = 34 + Math.random() * 30;                 // vh
      const top = -12 + (i / (JUNGLE_LEAVES_PER_SIDE - 1)) * 92 + (Math.random() * 10 - 5);
      const inset = -6 + Math.random() * 18;                // % from the side edge
      const rot = (side === 'left' ? 1 : -1) * (20 + Math.random() * 50);
      const rotOut = rot + (side === 'left' ? -40 : 40);
      const dur = JUNGLE_LEAF_DUR_MIN + Math.random() * (JUNGLE_LEAF_DUR_MAX - JUNGLE_LEAF_DUR_MIN);
      const delay = Math.random() * JUNGLE_LEAF_DELAY_MAX;
      const color = JUNGLE_LEAF_COLORS[Math.floor(Math.random() * JUNGLE_LEAF_COLORS.length)];
      const leafSvg = JUNGLE_LEAF_KINDS[Math.floor(Math.random() * JUNGLE_LEAF_KINDS.length)];
      html += `<div class="jungle-leaf ${side}" style="top:${top}vh; ${side}:${inset}%; height:${size}vh; width:${size * 0.67}vh; --rot:${rot}deg; --rot-out:${rotOut}deg; transition-duration:${dur}s; transition-delay:${delay}s;">${leafSvg(color)}</div>`;
    }
  });
  curtain.innerHTML = html;
  document.body.appendChild(curtain);
  return curtain;
}

const jungleReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const jungleWait = ms => new Promise(r => setTimeout(r, ms));

// Closes the leaves over the screen and keeps them closed. Resolves once the
// slowest leaf has arrived. `instant` skips the animation (used on app start,
// where the curtain is already closed when the app becomes visible).
async function jungleClose({ instant = false } = {}) {
  if (jungleState !== 'open') return;
  const curtain = buildJungleCurtain();
  jungleState = 'closing';
  const quick = instant || jungleReducedMotion();
  curtain.classList.toggle('no-transition', quick);
  curtain.classList.remove('hidden');
  void curtain.offsetWidth; // start from the "open" position
  curtain.classList.add('is-closed');
  if (!quick) await jungleWait(JUNGLE_COVER_MS);
  curtain.classList.remove('no-transition');
  jungleState = 'closed';
}

// Swings the leaves away again and reveals the screen underneath.
async function jungleOpen() {
  if (jungleState !== 'closed') return;
  const curtain = buildJungleCurtain();
  jungleState = 'opening';
  curtain.classList.remove('is-closed');
  if (!jungleReducedMotion()) await jungleWait(JUNGLE_COVER_MS);
  curtain.classList.add('hidden');
  jungleState = 'open';
}
