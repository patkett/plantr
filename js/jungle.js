// --- JUNGLE CURTAIN TRANSITION ---
// Monstera leaves swing in from both sides (each at its own speed) until the
// screen is covered, the callback swaps the screen underneath, then the
// leaves swing out again. Falls back to an instant swap while a transition
// is still running.

const JUNGLE_LEAF_COLORS = ['#4c8772', '#396c5b', '#2f574a', '#28473e', '#6ea38f', '#3f7a64'];
const JUNGLE_LEAVES_PER_SIDE = 7;
// Leaf motion (seconds). The JS timeline below is derived from these so the
// swap happens once the slowest leaf has arrived.
const JUNGLE_LEAF_DUR_MIN = 0.55;
const JUNGLE_LEAF_DUR_MAX = 1.05;
const JUNGLE_LEAF_DELAY_MAX = 0.25;
const JUNGLE_COVER_MS = Math.round((JUNGLE_LEAF_DUR_MAX + JUNGLE_LEAF_DELAY_MAX) * 1000); // 1300
const JUNGLE_HOLD_MS = 200;   // fully covered while the screen underneath is swapped
// Stylised monstera leaf (viewBox 0 0 200 300, midrib at x = 100). The right
// half is described once and mirrored for the left half.
const JUNGLE_HALF = [
  // [c1x,c1y, c2x,c2y, x,y]  — cubic segments from the top notch down to the tip
  [126, 0, 176, 4, 188, 44],      // top lobe
  [186, 66, 166, 78, 146, 80],    // cut in
  [178, 84, 200, 110, 196, 140],  // lobe 2
  [192, 158, 168, 162, 142, 156], // cut in
  [166, 162, 186, 190, 178, 220], // lobe 3
  [172, 236, 152, 236, 136, 228], // cut in
  [150, 238, 156, 262, 144, 278], // lobe 4
  [130, 292, 114, 300, 100, 300]  // tip
];
const JUNGLE_LEAF_PATH = (() => {
  let d = 'M100,26';
  JUNGLE_HALF.forEach(([a, b, c, e, x, y]) => { d += ` C${a},${b} ${c},${e} ${x},${y}`; });
  [...JUNGLE_HALF].reverse().forEach(([a, b, c, e], idx, arr) => {
    const prev = idx + 1 < arr.length ? arr[idx + 1] : null;
    const [x, y] = prev ? [prev[4], prev[5]] : [100, 26];
    d += ` C${200 - c},${e} ${200 - a},${b} ${200 - x},${y}`;
  });
  d += ' Z';
  // fenestrations (holes) along the midrib
  d += ' M100,78 C110,78 114,92 114,104 C114,116 108,126 100,126 C92,126 86,116 86,104 C86,92 90,78 100,78 Z';
  d += ' M118,160 C127,160 130,174 129,188 C128,200 122,206 116,205 C108,204 106,190 108,176 C109,166 112,160 118,160 Z';
  d += ' M82,196 C90,196 94,208 93,220 C92,230 87,236 81,235 C74,234 72,222 74,210 C75,201 77,196 82,196 Z';
  return d;
})();

let jungleRunning = false;
let jungleLeafSeq = 0;

function jungleLeafSvg(color) {
  const clipId = `jl-clip-${++jungleLeafSeq}`;
  return `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="${clipId}"><path d="${JUNGLE_LEAF_PATH}" clip-rule="evenodd"/></clipPath></defs>
    <path d="${JUNGLE_LEAF_PATH}" fill="${color}" fill-rule="evenodd"/>
    <g clip-path="url(#${clipId})" fill="none" stroke-linecap="round">
      <path d="M100,28 L100,298" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
      <path d="M100,50 L184,28 M100,112 L194,110 M100,180 L182,196 M100,240 L150,262 M100,50 L16,28 M100,112 L6,110 M100,180 L18,196 M100,240 L50,262" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
    </g>
  </svg>`;
}

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
      html += `<div class="jungle-leaf ${side}" style="top:${top}vh; ${side}:${inset}%; height:${size}vh; width:${size * 0.67}vh; --rot:${rot}deg; --rot-out:${rotOut}deg; transition-duration:${dur}s; transition-delay:${delay}s;">${jungleLeafSvg(color)}</div>`;
    }
  });
  curtain.innerHTML = html;
  document.body.appendChild(curtain);
  return curtain;
}

function jungleTransition(swapFn) {
  if (jungleRunning || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    swapFn();
    return;
  }
  const curtain = buildJungleCurtain();
  jungleRunning = true;
  curtain.classList.remove('hidden');
  // Force a layout so the transition starts from the "open" position
  void curtain.offsetWidth;
  curtain.classList.add('is-closed');
  setTimeout(() => {
    swapFn();
    setTimeout(() => {
      curtain.classList.remove('is-closed');
      setTimeout(() => {
        curtain.classList.add('hidden');
        jungleRunning = false;
      }, JUNGLE_COVER_MS);
    }, JUNGLE_HOLD_MS);
  }, JUNGLE_COVER_MS);
}
