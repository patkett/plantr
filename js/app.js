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
  if (!scroller || !cards || !indicator) return;
  // lucide replaces the <i> with an <svg>, so resolve the icon lazily
  const icon = () => indicator.firstElementChild;
  const THRESHOLD = 80;   // px of list offset that triggers a refresh
  const MAX = 100;
  let startY = null, pulling = false, refreshing = false, offset = 0;

  // progress 0..1 drives the icon: fades in and rotates with the drag
  const drawIcon = (p) => {
    const el = icon(); if (!el) return;
    indicator.style.opacity = Math.min(1, p * 2.5);
    el.style.transform = `rotate(${p * 270}deg)`;
    el.classList.toggle('text-brand-600', p >= 1);
    el.classList.toggle('text-stone-500', p < 1);
  };

  const setOffset = (px, animate) => {
    offset = px;
    cards.style.transition = animate ? 'transform 250ms ease-out' : 'none';
    cards.style.transform = px ? `translateY(${px}px)` : '';
    drawIcon(Math.min(1, px / THRESHOLD));
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
      drawIcon(1);
      icon()?.classList.add('refreshing');
      try { await refreshData(); } finally {
        icon()?.classList.remove('refreshing');
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
