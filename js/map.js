// Logical size of the garden canvas in px (must match #garden-canvas in index.html)
const MAP_W = 900;
const MAP_H = 1300;

// --- GARDEN CANVAS: BEDS, PLANT MARKERS, AND SUNLIGHT MISMATCH DETECTION ---

let mapZoom = 1;
const MAP_ZOOM_MIN = 0.5;
const MAP_ZOOM_MAX = 2.5;

let resizingZoneId = null;   // zone currently showing its resize handle
let editingZoneId = null;    // zone whose edit bar is open
let activeResizeZoneId = null; // zone actively being dragged/resized

function renderMap() {
  const zonesLayer = document.getElementById('zones-layer');
  const markersLayer = document.getElementById('markers-layer');

  // 1. Render Garden Beds
  zonesLayer.innerHTML = zones.map(zone => {
    let zoneClass = 'zone-pattern-sun';
    if (zone.sunlight === 'Partial Shade') zoneClass = 'zone-pattern-partial';
    if (zone.sunlight === 'Full Shade') zoneClass = 'zone-pattern-shade';

    const width = zone.width || zone.w || 300;
    const height = zone.height || zone.h || 200;

    return `
      <div id="zone-${zone.id}"
           style="left: ${zone.x}px; top: ${zone.y}px; width: ${width}px; height: ${height}px;"
           ${zone.id === resizingZoneId ? `onmousedown="startZoneMove(event, '${zone.id}')" ontouchstart="startZoneMove(event, '${zone.id}')"` : ''}
           class="absolute rounded-2xl ${zoneClass} p-3 flex flex-col justify-between ${zone.id === resizingZoneId ? 'zone-editing cursor-move ring-2 ring-brand-500 ring-offset-2 ring-offset-transparent shadow-lg' : 'transition-all'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-stone-700 bg-white/80 backdrop-blur px-2.5 py-1 rounded-lg shadow-xs border border-stone-200/60">
            ${zone.name}
          </span>
          <button onclick="openZoneBar(event, '${zone.id}')" title="Beet bearbeiten" class="p-2 bg-white/90 rounded-lg ${zone.id === editingZoneId ? 'text-brand-700 ring-2 ring-brand-500' : 'text-stone-600'} hover:text-brand-700 shadow-sm border border-stone-200/60 active:scale-95">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="text-[10px] text-stone-500 font-semibold uppercase tracking-wider bg-white/70 w-max px-2 py-0.5 rounded">
          ${sunLabel(zone.sunlight)}
        </div>
        ${zone.id === resizingZoneId ? `
          <div class="zone-resize-handle absolute bottom-1.5 right-1.5 w-9 h-9 bg-brand-700 rounded-lg shadow-md cursor-se-resize flex items-center justify-center z-40"
               onmousedown="startZoneResize(event, '${zone.id}')"
               ontouchstart="startZoneResize(event, '${zone.id}')"
               title="Ziehen zum Ändern der Größe">
            <i data-lucide="move" class="w-3.5 h-3.5 text-white pointer-events-none"></i>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // 2. Render Plant Markers on Canvas
  const markers = [];
  plants.forEach(plant => (plant.placements || []).forEach(pl => markers.push({ plant, pl })));
  markersLayer.innerHTML = markers.map(({ plant, pl }) => {
    const isSelected = pl.id === selectedPlacementId;
    const bed = zones.find(z => z.id === pl.bed_id);
    const hasSunMismatch = bed && bed.sunlight !== plant.sunlight;

    return `
      <div id="marker-${pl.id}"
           data-plant-id="${plant.id}"
           data-placement-id="${pl.id}"
           style="left: ${pl.x}px; top: ${pl.y}px;"
           onmousedown="startMarkerDrag(event, '${pl.id}')"
           ontouchstart="startMarkerDrag(event, '${pl.id}')"
           onclick="togglePlantMarker(event, '${pl.id}')"
           class="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 group pointer-events-auto">

        <div class="relative flex flex-col items-center">
          ${hasSunMismatch ? `
            <div class="absolute -top-2 -right-1 z-30 bg-amber-500 text-white rounded-full p-0.5 shadow-sm border border-white" title="Lichtkonflikt! Das Beet hat ${t(bed.sunlight)}, die Pflanze bevorzugt aber ${t(plant.sunlight)}">
              <i data-lucide="alert-triangle" class="w-3 h-3"></i>
            </div>
          ` : ''}

          <div class="w-10 h-10 rounded-2xl bg-white shadow-md border-2 ${isSelected ? 'border-brand-600 marker-active' : (hasSunMismatch ? 'border-amber-400' : 'border-stone-300')} flex items-center justify-center text-xl transition-transform transform group-hover:scale-110">
            ${plant.emoji || '🪴'}
          </div>
          <span class="mt-1 px-2 py-0.5 bg-stone-900/80 text-white text-[10px] font-medium rounded-full shadow-md whitespace-nowrap pointer-events-none">
            ${plant.name}
          </span>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// --- COORDINATE HELPER (accounts for the canvas zoom level) ---
function getCanvasPoint(clientX, clientY) {
  const canvas = document.getElementById('garden-canvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / mapZoom,
    y: (clientY - rect.top) / mapZoom
  };
}

// --- DRAG & DROP MARKER LOGIC ---
let draggingPlacementId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startMarkerDrag(e, placementId) {
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();

  const found = findPlacement(placementId);
  if (!found) return;

  draggingPlacementId = placementId;
  selectedPlacementId = placementId;
  closeZoneBar(false);
  showSelectedBar(placementId);

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const point = getCanvasPoint(clientX, clientY);
  dragOffsetX = point.x - found.placement.x;
  dragOffsetY = point.y - found.placement.y;

  window.addEventListener('mousemove', onMarkerDrag);
  window.addEventListener('touchmove', onMarkerDrag, { passive: false });
  window.addEventListener('mouseup', stopMarkerDrag);
  window.addEventListener('touchend', stopMarkerDrag);
}

function onMarkerDrag(e) {
  if (!draggingPlacementId) return;
  if (e.cancelable) e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const point = getCanvasPoint(clientX, clientY);
  let newX = Math.round(point.x - dragOffsetX);
  let newY = Math.round(point.y - dragOffsetY);

  newX = Math.max(20, Math.min(880, newX));
  newY = Math.max(20, Math.min(630, newY));

  const found = findPlacement(draggingPlacementId);
  if (found) {
    found.placement.x = newX;
    found.placement.y = newY;
    found.placement.bed_id = bedIdAt(newX, newY); // auto detect bed underneath
    syncLegacyPosition(found.plant);

    const markerEl = document.getElementById(`marker-${found.placement.id}`);
    if (markerEl) {
      markerEl.style.left = `${newX}px`;
      markerEl.style.top = `${newY}px`;
    }
  }
}

async function stopMarkerDrag() {
  if (draggingPlacementId) {
    const released = draggingPlacementId;
    draggingPlacementId = null;
    // Refresh bed / light-conflict info immediately on release, before the (async) save
    if (selectedPlacementId === released) showSelectedBar(released);
    const found = findPlacement(released);
    if (found) await syncSavePlant(found.plant);
  }
  window.removeEventListener('mousemove', onMarkerDrag);
  window.removeEventListener('touchmove', onMarkerDrag);
  window.removeEventListener('mouseup', stopMarkerDrag);
  window.removeEventListener('touchend', stopMarkerDrag);
  renderMap();
}

function selectPlantMarker(placementId) {
  closeZoneBar(false);
  selectedPlacementId = placementId;
  showSelectedBar(placementId);
  renderMap();
}

// Tapping the already-selected marker deselects it
function togglePlantMarker(e, placementId) {
  if (e) e.stopPropagation();
  if (selectedPlacementId === placementId) {
    closeSelectedBar();
  } else {
    selectPlantMarker(placementId);
  }
}

function showSelectedBar(placementId) {
  const found = findPlacement(placementId);
  if (!found) return;
  const { plant, placement } = found;

  const bar = document.getElementById('map-selected-bar');
  document.getElementById('selected-item-icon').innerText = plant.emoji || '🪴';
  const total = placementCount(plant);
  document.getElementById('selected-item-title').innerText = total > 1 ? `${plant.name} (${total}×)` : plant.name;

  const zone = zones.find(z => z.id === placement.bed_id);
  const zoneText = zone ? zone.name : 'Kein Beet zugewiesen';

  document.getElementById('selected-item-subtitle').innerText = `${zoneText} • ${sunLabel(plant.sunlight)}`;

  // Light conflict gets its own line so it is never truncated
  const conflictEl = document.getElementById('selected-item-conflict');
  const isMismatch = zone && zone.sunlight !== plant.sunlight;
  conflictEl.innerText = isMismatch ? `⚠️ Lichtkonflikt: Beet hat ${t(zone.sunlight)}, Pflanze braucht ${t(plant.sunlight)}` : '';
  conflictEl.classList.toggle('hidden', !isMismatch);

  const unmapBtn = document.getElementById('btn-unmap-item');
  unmapBtn.onclick = () => unmapPlacement(placementId);
  const deceasedBtn = document.getElementById('btn-deceased-item');
  if (deceasedBtn) deceasedBtn.onclick = () => confirmMarkPlacementDeceased(placementId);

  bar.classList.remove('hidden');
}

function closeSelectedBar() {
  document.getElementById('map-selected-bar').classList.add('hidden');
  selectedPlacementId = null;
  renderMap();
}

// Removes a single specimen from the map
async function unmapPlacement(placementId) {
  const found = findPlacement(placementId);
  if (!found) return;
  removePlacementFromPlant(found.plant, placementId);
  await syncSavePlant(found.plant);
  closeSelectedBar();
  renderMap();
  renderPlantList();
  showToast(`${found.plant.name} von der Karte entfernt`, '📍');
}

// From the directory: show the first specimen on the map, or place one if none exists.
function jumpToMapWithPlant(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (!plant) return;
  if (!isPlaceable(plant)) return;
  switchTab('map');
  if (placementCount(plant) === 0) {
    const promoted = promoteToGarden(plant);
    addPlacement(plant);
    syncSavePlant(plant);
    renderPlantList();
    if (promoted) showToast(`${plant.name} ist jetzt im Garten (von der Wunschliste)`, '🌱');
  }
  selectPlantMarker(plant.placements[0].id);
}

// --- ZONE / BED MODAL HANDLERS ---
function openZoneModal() {
  document.getElementById('modal-zone-form').classList.remove('hidden');
}

function closeZoneModal() {
  document.getElementById('modal-zone-form').classList.add('hidden');
}

async function handleZoneFormSubmit(e) {
  e.preventDefault();

  const newZone = {
    id: 'z_' + Date.now(),
    name: document.getElementById('zone-name').value,
    sunlight: document.getElementById('zone-light').value,
    x: 100 + (zones.length * 40) % 400,
    y: 100 + (zones.length * 40) % 300,
    width: 300,
    height: 200
  };

  zones.push(newZone);
  await syncSaveZone(newZone);
  renderMap();
  closeZoneModal();
  document.getElementById('zone-form').reset();
  showToast(`Beet "${newZone.name}" erstellt`, '🏡');
}

// --- BED EDIT BAR (dark panel at the bottom, like the plant bar) ---
function openZoneBar(e, zoneId) {
  if (e) e.stopPropagation();
  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return;

  // Deselect any selected plant first
  if (selectedPlacementId) {
    selectedPlacementId = null;
    document.getElementById('map-selected-bar').classList.add('hidden');
  }
  resizingZoneId = null;
  editingZoneId = zoneId;

  const count = placementsInBed(zoneId).length;
  document.getElementById('zone-bar-subtitle').innerText =
    `${zone.name} • ${count} Pflanze${count === 1 ? '' : 'n'} in diesem Beet`;

  const nameInput = document.getElementById('zone-bar-name');
  const lightSelect = document.getElementById('zone-bar-light');
  nameInput.value = zone.name;
  lightSelect.value = zone.sunlight;
  nameInput.onchange = () => saveZoneBarChanges();
  lightSelect.onchange = () => saveZoneBarChanges();

  document.getElementById('btn-zone-resize').onclick = (ev) => startZoneResizeMode(ev, zoneId);
  document.getElementById('btn-zone-delete').onclick = (ev) => confirmDeleteZone(ev, zoneId);

  document.getElementById('map-zone-bar').classList.remove('hidden');
  renderMap();
}

async function saveZoneBarChanges() {
  const zone = zones.find(z => z.id === editingZoneId);
  if (!zone) return;
  const name = document.getElementById('zone-bar-name').value.trim();
  const sunlight = document.getElementById('zone-bar-light').value;
  if (name) zone.name = name;
  zone.sunlight = sunlight;
  await syncSaveZone(zone);
  const count = placementsInBed(zone.id).length;
  document.getElementById('zone-bar-subtitle').innerText =
    `${zone.name} • ${count} Pflanze${count === 1 ? '' : 'n'} in diesem Beet`;
  renderMap();
  renderPlantList();
}

function closeZoneBar(rerender = true) {
  const bar = document.getElementById('map-zone-bar');
  if (bar) bar.classList.add('hidden');
  editingZoneId = null;
  if (rerender) renderMap();
}

// Kept for backwards compatibility with older markup
function closeAllZoneMenus() {}

function startZoneResizeMode(e, zoneId) {
  if (e) e.stopPropagation();
  closeZoneBar(false); // give the map maximum space while resizing
  resizingZoneId = zoneId;
  renderMap();
  showToast('Beet ziehen zum Verschieben, Ecke unten rechts zum Skalieren', '📐');
}

// --- BED MOVE DRAG LOGIC (whole bed incl. its plants, only in edit mode) ---
let movingZoneId = null;
let moveStartX = 0, moveStartY = 0;
let moveZoneStartX = 0, moveZoneStartY = 0;
let movePlantStarts = [];

function startZoneMove(e, zoneId) {
  if (e.target.closest('.zone-resize-handle') || e.target.closest('button')) return;
  if (e.touches && e.touches.length > 1) return;
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();

  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const point = getCanvasPoint(clientX, clientY);

  movingZoneId = zoneId;
  moveStartX = point.x;
  moveStartY = point.y;
  moveZoneStartX = zone.x;
  moveZoneStartY = zone.y;
  movePlantStarts = placementsInBed(zoneId);

  window.addEventListener('mousemove', onZoneMove);
  window.addEventListener('touchmove', onZoneMove, { passive: false });
  window.addEventListener('mouseup', stopZoneMove);
  window.addEventListener('touchend', stopZoneMove);
}

function onZoneMove(e) {
  if (!movingZoneId) return;
  if (e.cancelable) e.preventDefault();
  const zone = zones.find(z => z.id === movingZoneId);
  if (!zone) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const point = getCanvasPoint(clientX, clientY);

  const w = zone.width || zone.w || 300;
  const h = zone.height || zone.h || 200;
  const newX = Math.max(0, Math.min(MAP_W - w, Math.round(moveZoneStartX + (point.x - moveStartX))));
  const newY = Math.max(0, Math.min(MAP_H - h, Math.round(moveZoneStartY + (point.y - moveStartY))));
  const dx = newX - zone.x;
  const dy = newY - zone.y;
  zone.x = newX;
  zone.y = newY;

  const zoneEl = document.getElementById(`zone-${zone.id}`);
  if (zoneEl) {
    zoneEl.style.left = `${newX}px`;
    zoneEl.style.top = `${newY}px`;
  }

  // Plants placed in this bed travel with it
  movePlantStarts.forEach(({ plant, placement }) => {
    placement.x += dx;
    placement.y += dy;
    syncLegacyPosition(plant);
    const el = document.getElementById(`marker-${placement.id}`);
    if (el) {
      el.style.left = `${placement.x}px`;
      el.style.top = `${placement.y}px`;
    }
  });
}

async function stopZoneMove() {
  window.removeEventListener('mousemove', onZoneMove);
  window.removeEventListener('touchmove', onZoneMove);
  window.removeEventListener('mouseup', stopZoneMove);
  window.removeEventListener('touchend', stopZoneMove);
  if (!movingZoneId) return;

  const zone = zones.find(z => z.id === movingZoneId);
  const moved = zone && (zone.x !== moveZoneStartX || zone.y !== moveZoneStartY);
  movingZoneId = null;
  if (zone && moved) {
    await syncSaveZone(zone);
    const touched = [...new Set(movePlantStarts.map(m => m.plant))];
    for (const plant of touched) await syncSavePlant(plant);
  }
  movePlantStarts = [];
  renderMap();
}

// --- BED RESIZE DRAG LOGIC ---
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartX = 0;
let resizeStartY = 0;

function startZoneResize(e, zoneId) {
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();

  activeResizeZoneId = zoneId;
  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const point = getCanvasPoint(clientX, clientY);

  resizeStartX = point.x;
  resizeStartY = point.y;
  resizeStartWidth = zone.width || zone.w || 300;
  resizeStartHeight = zone.height || zone.h || 200;

  window.addEventListener('mousemove', onZoneResize);
  window.addEventListener('touchmove', onZoneResize, { passive: false });
  window.addEventListener('mouseup', stopZoneResize);
  window.addEventListener('touchend', stopZoneResize);
}

function onZoneResize(e) {
  if (!activeResizeZoneId) return;
  if (e.cancelable) e.preventDefault();

  const zone = zones.find(z => z.id === activeResizeZoneId);
  if (!zone) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const point = getCanvasPoint(clientX, clientY);

  const deltaX = point.x - resizeStartX;
  const deltaY = point.y - resizeStartY;

  zone.width = Math.max(160, Math.min(MAP_W - 40, Math.round(resizeStartWidth + deltaX)));
  zone.height = Math.max(120, Math.min(MAP_H - 30, Math.round(resizeStartHeight + deltaY)));
  delete zone.w;
  delete zone.h;

  const zoneEl = document.getElementById(`zone-${zone.id}`);
  if (zoneEl) {
    zoneEl.style.width = `${zone.width}px`;
    zoneEl.style.height = `${zone.height}px`;
  }
}

async function stopZoneResize() {
  if (activeResizeZoneId) {
    const zone = zones.find(z => z.id === activeResizeZoneId);
    if (zone) await syncSaveZone(zone);
  }
  activeResizeZoneId = null;

  window.removeEventListener('mousemove', onZoneResize);
  window.removeEventListener('touchmove', onZoneResize);
  window.removeEventListener('mouseup', stopZoneResize);
  window.removeEventListener('touchend', stopZoneResize);
  renderMap();
}

// --- ZONE DELETE (double-confirms when plants are placed inside) ---
function confirmDeleteZone(e, zoneId) {
  if (e) e.stopPropagation();

  const zone = zones.find(z => z.id === zoneId);
  const zoneName = zone ? zone.name : 'dieses Beet';
  const affectedPlants = placementsInBed(zoneId);

  if (affectedPlants.length === 0) {
    showConfirmDialog(
      'Beet löschen?',
      `Möchtest du "${zoneName}" wirklich löschen?`,
      () => executeDeleteZone(zoneId, [])
    );
    return;
  }

  const count = affectedPlants.length;
  const plural = count === 1 ? '' : 'n';

  showConfirmDialog(
    'Beet löschen?',
    `"${zoneName}" enthält ${count} Pflanze${plural}. Beim Löschen werden diese von der Karte entfernt und müssen neu platziert werden.`,
    () => {
      showConfirmDialog(
        'Bist du sicher?',
        `${count} Pflanze${plural} ${count === 1 ? 'wird' : 'werden'} endgültig von der Karte entfernt. Diese Aktion kann nicht rückgängig gemacht werden.`,
        () => executeDeleteZone(zoneId, affectedPlants)
      );
    }
  );
}

async function executeDeleteZone(zoneId, affectedPlacements) {
  zones = zones.filter(z => z.id !== zoneId);

  const touched = [...new Set(affectedPlacements.map(a => a.plant))];
  for (const plant of touched) {
    plant.placements = plant.placements.filter(pl => pl.bed_id !== zoneId);
    syncLegacyPosition(plant);
    await syncSavePlant(plant);
  }

  await syncDeleteZone(zoneId);

  if (resizingZoneId === zoneId) resizingZoneId = null;
  if (editingZoneId === zoneId) closeZoneBar(false);
  if (selectedPlacementId && affectedPlacements.some(a => a.placement.id === selectedPlacementId)) {
    closeSelectedBar();
  }

  renderMap();
  renderPlantList();

  const count = affectedPlacements.length;
  showToast(
    count > 0
      ? `Beet gelöscht – ${count} Pflanze${count === 1 ? ' muss' : 'n müssen'} neu platziert werden`
      : 'Beet entfernt',
    '🗑️'
  );
}

// --- UNPLACED DRAWER ---
function openUnplacedDrawer() {
  const drawer = document.getElementById('drawer-unplaced');
  const list = document.getElementById('unplaced-list');

  // Deceased plants cannot be placed; wishlist plants move into the garden when placed.
  const placeable = plants
    .filter(isPlaceable)
    .sort((a, b) => placementCount(a) - placementCount(b) || a.name.localeCompare(b.name, 'de'));

  if (placeable.length === 0) {
    list.innerHTML = `
      <div class="text-center py-6 text-xs text-stone-500">
        Keine Pflanzen vorhanden.
      </div>
    `;
  } else {
    list.innerHTML = placeable.map(p => {
      const n = placementCount(p);
      return `
      <div class="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span class="text-2xl">${p.emoji || '🪴'}</span>
          <div>
            <h4 class="font-bold text-xs text-stone-800">${p.name}</h4>
            <span class="text-[10px] text-stone-500">${sunLabel(p.sunlight)} • ${t(p.category || 'Perennial')}${n > 0 ? ` • <span class="text-emerald-700 font-semibold">${n}× auf Karte</span>` : ''}${p.status === 'wishlist' ? ' • <span class="text-emerald-700 font-semibold">Wunschliste</span>' : ''}</span>
          </div>
        </div>
        <button onclick="placePlantOnMap('${p.id}')" class="px-3 py-1.5 bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-brand-800 transition-colors whitespace-nowrap">
          ${n > 0 ? '+ Weitere' : 'Platzieren'}
        </button>
      </div>
    `; }).join('');
  }

  drawer.classList.remove('translate-y-full');
}

function closeUnplacedDrawer() {
  document.getElementById('drawer-unplaced').classList.add('translate-y-full');
}

// Adds another specimen of the plant at the map centre (slightly offset if
// that spot is already taken by the same plant).
async function placePlantOnMap(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (!plant || !isPlaceable(plant)) return;
  const promoted = promoteToGarden(plant);
  const offset = (plant.placements || []).filter(pl => Math.abs(pl.x - MAP_CENTER.x) < 60 && Math.abs(pl.y - MAP_CENTER.y) < 60).length;
  const placement = addPlacement(plant, MAP_CENTER.x + offset * 30, MAP_CENTER.y + offset * 30);
  await syncSavePlant(plant);
  closeUnplacedDrawer();
  switchTab('map');
  renderMap();
  renderPlantList();
  selectPlantMarker(placement.id);
  const n = placementCount(plant);
  showToast(promoted ? `${plant.name} ist jetzt im Garten (von der Wunschliste)` : n > 1 ? `${plant.name} erneut platziert (${n}× auf der Karte)` : `${plant.name} auf der Karte platziert`, promoted ? '🌱' : '📍');
}

// --- MAP PANNING (click/single-finger-drag on empty canvas space) ---
let isPanning = false;
let panStartClientX = 0;
let panStartClientY = 0;
let panStartScrollLeft = 0;
let panStartScrollTop = 0;

// --- PINCH-TO-ZOOM (two-finger touch, or ctrl/cmd + wheel on desktop) ---
let pinchStartDistance = null;
let pinchStartZoom = 1;

function setMapZoom(newZoom) {
  mapZoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, newZoom));
  const canvas = document.getElementById('garden-canvas');
  const wrapper = document.getElementById('canvas-zoom-wrapper');
  if (canvas) canvas.style.transform = `scale(${mapZoom})`;
  if (wrapper) {
    wrapper.style.width = `${MAP_W * mapZoom}px`;
    wrapper.style.height = `${MAP_H * mapZoom}px`;
  }
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function isInteractiveMapTarget(target) {
  return !!(
    target.closest('[data-plant-id]') ||
    target.closest('.zone-resize-handle') ||
    target.closest('.zone-editing') ||
    target.closest('#map-selected-bar') ||
    target.closest('#map-zone-bar') ||
    target.closest('button')
  );
}

function startMapPan(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (isInteractiveMapTarget(e.target)) return;
  if (draggingPlacementId || activeResizeZoneId || movingZoneId) return;

  isPanning = true;
  const viewport = document.getElementById('map-viewport');
  panStartClientX = e.clientX;
  panStartClientY = e.clientY;
  panStartScrollLeft = viewport.scrollLeft;
  panStartScrollTop = viewport.scrollTop;
  viewport.classList.add('cursor-grabbing');
}

function onMapPan(e) {
  if (!isPanning) return;
  const viewport = document.getElementById('map-viewport');
  const dx = e.clientX - panStartClientX;
  const dy = e.clientY - panStartClientY;
  viewport.scrollLeft = panStartScrollLeft - dx;
  viewport.scrollTop = panStartScrollTop - dy;
}

function stopMapPan() {
  isPanning = false;
  const viewport = document.getElementById('map-viewport');
  if (viewport) viewport.classList.remove('cursor-grabbing');
}

function handleViewportTouchStart(e) {
  if (isInteractiveMapTarget(e.target)) return;

  if (e.touches.length === 2) {
    if (e.cancelable) e.preventDefault();
    isPanning = false;
    pinchStartDistance = getTouchDistance(e.touches);
    pinchStartZoom = mapZoom;
  } else if (e.touches.length === 1) {
    if (e.cancelable) e.preventDefault();
    const viewport = document.getElementById('map-viewport');
    isPanning = true;
    panStartClientX = e.touches[0].clientX;
    panStartClientY = e.touches[0].clientY;
    panStartScrollLeft = viewport.scrollLeft;
    panStartScrollTop = viewport.scrollTop;
  }
}

function handleViewportTouchMove(e) {
  if (e.touches.length === 2 && pinchStartDistance) {
    if (e.cancelable) e.preventDefault();
    const newDistance = getTouchDistance(e.touches);
    setMapZoom(pinchStartZoom * (newDistance / pinchStartDistance));
  } else if (e.touches.length === 1 && isPanning) {
    if (e.cancelable) e.preventDefault();
    const viewport = document.getElementById('map-viewport');
    const dx = e.touches[0].clientX - panStartClientX;
    const dy = e.touches[0].clientY - panStartClientY;
    viewport.scrollLeft = panStartScrollLeft - dx;
    viewport.scrollTop = panStartScrollTop - dy;
  }
}

function handleViewportTouchEnd(e) {
  if (e.touches.length < 2) pinchStartDistance = null;
  if (e.touches.length === 0) isPanning = false;
}

function handleViewportWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return; // trackpad pinch is reported as ctrl+wheel
  if (e.cancelable) e.preventDefault();
  setMapZoom(mapZoom - e.deltaY * 0.01);
}

function initMapInteractions() {
  const viewport = document.getElementById('map-viewport');
  if (!viewport || viewport.dataset.interactionsBound) return;
  viewport.dataset.interactionsBound = 'true';

  viewport.addEventListener('mousedown', startMapPan);
  window.addEventListener('mousemove', onMapPan);
  window.addEventListener('mouseup', stopMapPan);

  viewport.addEventListener('touchstart', handleViewportTouchStart, { passive: false });
  viewport.addEventListener('touchmove', handleViewportTouchMove, { passive: false });
  viewport.addEventListener('touchend', handleViewportTouchEnd);
  viewport.addEventListener('touchcancel', handleViewportTouchEnd);

  viewport.addEventListener('wheel', handleViewportWheel, { passive: false });

  // A tap (not a drag) on empty map space deselects plant / closes bed bar / ends resize mode
  let tapStartX = 0, tapStartY = 0;
  const rememberTapStart = (x, y) => { tapStartX = x; tapStartY = y; };
  viewport.addEventListener('mousedown', (e) => rememberTapStart(e.clientX, e.clientY));
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) rememberTapStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  const handleEmptyTap = (x, y, target) => {
    if (Math.abs(x - tapStartX) > 8 || Math.abs(y - tapStartY) > 8) return; // it was a drag
    if (isInteractiveMapTarget(target)) return;
    let changed = false;
    if (resizingZoneId) { resizingZoneId = null; changed = true; }
    if (editingZoneId) { closeZoneBar(false); changed = true; }
    if (selectedPlacementId) {
      selectedPlacementId = null;
      document.getElementById('map-selected-bar').classList.add('hidden');
      changed = true;
    }
    if (changed) renderMap();
  };
  viewport.addEventListener('click', (e) => handleEmptyTap(e.clientX, e.clientY, e.target));
  viewport.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const tch = e.changedTouches[0];
      handleEmptyTap(tch.clientX, tch.clientY, e.target);
    }
  });
}
