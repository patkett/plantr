// --- CURRENT USER (no login, just "who is using the app right now") ---

const USERS = ['Sandra', 'Patrick'];
const USER_STORAGE_KEY = 'verdant_last_user';
let currentUser = null;

function userInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function renderUserChip() {
  const chip = document.getElementById('btn-user-chip');
  if (!chip) return;
  chip.querySelector('span').innerText = userInitial(currentUser);
  chip.title = currentUser ? `Angemeldet als ${currentUser} – tippen zum Wechseln` : 'Nutzer wählen';
}

function setCurrentUser(name) {
  currentUser = name;
  localStorage.setItem(USER_STORAGE_KEY, name);
  renderUserChip();
  document.getElementById('user-select-overlay').classList.add('hidden');
}

// Shown on every app start; the previously used name is highlighted.
function showUserSelect() {
  const overlay = document.getElementById('user-select-overlay');
  const last = localStorage.getItem(USER_STORAGE_KEY);
  const container = document.getElementById('user-select-buttons');
  container.innerHTML = USERS.map(u => `
    <button onclick="setCurrentUser('${u}')" class="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all active:scale-95 ${u === last ? 'border-brand-600 bg-brand-50' : 'border-stone-200 bg-white hover:border-brand-400'}">
      <span class="w-14 h-14 rounded-full ${u === 'Sandra' ? 'bg-rose-500' : 'bg-sky-600'} text-white text-2xl font-bold flex items-center justify-center">${userInitial(u)}</span>
      <span class="font-semibold text-stone-800">${u}</span>
    </button>`).join('');
  overlay.classList.remove('hidden');
}
