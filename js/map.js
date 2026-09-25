// --- GARDEN CANVAS: BEDS, PLANT MARKERS, AND SUNLIGHT MISMATCH DETECTION ---

let mapZoom = 1;
const MAP_ZOOM_MIN = 0.5;
const MAP_ZOOM_MAX = 2.5;

let openZoneMenuId = null;   // zone whose edit dropdown is currently open
let resizingZoneId = null;   // zone currently showing its resize handle
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
           class="absolute rounded-2xl ${zoneClass} p-3 flex flex-col justify-between transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-stone-700 bg-white/80 backdrop-blur px-2.5 py-1 rounded-lg shadow-xs border border-stone-200/60">
            ${zone.name}
          </span>
          <div class="relative">
            <button onclick="toggleZoneMenu(event, '${zone.id}')" class="p-1 bg-white/80 rounded-md text-stone-500 hover:text-brand-700 shadow-xs">
              <i data-lucide="pencil" class="w-3 h-3"></i>
            </button>
            <div id="zone-menu-${zone.id}" class="hidden absolute right-0 top-7 z-40 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden w-40">
              <button onclick="startZoneResizeMode(event, '${zone.id}')" class="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 flex items-center gap-2">
                <i data-lucide="move-diagonal-2" class="w-3.5 h-3.5"></i> Größe ändern
              </button>
              <button onclick="confirmDeleteZone(event, '${zone.id}')" class="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-stone-100">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Löschen
              </button>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-stone-500 font-semibold uppercase tracking-wider bg-white/70 w-max px-2 py-0.5 rounded">
          ${t(zone.sunlight)}-Beet
        </div>
        ${zone.id === resizingZoneId ? `
          <div class="zone-resize-handle absolute bottom-1.5 right-1.5 w-6 h-6 bg-brand-700 rounded-lg shadow-md cursor-se-resize flex items-center justify-center z-40"
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
  const mappedPlants = plants.filter(p => p.x_pos !== null && p.y_pos !== null);
  markersLayer.innerHTML = mappedPlants.map(plant => {
    const isSelected = plant.id === selectedPlantId;
    const bed = zones.find(z => z.id === plant.bed_id);
    const hasSunMismatch = bed && bed.sunlight !== plant.sunlight;

    return `
      <div id="marker-${plant.id}"
           data-plant-id="${plant.id}"
           style="left: ${plant.x_pos}px; top: ${plant.y_pos}px;"
           onmousedown="startMarkerDrag(event, '${plant.id}')"
           ontouchstart="startMarkerDrag(event, '${plant.id}')"
           onclick="selectPlantMarker('${plant.id}')"
           class="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 group">

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
let draggingPlantId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startMarkerDrag(e, plantId) {
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();

  draggingPlantId = plantId;
  selectedPlantId = plantId;
  showSelectedBar(plantId);

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const plant = plants.find(p => p.id === plantId);
  if (!plant) return;

  const point = getCanvasPoint(clientX, clientY);
  dragOffsetX = point.x - plant.x_pos;
  dragOffsetY = point.y - plant.y_pos;

  window.addEventListener('mousemove', onMarkerDrag);
  window.addEventListener('touchmove', onMarkerDrag, { passive: false });
  window.addEventListener('mouseup', stopMarkerDrag);
  window.addEventListener('touchend', stopMarkerDrag);
}

function onMarkerDrag(e) {
  if (!draggingPlantId) return;
  if (e.cancelable) e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const point = getCanvasPoint(clientX, clientY);
  let newX = Math.round(point.x - dragOffsetX);
  let newY = Math.round(point.y - dragOffsetY);

  newX = Math.max(20, Math.min(880, newX));
  newY = Math.max(20, Math.min(630, newY));

  const plant = plants.find(p => p.id === draggingPlantId);
  if (plant) {
    plant.x_pos = newX;
    plant.y_pos = newY;

    // Auto detect zone underneath
    const matchedZone = zones.find(z => {
      const zw = z.width || z.w || 300;
      const zh = z.height || z.h || 200;
      return newX >= z.x && newX <= (z.x + zw) && newY >= z.y && newY <= (z.y + zh);
    });

    plant.bed_id = matchedZone ? matchedZone.id : null;

    const markerEl = document.getElementById(`marker-${plant.id}`);
    if (markerEl) {
      markerEl.style.left = `${newX}px`;
      markerEl.style.top = `${newY}px`;
    }
  }
}

async function stopMarkerDrag() {
  if (draggingPlantId) {
    const plant = plants.find(p => p.id === draggingPlantId);
    if (plant) {
      await syncSavePlant(plant);
    }
    draggingPlantId = null;
  }
  window.removeEventListener('mousemove', onMarkerDrag);
  window.removeEventListener('touchmove', onMarkerDrag);
  window.removeEventListener('mouseup', stopMarkerDrag);
  window.removeEventListener('touchend', stopMarkerDrag);
  renderMap();
}

function selectPlantMarker(id) {
  selectedPlantId = id;
  showSelectedBar(id);
  renderMap();
}

function showSelectedBar(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (!plant) return;

  const bar = document.getElementById('map-selected-bar');
  document.getElementById('selected-item-icon').innerText = plant.emoji || '🪴';
  document.getElementById('selected-item-title').innerText = plant.name;

  const zone = zones.find(z => z.id === plant.bed_id);
  const zoneText = zone ? zone.name : 'Kein Beet zugewiesen';

  const isMismatch = zone && zone.sunlight !== plant.sunlight;
  const mismatchWarning = isMismatch
    ? `<span class="text-amber-300 font-bold ml-1">⚠️ Lichtkonflikt: Beet hat ${t(zone.sunlight)}</span>`
    : '';

  document.getElementById('selected-item-subtitle').innerHTML = `${zoneText} • ${t(plant.sunlight)}${mismatchWarning}`;

  const unmapBtn = document.getElementById('btn-unmap-item');
  unmapBtn.onclick = () => unmapPlant(plantId);

  bar.classList.remove('hidden');
}

function closeSelectedBar() {
  document.getElementById('map-selected-bar').classList.add('hidden');
  selectedPlantId = null;
  renderMap();
}

async function unmapPlant(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (plant) {
    plant.x_pos = null;
    plant.y_pos = null;
    plant.bed_id = null;
    await syncSavePlant(plant);
    closeSelectedBar();
    renderMap();
    renderPlantList();
    showToast(`${plant.name} von der Karte entfernt`, '📍');
  }
}

function jumpToMapWithPlant(plantId) {
  switchTab('map');
  const plant = plants.find(p => p.id === plantId);
  if (plant) {
    if (plant.x_pos === null || plant.y_pos === null) {
      plant.x_pos = 450;
      plant.y_pos = 300;
      syncSavePlant(plant);
    }
    selectPlantMarker(plantId);
  }
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

// --- ZONE EDIT DROPDOWN (resize / delete) ---
function toggleZoneMenu(e, zoneId) {
  e.stopPropagation();
  if (openZoneMenuId === zoneId) {
    closeAllZoneMenus();
    return;
  }
  closeAllZoneMenus();
  openZoneMenuId = zoneId;
  const menu = document.getElementById(`zone-menu-${zoneId}`);
  if (menu) menu.classList.remove('hidden');
}

function closeAllZoneMenus() {
  document.querySelectorAll('[id^="zone-menu-"]').forEach(m => m.classList.add('hidden'));
  openZoneMenuId = null;
}

function startZoneResizeMode(e, zoneId) {
  e.stopPropagation();
  closeAllZoneMenus();
  resizingZoneId = zoneId;
  renderMap();
  showToast('Ziehe die Ecke unten rechts, um die Größe zu ändern', '📐');
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

  zone.width = Math.max(160, Math.min(860, Math.round(resizeStartWidth + deltaX)));
  zone.height = Math.max(120, Math.min(620, Math.round(resizeStartHeight + deltaY)));
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
  resizingZoneId = null;

  window.removeEventListener('mousemove', onZoneResize);
  window.removeEventListener('touchmove', onZoneResize);
  window.removeEventListener('mouseup', stopZoneResize);
  window.removeEventListener('touchend', stopZoneResize);
  renderMap();
}

// --- ZONE DELETE (double-confirms when plants are placed inside) ---
function confirmDeleteZone(e, zoneId) {
  if (e) e.stopPropagation();
  closeAllZoneMenus();

  const zone = zones.find(z => z.id === zoneId);
  const zoneName = zone ? zone.name : 'dieses Beet';
  const affectedPlants = plants.filter(p => p.bed_id === zoneId);

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

async function executeDeleteZone(zoneId, affectedPlants) {
  zones = zones.filter(z => z.id !== zoneId);

  for (const plant of affectedPlants) {
    plant.x_pos = null;
    plant.y_pos = null;
    plant.bed_id = null;
    await syncSavePlant(plant);
  }

  await syncDeleteZone(zoneId);

  if (resizingZoneId === zoneId) resizingZoneId = null;
  if (selectedPlantId && affectedPlants.some(p => p.id === selectedPlantId)) {
    closeSelectedBar();
  }

  renderMap();
  renderPlantList();

  const count = affectedPlants.length;
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

  const unplaced = plants.filter(p => p.x_pos === null || p.y_pos === null);

  if (unplaced.length === 0) {
    list.innerHTML = `
      <div class="text-center py-6 text-xs text-stone-500">
        Alle deine Pflanzen sind bereits auf der Karte platziert!
      </div>
    `;
  } else {
    list.innerHTML = unplaced.map(p => `
      <div class="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span class="text-2xl">${p.emoji || '🪴'}</span>
          <div>
            <h4 class="font-bold text-xs text-stone-800">${p.name}</h4>
            <span class="text-[10px] text-stone-500">${t(p.sunlight)} • ${t(p.category || 'Perennial')}</span>
          </div>
        </div>
        <button onclick="placePlantOnMap('${p.id}')" class="px-3 py-1.5 bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-brand-800 transition-colors">
          Platzieren
        </button>
      </div>
    `).join('');
  }

  drawer.classList.remove('translate-y-full');
}

function closeUnplacedDrawer() {
  document.getElementById('drawer-unplaced').classList.add('translate-y-full');
}

async function placePlantOnMap(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (plant) {
    plant.x_pos = 450;
    plant.y_pos = 300;
    await syncSavePlant(plant);
    closeUnplacedDrawer();
    renderMap();
    selectPlantMarker(plantId);
    showToast(`${plant.name} auf der Karte platziert`, '📍');
  }
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
    wrapper.style.width = `${900 * mapZoom}px`;
    wrapper.style.height = `${650 * mapZoom}px`;
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
    target.closest('[id^="zone-menu-"]') ||
    target.closest('button')
  );
}

function startMapPan(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (isInteractiveMapTarget(e.target)) return;
  if (draggingPlantId || activeResizeZoneId) return;

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

  document.addEventListener('click', () => closeAllZoneMenus());
}
