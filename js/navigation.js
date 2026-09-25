// --- TAB SWITCHER ---

function switchTab(tab) {
  activeTab = tab;
  const dirView = document.getElementById('view-directory');
  const mapView = document.getElementById('view-map');
  const dbView = document.getElementById('view-db');

  const navBtnDir = document.getElementById('nav-btn-directory');
  const navBtnMap = document.getElementById('nav-btn-map');
  const navBtnDb = document.getElementById('nav-btn-db');

  [dirView, mapView, dbView].forEach(v => v.classList.add('hidden'));

  navBtnDir.className = "flex flex-col items-center text-stone-400 hover:text-stone-600 transition-colors";
  navBtnMap.className = "flex flex-col items-center text-stone-400 hover:text-stone-600 transition-colors";
  navBtnDb.className = "flex flex-col items-center text-stone-400 hover:text-stone-600 transition-colors";

  if (tab === 'directory') {
    dirView.classList.remove('hidden');
    navBtnDir.className = "flex flex-col items-center text-brand-700 transition-colors";
  } else if (tab === 'map') {
    mapView.classList.remove('hidden');
    navBtnMap.className = "flex flex-col items-center text-brand-700 transition-colors";
    renderMap();
  } else if (tab === 'db') {
    dbView.classList.remove('hidden');
    navBtnDb.className = "flex flex-col items-center text-brand-700 transition-colors";
  }
}
