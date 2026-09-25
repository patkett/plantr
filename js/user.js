// --- CURRENT USER (no login, just "who is using the app right now") ---

const USERS = ['Patrick', 'Sandra'];
const USER_STORAGE_KEY = 'verdant_last_user';
const USER_IMAGE = 'img/gardeners.jpg';
// Face positions in the shared illustration (percentages of the image)
const USER_FACE_POS = { Patrick: '40% 39%', Sandra: '65% 42%' };
let currentUser = null;

function userInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function renderUserChip() {
  const chip = document.getElementById('btn-user-chip');
  if (!chip) return;
  if (currentUser) {
    chip.style.backgroundImage = `url(${USER_IMAGE})`;
    chip.style.backgroundSize = '400%';
    chip.style.backgroundPosition = USER_FACE_POS[currentUser];
    chip.querySelector('span').innerText = '';
  } else {
    chip.style.backgroundImage = '';
    chip.querySelector('span').innerText = '?';
  }
  chip.title = currentUser ? `Angemeldet als ${currentUser} – tippen zum Wechseln` : 'Nutzer wählen';
}

const DB_ADMIN_USER = 'Patrick';

function canOpenDbSettings() {
  return currentUser === DB_ADMIN_USER;
}

// The app icon keeps showing the connection dot for everyone,
// but only Patrick can open the Supabase settings page behind it.
function openDbSettings() {
  if (!canOpenDbSettings()) return;
  switchTab('db');
}

function setCurrentUser(name) {
  currentUser = name;
  localStorage.setItem(USER_STORAGE_KEY, name);
  renderUserChip();
  document.getElementById('user-select-overlay').classList.add('hidden');
  const btn = document.getElementById('btn-header-db-status');
  if (btn) {
    btn.title = canOpenDbSettings() ? 'Datenbank-Einstellungen' : 'Verdant';
    btn.classList.toggle('cursor-default', !canOpenDbSettings());
  }
  // Leave the settings page if the new user may not see it
  if (!canOpenDbSettings() && !document.getElementById('view-db').classList.contains('hidden')) switchTab('directory');
}

// Shown on every app start: the illustration is split into two tappable halves.
function showUserSelect() {
  const overlay = document.getElementById('user-select-overlay');
  const last = localStorage.getItem(USER_STORAGE_KEY);
  const container = document.getElementById('user-select-buttons');
  container.innerHTML = USERS.map(u => `
    <button onclick="setCurrentUser('${u}')" class="user-half group relative flex-1 flex items-end justify-center pb-5 transition-all active:scale-[0.98] ${u === last ? 'user-half-last' : ''}" aria-label="${u}">
      <span class="px-5 py-2 rounded-full bg-white/90 text-stone-900 font-bold text-base shadow-lg border-2 ${u === last ? 'border-brand-600' : 'border-transparent'} group-hover:border-brand-500 group-hover:scale-105 transition-all">${u}</span>
    </button>`).join('');
  overlay.classList.remove('hidden');
}
