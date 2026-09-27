// --- MAP GEOMETRY (single source of truth; index.html and styles.css read these
// values via applyMapGeometry()) ---
// Stored coordinates live in the original 900x1300 system. The ground around it
// was enlarged, so the coordinate origin sits at a fixed offset inside the canvas
// and nothing stored in the database had to be moved. All values are multiples
// of MAP_GRID so grid snapping and the edge clamps agree.
const MAP_GRID = 50;          // beds snap to this grid; plants stay freely positioned
const MAP_CONTENT_W = 900;    // extent of the stored coordinate system
const MAP_CONTENT_H = 1300;
const MAP_OX = 250;           // origin offset of the coordinate system inside the canvas
const MAP_OY = 350;
const MAP_W = MAP_CONTENT_W + 2 * MAP_OX;   // 1400
const MAP_H = MAP_CONTENT_H + 2 * MAP_OY;   // 2000
// Bounds in map coordinates
const MAP_MIN_X = -MAP_OX;
const MAP_MIN_Y = -MAP_OY;
const MAP_MAX_X = MAP_W - MAP_OX;
const MAP_MAX_Y = MAP_H - MAP_OY;
const MAP_CONTENT_CENTER = { x: MAP_CONTENT_W / 2, y: MAP_CONTENT_H / 2 };
const MARKER_MARGIN = 20;     // keeps a marker's centre away from the canvas edge
const ZONE_MIN_W = 150;
const ZONE_MIN_H = 100;

const snapToGrid = v => Math.round(v / MAP_GRID) * MAP_GRID;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clampMarkerPoint = (x, y) => ({
  x: Math.round(clamp(x, MAP_MIN_X + MARKER_MARGIN, MAP_MAX_X - MARKER_MARGIN)),
  y: Math.round(clamp(y, MAP_MIN_Y + MARKER_MARGIN, MAP_MAX_Y - MARKER_MARGIN))
});
const zoneWidth = zone => zone.width || zone.w || 300;
const zoneHeight = zone => zone.height || zone.h || 200;

// Sizes the canvas, zoom wrapper, coordinate layers and the grid background
// from the constants above.
function applyMapGeometry() {
  const canvas = document.getElementById('garden-canvas');
  const wrapper = document.getElementById('canvas-zoom-wrapper');
  if (canvas) {
    canvas.style.width = `${MAP_W}px`;
    canvas.style.height = `${MAP_H}px`;
    canvas.style.setProperty('--map-grid', `${MAP_GRID}px`);
    canvas.style.setProperty('--map-grid-major', `${MAP_GRID * 5}px`);
    canvas.style.setProperty('--map-ox', `${MAP_OX}px`);
    canvas.style.setProperty('--map-oy', `${MAP_OY}px`);
  }
  if (wrapper) {
    wrapper.style.width = `${MAP_W}px`;
    wrapper.style.height = `${MAP_H}px`;
  }
  ['zones-layer', 'markers-layer'].forEach(id => {
    const layer = document.getElementById(id);
    if (!layer) return;
    layer.style.left = `${MAP_OX}px`;
    layer.style.top = `${MAP_OY}px`;
    layer.style.width = `${MAP_CONTENT_W}px`;
    layer.style.height = `${MAP_CONTENT_H}px`;
  });
}

// --- GARDEN CANVAS: BEDS, PLANT MARKERS, AND SUNLIGHT MISMATCH DETECTION ---

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

    const width = zoneWidth(zone);
    const height = zoneHeight(zone);

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
           class="absolute -translate-x-1/2 -translate-y-1/2 ${isSelected ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} z-20 group pointer-events-auto">

        <div class="flex flex-col items-center">
          <div class="relative">
          ${hasSunMismatch ? `
            <div class="absolute -top-2 -right-1 z-30 bg-amber-500 text-white rounded-full p-0.5 shadow-sm border border-white" title="Lichtkonflikt! Das Beet hat ${t(bed.sunlight)}, die Pflanze bevorzugt aber ${t(plant.sunlight)}">
              <i data-lucide="alert-triangle" class="w-3 h-3"></i>
            </div>
          ` : ''}
          <div class="w-10 h-10 rounded-full bg-white shadow-md border-2 ${isSelected ? 'border-brand-600 marker-active' : (hasSunMismatch ? 'border-amber-400' : 'border-stone-300')} flex items-center justify-center text-xl transition-transform transform group-hover:scale-110 overflow-hidden">
            ${plantThumbSrc(plant) ? `<img src="${plantThumbSrc(plant)}" alt="" draggable="false" class="w-full h-full object-cover pointer-events-none">` : leafSvg('w-5 h-5')}
          </div>
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
    x: (clientX - rect.left) / mapZoom - MAP_OX,
    y: (clientY - rect.top) / mapZoom - MAP_OY
  };
}

// --- DRAG & DROP MARKER LOGIC ---
let draggingPlacementId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
// Set while a marker was actually moved so the `click` that follows a mouse
// drag does not deselect the marker again.
let markerDragMoved = false;

// Markers can only be dragged once they are selected; an unselected marker
// lets the gesture through so panning/pinching over it still works and a
// plain tap selects it (see togglePlantMarker).
function startMarkerDrag(e, placementId) {
  if (selectedPlacementId !== placementId) return;
  if (e.touches && e.touches.length > 1) return;
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();

  const found = findPlacement(placementId);
  if (!found) return;

  draggingPlacementId = placementId;
  markerDragMoved = false;
  closeZoneBar(false);

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
  const { x: newX, y: newY } = clampMarkerPoint(point.x - dragOffsetX, point.y - dragOffsetY);

  const found = findPlacement(draggingPlacementId);
  if (found) {
    if (found.placement.x !== newX || found.placement.y !== newY) markerDragMoved = true;
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
  // The browser's synthetic click arrives right after mouseup; clear afterwards
  setTimeout(() => { markerDragMoved = false; }, 0);
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
  if (markerDragMoved) return; // click that ended a drag, not a tap
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
  const iconEl = document.getElementById('selected-item-icon');
  const thumb = plantThumbSrc(plant);
  iconEl.innerHTML = thumb ? `<img src="${thumb}" alt="" class="w-full h-full object-cover rounded-full">` : leafSvg('w-5 h-5');
  const total = placementCount(plant);
  document.getElementById('selected-item-title').innerText = total > 1 ? `${plant.name} (${total}×)` : plant.name;

  const zone = zones.find(z => z.id === placement.bed_id);
  const zoneText = zone ? zone.name : 'Kein Beet zugewiesen';

  const plantedText = placement.planted_at ? `gepflanzt ${formatDeDate(placement.planted_at)}` : 'Pflanzdatum unbekannt';
  document.getElementById('selected-item-subtitle').innerText = `${zoneText} • ${sunLabel(plant.sunlight)} • ${plantedText}`;

  const dateInput = document.getElementById('input-planted-item');
  dateInput.value = placement.planted_at || '';
  document.getElementById('label-planted-item').innerText = placement.planted_at ? formatDeDate(placement.planted_at) : 'Pflanzdatum';
  dateInput.max = todayIsoDate();
  dateInput.onchange = () => setPlacementPlantedAt(placementId, dateInput.value);

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
    const center = getViewportCenterPoint();
    addPlacement(plant, center.x, center.y);
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
    // staggered start position; multiples of MAP_GRID so it sits on the grid
    x: 2 * MAP_GRID + (zones.length % 8) * MAP_GRID,
    y: 2 * MAP_GRID + (zones.length % 6) * MAP_GRID,
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

  const newX = clamp(snapToGrid(moveZoneStartX + (point.x - moveStartX)), MAP_MIN_X, MAP_MAX_X - zoneWidth(zone));
  const newY = clamp(snapToGrid(moveZoneStartY + (point.y - moveStartY)), MAP_MIN_Y, MAP_MAX_Y - zoneHeight(zone));
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
  resizeStartWidth = zoneWidth(zone);
  resizeStartHeight = zoneHeight(zone);

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

  zone.width = clamp(snapToGrid(resizeStartWidth + deltaX), ZONE_MIN_W, MAP_MAX_X - zone.x);
  zone.height = clamp(snapToGrid(resizeStartHeight + deltaY), ZONE_MIN_H, MAP_MAX_Y - zone.y);
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
          ${plantAvatarHtml(p, 'w-10 h-10', '', 'text-2xl')}
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

// Centre of the part of the map currently visible in the viewport (map coords).
// Falls back to the centre of the coordinate system while the map tab is hidden
// (a display:none viewport has no usable geometry).
function getViewportCenterPoint() {
  const viewport = document.getElementById('map-viewport');
  if (!viewport || viewport.clientWidth === 0 || viewport.clientHeight === 0) return { ...MAP_CONTENT_CENTER };
  const vRect = viewport.getBoundingClientRect();
  const point = getCanvasPoint(vRect.left + vRect.width / 2, vRect.top + vRect.height / 2);
  return clampMarkerPoint(point.x, point.y);
}

// Adds another specimen of the plant at the centre of the visible viewport
// (slightly offset if that spot is already taken by the same plant).
async function placePlantOnMap(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (!plant || !isPlaceable(plant)) return;
  const promoted = promoteToGarden(plant);
  closeUnplacedDrawer();
  switchTab('map'); // before measuring, so the viewport has a size
  const center = getViewportCenterPoint();
  const offset = (plant.placements || []).filter(pl => Math.abs(pl.x - center.x) < 60 && Math.abs(pl.y - center.y) < 60).length;
  const placement = addPlacement(plant, center.x + offset * 30, center.y + offset * 30);
  await syncSavePlant(plant);
  renderMap();
  renderPlantList();
  selectPlantMarker(placement.id);
  const n = placementCount(plant);
  showToast(promoted ? `${plant.name} ist jetzt im Garten (von der Wunschliste)` : n > 1 ? `${plant.name} erneut platziert (${n}× auf der Karte)` : `${plant.name} auf der Karte platziert`, promoted ? '🌱' : '📍');
}
