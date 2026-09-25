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
  const indicator = document.getElementById('pull-indicator');
  if (!scroller || !indicator) return;
  const THRESHOLD = 70;
  let startY = null, pulling = false, refreshing = false;

  scroller.addEventListener('touchstart', (e) => {
    if (refreshing || scroller.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
    indicator.style.transition = 'none';
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    if (!pulling || startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || scroller.scrollTop > 0) { indicator.style.height = '0px'; return; }
    const h = Math.min(dy * 0.5, THRESHOLD + 20);
    indicator.style.height = `${h}px`;
    const icon = indicator.firstElementChild;
    if (icon) icon.style.transform = `rotate(${h * 3}deg)`;
  }, { passive: true });

  const end = async () => {
    if (!pulling) return;
    pulling = false;
    indicator.style.transition = '';
    const h = parseFloat(indicator.style.height) || 0;
    if (h >= THRESHOLD) {
      refreshing = true;
      indicator.style.height = `${THRESHOLD}px`;
      const icon = indicator.firstElementChild;
      if (icon) icon.classList.add('animate-spin');
      try { await refreshData(); } finally {
        const iconAfter = indicator.firstElementChild;
        if (iconAfter) iconAfter.classList.remove('animate-spin');
        indicator.style.height = '0px';
        refreshing = false;
      }
    } else {
      indicator.style.height = '0px';
    }
    startY = null;
  };
  scroller.addEventListener('touchend', end);
  scroller.addEventListener('touchcancel', end);
}
