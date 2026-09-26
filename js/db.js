// --- SUPABASE DATABASE CLIENT ENGINE ---
// Handles connecting to Supabase, falling back to LocalStorage, and
// syncing plant/garden-bed CRUD operations to whichever backend is active.

function initSupabaseFromStorage() {
  const url = localStorage.getItem('verdant_sb_url');
  const key = localStorage.getItem('verdant_sb_key');

  if (url && key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      document.getElementById('db-input-url').value = url;
      document.getElementById('db-input-key').value = key;
    } catch (e) {
      console.error("Supabase init error:", e);
      supabaseClient = null;
    }
  }
}

async function testSupabaseConnection() {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient.from('garden_beds').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.warn("Supabase connection check warning:", error);
    }
    return true;
  } catch (e) {
    return false;
  }
}

function updateDbStatusUI(connected) {
  isConnectedToSupabase = connected;
  const dot = document.getElementById('db-status-dot');
  const badge = document.getElementById('card-db-status-badge');
  const dotBase = "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-brand-900";
  const banner = document.getElementById('offline-banner');
  if (banner) {
    const pending = getOutbox().length;
    banner.classList.toggle('hidden', connected && pending === 0);
    const label = banner.querySelector('span');
    if (label) {
      label.innerText = !connected
        ? (pending > 0
            ? `Nur lokaler Speicher – ${pending} Änderung${pending === 1 ? '' : 'en'} ${pending === 1 ? 'wartet' : 'warten'} auf Sync`
            : 'Nur lokaler Speicher – Änderungen sind nur auf diesem Gerät sichtbar')
        : `${pending} Änderung${pending === 1 ? '' : 'en'} noch nicht synchronisiert`;
    }
  }

  if (connected) {
    dot.className = `${dotBase} bg-emerald-400 animate-pulse`;
    dot.title = "Supabase verbunden";
    badge.className = "px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-full";
    badge.innerText = "Cloud-Sync aktiv";
  } else {
    dot.className = `${dotBase} bg-amber-400`;
    dot.title = "Lokaler Modus";
    badge.className = "px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full";
    badge.innerText = "Nur lokaler Speicher";
  }
}

async function handleSaveDbSettings(e) {
  e.preventDefault();
  const url = document.getElementById('db-input-url').value.trim();
  const key = document.getElementById('db-input-key').value.trim();

  if (!url || !key) {
    showToast("Bitte URL und Anon Key eingeben", "⚠️");
    return;
  }

  localStorage.setItem('verdant_sb_url', url);
  localStorage.setItem('verdant_sb_key', key);

  initSupabaseFromStorage();
  const connected = await testSupabaseConnection();

  if (connected) {
    updateDbStatusUI(true);
    showToast("Mit Supabase verbunden!", "⚡");
    await fetchAllData();
    renderPlantList();
    renderMap();
  } else {
    updateDbStatusUI(false);
    showToast("Verbindung zu Supabase fehlgeschlagen. URL/Key prüfen oder SQL-Skript ausführen.", "❌");
  }
}

function disconnectSupabase() {
  localStorage.removeItem('verdant_sb_url');
  localStorage.removeItem('verdant_sb_key');
  supabaseClient = null;
  document.getElementById('db-input-url').value = '';
  document.getElementById('db-input-key').value = '';
  updateDbStatusUI(false);
  showToast("Von Supabase getrennt. Zurück zum lokalen Speicher.", "🔌");
  fetchAllData().then(() => {
    renderPlantList();
    renderMap();
  });
}

// --- DATA FETCHING & SYNC ---
async function fetchAllData() {
  let connected = false;
  if (supabaseClient) {
    // Push changes made while offline before pulling the shared state
    await flushOutbox();
    try {
      const { data: bedsData, error: bedsErr } = await supabaseClient.from('garden_beds').select('*');
      const { data: plantsData, error: plantsErr } = await supabaseClient.from('plants').select('*');

      if (!bedsErr && !plantsErr) {
        connected = true;
        zones = bedsData || [];
        plants = plantsData || [];
        // Photos still waiting in the outbox are not on the server yet
        const pendingIds = new Set(getOutbox().filter(i => i.table === 'photos' && i.op === 'upload').map(i => i.id));
        plants.forEach(p => { if (pendingIds.has(p.id)) p.photo_pending = true; });
      }
    } catch (e) {
      connected = false;
    }
  }

  updateDbStatusUI(connected);

  if (!connected) {
    // Fallback to LocalStorage
    const storedPlants = localStorage.getItem('verdant_plants');
    const storedZones = localStorage.getItem('verdant_zones');

    plants = storedPlants ? JSON.parse(storedPlants) : DEFAULT_PLANTS;
    zones = storedZones ? JSON.parse(storedZones) : DEFAULT_ZONES;

    const migrated = migrateLegacySeedData();
    if (!storedPlants || migrated) savePlantsLocal();
    if (!storedZones || migrated) saveZonesLocal();
  }

  plants.forEach(normalizePlant);
  await primePendingPhotoUrls();
}

// Earlier versions seeded LocalStorage with English sample records. Replace
// the display text of those untouched seed records with the current German
// defaults so returning visitors don't see a mixed-language UI.
const LEGACY_SEED_TEXT = {
  p1: { name: 'Lavender (Munstead)', notes: 'Needs plenty of direct sun and light watering. Great for pollinators.' },
  p2: { name: 'Japanese Forest Grass', notes: 'Flowing golden-green foliage. Beautiful in shady borders.' },
  p3: { name: 'Hostas (Empress Wu)', notes: 'Keep soil consistently damp. Watch for garden slugs.' },
  p4: { name: 'Sun Gold Cherry Tomato', notes: 'Plan for tomato cage support along south deck.' },
  z1: { name: 'South Sun Deck Bed' },
  z2: { name: 'Patio Partial Shade Border' },
  z3: { name: 'North Fence Shade Nook' }
};

function migrateLegacySeedData() {
  let changed = false;
  const apply = (record, defaults) => {
    const legacy = LEGACY_SEED_TEXT[record.id];
    const fresh = defaults.find(d => d.id === record.id);
    if (!legacy || !fresh) return;
    if (record.name === legacy.name) { record.name = fresh.name; changed = true; }
    if (legacy.notes !== undefined && record.notes === legacy.notes) { record.notes = fresh.notes; changed = true; }
  };
  plants.forEach(p => apply(p, DEFAULT_PLANTS));
  zones.forEach(z => apply(z, DEFAULT_ZONES));
  return changed;
}

function savePlantsLocal() {
  localStorage.setItem('verdant_plants', JSON.stringify(plants));
}

function saveZonesLocal() {
  localStorage.setItem('verdant_zones', JSON.stringify(zones));
}

// --- OFFLINE OUTBOX ---
// Writes that could not reach Supabase (no credentials yet, no network,
// request error) are queued in LocalStorage and replayed on the next
// successful connection. One entry per (table, id): the latest op wins.
const OUTBOX_KEY = 'verdant_outbox';

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch (e) { return []; }
}

function setOutbox(items) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

function enqueueOutbox(entry) {
  const items = getOutbox().filter(i => !(i.table === entry.table && i.id === entry.id));
  items.push({ ...entry, queued_at: new Date().toISOString() });
  setOutbox(items);
}

async function applyRemote(entry) {
  if (entry.table === 'photos') return applyPhotoOp(entry);
  if (entry.op === 'delete') return supabaseClient.from(entry.table).delete().eq('id', entry.id);
  return supabaseClient.from(entry.table).upsert(entry.payload);
}

// Photo ops: { table: 'photos', op: 'upload' | 'delete', id: plantId }.
// Upload reads the resized blobs from IndexedDB, pushes them to Storage and
// then writes the resulting URLs onto the plant row.
async function applyPhotoOp(entry) {
  try {
    if (entry.op === 'delete') {
      await deletePhotoRemote(entry.id);
      return { error: null };
    }
    const blobs = await getPendingPhoto(entry.id);
    if (!blobs) return { error: null }; // nothing left to upload
    const urls = await uploadPhoto(entry.id, blobs);
    const plant = plants.find(p => p.id === entry.id);
    if (plant) {
      Object.assign(plant, urls, { photo_pending: false });
      savePlantsLocal();
      const { error } = await supabaseClient.from('plants').upsert(plantPayload(plant));
      if (error) return { error };
    }
    await removePendingPhoto(entry.id);
    if (typeof renderPlantList === 'function') { renderPlantList(); renderMap(); }
    return { error: null };
  } catch (e) {
    return { error: e };
  }
}

let flushingOutbox = false;
async function flushOutbox() {
  if (flushingOutbox || !supabaseClient) return 0;
  const items = getOutbox();
  if (items.length === 0) return 0;
  flushingOutbox = true;
  let synced = 0;
  try {
    for (const entry of items) {
      try {
        const { error } = await applyRemote(entry);
        if (error) { console.error('Outbox sync error:', error); break; }
        synced++;
        setOutbox(getOutbox().filter(i => !(i.table === entry.table && i.id === entry.id)));
      } catch (e) {
        console.warn('Outbox sync aborted (offline?):', e);
        break;
      }
    }
  } finally {
    flushingOutbox = false;
  }
  if (synced > 0) showToast(`${synced} Änderung${synced === 1 ? '' : 'en'} nach Supabase synchronisiert`, '☁️');
  return synced;
}

// Try the write now; fall back to the outbox if Supabase isn't reachable.
async function writeRemote(entry) {
  if (isConnectedToSupabase && supabaseClient) {
    try {
      const { error } = await applyRemote(entry);
      if (!error) return true;
      console.error(`Supabase ${entry.op} error:`, error);
    } catch (e) {
      console.warn('Supabase write failed, queued:', e);
    }
  }
  enqueueOutbox(entry);
  updateDbStatusUI(isConnectedToSupabase);
  return false;
}

// --- DATABASE CRUD OPERATIONS FOR PLANTS AND BEDS ---
function plantPayload(plant) {
  return {
    id: plant.id,
    name: plant.name,
    botanical_name: plant.botanical_name,
    sunlight: plant.sunlight,
    water: plant.water,
    soil: plant.soil,
    category: plant.category,
    status: plant.status,
    notes: plant.notes,
    emoji: plant.emoji,
    bed_id: plant.bed_id,
    x_pos: plant.x_pos,
    y_pos: plant.y_pos,
    died_in_bed: plant.died_in_bed || null,
    died_bed_sunlight: plant.died_bed_sunlight || null,
    died_at: plant.died_at || null,
    placements: plant.placements || [],
    deaths: plant.deaths || [],
    wished_by: plant.wished_by || null,
    photo_url: plant.photo_url || null,
    thumb_url: plant.thumb_url || null
  };
}

function zonePayload(zone) {
  return {
    id: zone.id,
    name: zone.name,
    sunlight: zone.sunlight,
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height
  };
}

async function syncSavePlant(plant) {
  normalizePlant(plant);
  savePlantsLocal();
  await writeRemote({ op: 'upsert', table: 'plants', id: plant.id, payload: plantPayload(plant) });
}

async function syncDeletePlant(plantId, hadPhoto = true) {
  savePlantsLocal();
  await removePendingPhoto(plantId);
  await writeRemote({ op: 'delete', table: 'plants', id: plantId });
  if (hadPhoto) await syncDeletePhoto(plantId);
}

// Stores the resized photo locally and uploads it now or via the outbox.
async function syncSavePhoto(plant, blobs) {
  await storePendingPhoto(plant.id, blobs);
  plant.photo_pending = true;
  savePlantsLocal();
  // Drop a queued delete for the same plant: the new photo replaces it
  setOutbox(getOutbox().filter(i => !(i.table === 'photos' && i.id === plant.id)));
  await writeRemote({ op: 'upload', table: 'photos', id: plant.id });
}

async function syncDeletePhoto(plantId) {
  await removePendingPhoto(plantId);
  await writeRemote({ op: 'delete', table: 'photos', id: plantId });
}

async function syncSaveZone(zone) {
  saveZonesLocal();
  await writeRemote({ op: 'upsert', table: 'garden_beds', id: zone.id, payload: zonePayload(zone) });
}

async function syncDeleteZone(zoneId) {
  saveZonesLocal();
  await writeRemote({ op: 'delete', table: 'garden_beds', id: zoneId });
}

// --- SQL SCHEMA SCRIPT LOADING ---
// The Supabase setup SQL lives in its own file (sql/schema.sql) so it can be
// maintained independently of the app logic. We fetch it once on load and
// keep the text around so the "Copy SQL" button works even if the DOM node
// hasn't finished rendering.
let cachedSqlScript = '';

async function loadSqlScript() {
  const pre = document.getElementById('sql-script-text');
  try {
    const res = await fetch('sql/schema.sql');
    cachedSqlScript = await res.text();
  } catch (e) {
    console.error("Failed to load SQL schema script:", e);
    cachedSqlScript = pre ? pre.innerText.trim() : '';
    return;
  }
  if (pre) pre.innerText = cachedSqlScript;
}
