// --- USEFUL LINKS (bookmarks) ---
// Shared list of helpful URLs (plant databases, shops, articles). Stored in
// the Supabase table `links`, mirrored in LocalStorage and queued in the
// outbox like every other write.

function saveLinksLocal() {
  localStorage.setItem('verdant_links', JSON.stringify(links));
}

function linkPayload(link) {
  return { id: link.id, title: link.title || null, url: link.url, added_by: link.added_by || null };
}

async function syncSaveLink(link) {
  saveLinksLocal();
  await writeRemote({ op: 'upsert', table: 'links', id: link.id, payload: linkPayload(link) });
}

async function syncDeleteLink(linkId) {
  saveLinksLocal();
  await writeRemote({ op: 'delete', table: 'links', id: linkId });
}

// Accepts "naturadb.de/pflanzen" as well as full URLs; returns null if unusable.
function normalizeLinkUrl(raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch (e) {
    return null;
  }
}

function linkHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}

// Fallback title: last readable path segment ("luzula-sylvatica" → "Luzula sylvatica").
function linkTitleFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const last = parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
    const words = last.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_+]+/g, ' ').trim();
    if (!words) return linkHost(url);
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch (e) {
    return url;
  }
}

async function handleAddLink(e) {
  e.preventDefault();
  const urlInput = document.getElementById('link-input-url');
  const titleInput = document.getElementById('link-input-title');
  const url = normalizeLinkUrl(urlInput.value);
  if (!url) {
    showToast('Bitte eine gültige Web-Adresse eingeben', '⚠️');
    urlInput.focus();
    return;
  }
  const existing = links.find(l => l.url === url);
  if (existing) {
    showToast('Dieser Link ist schon gespeichert', 'ℹ️');
    return;
  }
  const link = {
    id: 'l_' + Date.now(),
    url,
    title: titleInput.value.trim() || linkTitleFromUrl(url),
    added_by: currentUser || null,
    created_at: new Date().toISOString()
  };
  links.unshift(link);
  urlInput.value = '';
  titleInput.value = '';
  renderLinks();
  await syncSaveLink(link);
  showToast('Link gespeichert', '🔖');
}

function deleteLink(linkId) {
  const link = links.find(l => l.id === linkId);
  if (!link) return;
  showConfirmDialog('Link löschen?', `„${link.title || linkHost(link.url)}“ wird aus den nützlichen Links entfernt.`, async () => {
    links = links.filter(l => l.id !== linkId);
    renderLinks();
    await syncDeleteLink(linkId);
  });
}

// Link currently in inline edit mode (null = none)
let editingLinkId = null;

function startEditLink(linkId) {
  editingLinkId = linkId;
  renderLinks();
  const input = document.getElementById('link-edit-title');
  if (input) input.focus();
}

function cancelEditLink() {
  editingLinkId = null;
  renderLinks();
}

async function saveEditLink(e, linkId) {
  e.preventDefault();
  const link = links.find(l => l.id === linkId);
  if (!link) return;
  const urlInput = document.getElementById('link-edit-url');
  const url = normalizeLinkUrl(urlInput.value);
  if (!url) {
    showToast('Bitte eine gültige Web-Adresse eingeben', '⚠️');
    urlInput.focus();
    return;
  }
  if (links.some(l => l.id !== linkId && l.url === url)) {
    showToast('Dieser Link ist schon gespeichert', 'ℹ️');
    return;
  }
  link.url = url;
  link.title = document.getElementById('link-edit-title').value.trim() || linkTitleFromUrl(url);
  editingLinkId = null;
  renderLinks();
  await syncSaveLink(link);
  showToast('Link aktualisiert', '🔖');
}

const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white';

function renderLinkEditor(link) {
  return `
    <form onsubmit="saveEditLink(event, '${link.id}')" class="bg-white rounded-2xl border border-brand-300 ring-2 ring-brand-100 shadow-xs p-3.5 space-y-2">
      <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500">Link bearbeiten</p>
      <input type="text" id="link-edit-title" value="${escapeHtml(link.title || '')}" placeholder="Titel" class="${INPUT_CLS}">
      <input type="text" id="link-edit-url" value="${escapeHtml(link.url)}" inputmode="url" autocomplete="off" autocapitalize="off" required placeholder="URL hier einfügen" class="${INPUT_CLS}">
      <div class="flex items-center justify-between gap-2 pt-1">
        <button type="button" onclick="deleteLink('${link.id}')" title="Link löschen" class="px-2.5 py-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
        <div class="flex items-center gap-2">
          <button type="button" onclick="cancelEditLink()" class="px-3 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl">Abbrechen</button>
          <button type="submit" class="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-sm">Speichern</button>
        </div>
      </div>
    </form>`;
}

function renderLinkCard(link) {
  return `
    <div class="bg-white rounded-2xl border border-stone-200 shadow-xs flex items-stretch overflow-hidden">
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="flex-1 min-w-0 flex items-center gap-3 p-3.5 active:bg-stone-50 transition-colors">
        <div class="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <i data-lucide="bookmark" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-stone-800 truncate">${escapeHtml(link.title || linkHost(link.url))}</p>
          <p class="text-xs text-stone-500 truncate">${escapeHtml(linkHost(link.url))}${link.added_by ? ` · ${escapeHtml(link.added_by)}` : ''}</p>
        </div>
      </a>
      <button onclick="startEditLink('${link.id}')" title="Link bearbeiten" class="px-3 text-stone-400 hover:text-brand-700 hover:bg-stone-100 border-l border-stone-100 transition-colors">
        <i data-lucide="pencil" class="w-4 h-4"></i>
      </button>
    </div>`;
}

function renderLinks() {
  const container = document.getElementById('links-list');
  const empty = document.getElementById('links-empty');
  if (!container) return;
  const sorted = [...links].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  if (editingLinkId && !links.some(l => l.id === editingLinkId)) editingLinkId = null;
  empty.classList.toggle('hidden', sorted.length > 0);
  container.innerHTML = sorted.map(link => link.id === editingLinkId ? renderLinkEditor(link) : renderLinkCard(link)).join('');
  lucide.createIcons();
}
