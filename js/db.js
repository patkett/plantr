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
  if (banner) banner.classList.toggle('hidden', connected);

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
    try {
      const { data: bedsData, error: bedsErr } = await supabaseClient.from('garden_beds').select('*');
      const { data: plantsData, error: plantsErr } = await supabaseClient.from('plants').select('*');

      if (!bedsErr && !plantsErr) {
        connected = true;
        zones = bedsData || [];
        plants = plantsData || [];
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

// --- DATABASE CRUD OPERATIONS FOR PLANTS AND BEDS ---
async function syncSavePlant(plant) {
  normalizePlant(plant);
  if (isConnectedToSupabase && supabaseClient) {
    const payload = {
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
      wished_by: plant.wished_by || null
    };

    const { error } = await supabaseClient.from('plants').upsert(payload);
    if (error) console.error("Supabase plant save error:", error);
  }
  savePlantsLocal();
}

async function syncDeletePlant(plantId) {
  if (isConnectedToSupabase && supabaseClient) {
    const { error } = await supabaseClient.from('plants').delete().eq('id', plantId);
    if (error) console.error("Supabase plant delete error:", error);
  }
  savePlantsLocal();
}

async function syncSaveZone(zone) {
  if (isConnectedToSupabase && supabaseClient) {
    const payload = {
      id: zone.id,
      name: zone.name,
      sunlight: zone.sunlight,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height
    };

    const { error } = await supabaseClient.from('garden_beds').upsert(payload);
    if (error) console.error("Supabase zone save error:", error);
  }
  saveZonesLocal();
}

async function syncDeleteZone(zoneId) {
  if (isConnectedToSupabase && supabaseClient) {
    const { error } = await supabaseClient.from('garden_beds').delete().eq('id', zoneId);
    if (error) console.error("Supabase zone delete error:", error);
  }
  saveZonesLocal();
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
