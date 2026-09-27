// --- TAB NAVIGATION ---
const NAV_ACTIVE = 'flex flex-col items-center text-brand-700 transition-colors';
const NAV_INACTIVE = 'flex flex-col items-center text-stone-400 hover:text-stone-600 transition-colors';
const TABS = ['directory', 'map', 'stats', 'links', 'db'];

function switchTab(tab) {
  activeTab = tab;
  TABS.forEach(name => {
    const view = document.getElementById(`view-${name}`);
    if (view) view.classList.toggle('hidden', name !== tab);
    const btn = document.getElementById(`nav-btn-${name}`);
    if (btn) btn.className = name === tab ? NAV_ACTIVE : NAV_INACTIVE;
  });
  if (tab === 'map') renderMap();
  if (tab === 'stats') renderStats();
  if (tab === 'links') renderLinks();
}
