// --- APP BOOTSTRAP ---

window.addEventListener('DOMContentLoaded', async () => {
  initSupabaseFromStorage();
  loadSqlScript();
  await fetchAllData();
  renderPlantList();
  renderMap();
  initMapInteractions();
  initPullToRefresh();
  lucide.createIcons();
  showUserSelect();
});

// --- PULL TO REFRESH (plant directory) ---
async function refreshData() {
  await fetchAllData();
  renderPlantList();
  renderMap();
  lucide.createIcons();
  showToast(isConnectedToSupabase ? "Aktualisiert" : "Aktualisiert (lokal)", "🔄");
}

function initPullToRefresh() {
  const scroller = document.getElementById('plant-list-scroll');
  const cards = document.getElementById('plant-cards-container');
  const indicator = document.getElementById('pull-indicator');
  const sprout = document.getElementById('pull-sprout');
  if (!scroller || !cards || !indicator || !sprout) return;
  const stem = document.getElementById('sprout-stem');
  const leafL = document.getElementById('sprout-leaf-l');
  const leafR = document.getElementById('sprout-leaf-r');
  const THRESHOLD = 80;   // px of list offset that triggers a refresh
  const MAX = 100;
  let startY = null, pulling = false, refreshing = false, offset = 0;

  // progress 0..1 drives the sprout: stem grows, leaves unfold
  const drawSprout = (p) => {
    const e = 1 - Math.pow(1 - p, 2);
    indicator.style.opacity = Math.min(1, p * 2.5);
    stem.style.transform = `scaleY(${0.15 + 0.85 * e})`;
    const leaf = Math.max(0, (e - 0.25) / 0.75);
    leafL.style.transform = `rotate(${(1 - leaf) * 70}deg) scale(${leaf})`;
    leafR.style.transform = `rotate(${-(1 - leaf) * 70}deg) scale(${leaf})`;
    sprout.classList.toggle('text-brand-600', p >= 1);
    sprout.classList.toggle('text-stone-500', p < 1);
  };

  const setOffset = (px, animate) => {
    offset = px;
    cards.style.transition = animate ? 'transform 250ms ease-out' : 'none';
    cards.style.transform = px ? `translateY(${px}px)` : '';
    drawSprout(Math.min(1, px / THRESHOLD));
  };

  scroller.addEventListener('touchstart', (e) => {
    if (refreshing || scroller.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    if (!pulling || startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || scroller.scrollTop > 0) { setOffset(0, false); return; }
    setOffset(Math.min(dy * 0.55, MAX), false);
  }, { passive: true });

  const end = async () => {
    if (!pulling) return;
    pulling = false;
    startY = null;
    if (offset >= THRESHOLD) {
      refreshing = true;
      setOffset(THRESHOLD * 0.8, true);
      drawSprout(1);
      sprout.classList.add('refreshing');
      try { await refreshData(); } finally {
        sprout.classList.remove('refreshing');
        setOffset(0, true);
        indicator.style.transition = 'opacity 200ms';
        indicator.style.opacity = 0;
        setTimeout(() => { indicator.style.transition = ''; }, 250);
        refreshing = false;
      }
    } else {
      setOffset(0, true);
      indicator.style.transition = 'opacity 200ms';
      indicator.style.opacity = 0;
      setTimeout(() => { indicator.style.transition = ''; }, 250);
    }
  };
  scroller.addEventListener('touchend', end);
  scroller.addEventListener('touchcancel', end);
}
