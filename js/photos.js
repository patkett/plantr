// --- PLANT PHOTOS ---
// Client-side resizing, Supabase Storage upload and an IndexedDB store for
// photos taken while offline (replayed through the outbox in db.js).

const PHOTO_BUCKET = 'plant-photos';
const PHOTO_FULL_MAX = 1200;
const PHOTO_THUMB_SIZE = 160;
const PHOTO_MAX_INPUT_BYTES = 20 * 1024 * 1024;
const PHOTO_DB_NAME = 'saparadise_photos';
const PHOTO_DB_STORE = 'pending';

// --- IMAGE PROCESSING ---
async function loadImageSource(file) {
  if (window.createImageBitmap) {
    // Some engines never settle this promise; fall back to <img> after a while
    // (modern browsers apply EXIF orientation to <img> as well).
    try {
      const bmp = await Promise.race([
        createImageBitmap(file, { imageOrientation: 'from-image' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      if (bmp) return bmp;
    } catch (e) { /* fall through to <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('encode')), 'image/jpeg', quality);
  });
}

function drawScaled(source, sw, sh, dw, dh, sx = 0, sy = 0, cw = sw, ch = sh) {
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, dw, dh);
  return canvas;
}

// Returns { full, thumb } JPEG blobs, or throws with a German user message.
async function processImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
  if (file.size > PHOTO_MAX_INPUT_BYTES) throw new Error('Das Bild ist zu groß (max. 20 MB).');

  let src;
  try { src = await loadImageSource(file); } catch (e) { throw new Error('Das Bild konnte nicht gelesen werden.'); }
  const sw = src.width, sh = src.height;

  const scale = Math.min(1, PHOTO_FULL_MAX / Math.max(sw, sh));
  const fullCanvas = drawScaled(src, sw, sh, Math.round(sw * scale), Math.round(sh * scale));

  const side = Math.min(sw, sh);
  const thumbCanvas = drawScaled(src, sw, sh, PHOTO_THUMB_SIZE, PHOTO_THUMB_SIZE, (sw - side) / 2, (sh - side) / 2, side, side);

  const [full, thumb] = await Promise.all([canvasToBlob(fullCanvas, 0.82), canvasToBlob(thumbCanvas, 0.8)]);
  if (src.close) src.close();
  return { full, thumb };
}

// --- SUPABASE STORAGE ---
function photoPaths(plantId) {
  return { full: `full/${plantId}.jpg`, thumb: `thumb/${plantId}.jpg` };
}

async function uploadPhoto(plantId, blobs) {
  const paths = photoPaths(plantId);
  const storage = supabaseClient.storage.from(PHOTO_BUCKET);
  const opts = { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' };
  const [a, b] = await Promise.all([
    storage.upload(paths.full, blobs.full, opts),
    storage.upload(paths.thumb, blobs.thumb, opts)
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  const t = Date.now();
  return {
    photo_url: `${storage.getPublicUrl(paths.full).data.publicUrl}?t=${t}`,
    thumb_url: `${storage.getPublicUrl(paths.thumb).data.publicUrl}?t=${t}`
  };
}

async function deletePhotoRemote(plantId) {
  const paths = photoPaths(plantId);
  const { error } = await supabaseClient.storage.from(PHOTO_BUCKET).remove([paths.full, paths.thumb]);
  if (error) throw error;
}

// --- INDEXEDDB (photos waiting for upload) ---
function openPhotoDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('no indexeddb'));
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(PHOTO_DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function photoDbRequest(mode, fn) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_DB_STORE, mode);
    const req = fn(tx.objectStore(PHOTO_DB_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

const pendingPhotoUrls = {}; // plantId -> { thumb, full } blob: URLs

async function storePendingPhoto(plantId, blobs) {
  await photoDbRequest('readwrite', store => store.put(blobs, plantId));
  cachePendingUrls(plantId, blobs);
}

async function getPendingPhoto(plantId) {
  try { return await photoDbRequest('readonly', store => store.get(plantId)); } catch (e) { return null; }
}

async function removePendingPhoto(plantId) {
  try { await photoDbRequest('readwrite', store => store.delete(plantId)); } catch (e) { /* ignore */ }
  const urls = pendingPhotoUrls[plantId];
  if (urls) {
    URL.revokeObjectURL(urls.thumb);
    URL.revokeObjectURL(urls.full);
    delete pendingPhotoUrls[plantId];
  }
}

function cachePendingUrls(plantId, blobs) {
  const old = pendingPhotoUrls[plantId];
  if (old) { URL.revokeObjectURL(old.thumb); URL.revokeObjectURL(old.full); }
  pendingPhotoUrls[plantId] = { thumb: URL.createObjectURL(blobs.thumb), full: URL.createObjectURL(blobs.full) };
}

// Called after data load so pending photos render immediately.
async function primePendingPhotoUrls() {
  const pending = plants.filter(p => p.photo_pending && !pendingPhotoUrls[p.id]);
  for (const plant of pending) {
    const blobs = await getPendingPhoto(plant.id);
    if (blobs) cachePendingUrls(plant.id, blobs);
    else plant.photo_pending = false;
  }
}

// --- DISPLAY HELPERS ---
function plantThumbSrc(plant) {
  const pend = plant.photo_pending && pendingPhotoUrls[plant.id];
  if (pend) return pend.thumb;
  return plant.thumb_url || plant.photo_url || null;
}

function plantFullSrc(plant) {
  const pend = plant.photo_pending && pendingPhotoUrls[plant.id];
  if (pend) return pend.full;
  return plant.photo_url || plant.thumb_url || null;
}

function hasPhoto(plant) {
  return !!plantThumbSrc(plant);
}

// Lucide "leaf" as inline SVG so it survives re-renders without createIcons().
function leafSvg(cls = 'w-6 h-6') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls} text-brand-600 shrink-0"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
}

// Round avatar: photo thumbnail or leaf fallback. `extra` = additional classes.
function plantAvatarHtml(plant, sizeClass = 'w-12 h-12', extra = '', iconClass = 'w-6 h-6') {
  const src = plantThumbSrc(plant);
  const base = `${sizeClass} relative rounded-full overflow-hidden bg-stone-100 flex items-center justify-center border border-stone-200/60 shrink-0 ${extra}`;
  // The leaf sits behind the image; if the image fails to load it is removed and the leaf shows.
  const img = src ? `<img src="${src}" alt="${plant.name}" class="absolute inset-0 w-full h-full object-cover" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="${base}">${leafSvg(iconClass)}${img}</div>`;
}

// --- LIGHTBOX ---
function openPhotoLightbox(plantId) {
  const plant = plants.find(p => p.id === plantId);
  const src = plant && plantFullSrc(plant);
  if (!src) return;
  const box = document.getElementById('photo-lightbox');
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-caption').innerText = plant.name;
  box.classList.remove('hidden');
}

function closePhotoLightbox() {
  const box = document.getElementById('photo-lightbox');
  box.classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const box = document.getElementById('photo-lightbox');
    if (box && !box.classList.contains('hidden')) closePhotoLightbox();
  }
});
