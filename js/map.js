// --- GARDEN CANVAS: BEDS, PLANT MARKERS, AND SUNLIGHT MISMATCH DETECTION ---

function renderMap() {
  const zonesLayer = document.getElementById('zones-layer');
  const markersLayer = document.getElementById('markers-layer');

  // 1. Render Garden Beds
  zonesLayer.innerHTML = zones.map(zone => {
    let zoneClass = 'zone-pattern-sun';
    if (zone.sunlight === 'Partial Shade') zoneClass = 'zone-pattern-partial';
    if (zone.sunlight === 'Full Shade') zoneClass = 'zone-pattern-shade';

    return `
      <div id="zone-${zone.id}"
           style="left: ${zone.x}px; top: ${zone.y}px; width: ${zone.width || zone.w || 300}px; height: ${zone.height || zone.h || 200}px;"
           class="absolute rounded-2xl ${zoneClass} p-3 flex flex-col justify-between transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-stone-700 bg-white/80 backdrop-blur px-2.5 py-1 rounded-lg shadow-xs border border-stone-200/60">
            ${zone.name}
          </span>
          <button onclick="deleteZone('${zone.id}')" class="p-1 bg-white/80 rounded-md text-stone-400 hover:text-red-600 shadow-xs">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>
        <div class="text-[10px] text-stone-500 font-semibold uppercase tracking-wider bg-white/70 w-max px-2 py-0.5 rounded">
          ${zone.sunlight} Bed
        </div>
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
            <div class="absolute -top-2 -right-1 z-30 bg-amber-500 text-white rounded-full p-0.5 shadow-sm border border-white" title="Sunlight Mismatch! Bed is ${bed.sunlight}, but plant prefers ${plant.sunlight}">
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

// Drag & Drop Marker Logic
let draggingPlantId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startMarkerDrag(e, plantId) {
  e.stopPropagation();
  draggingPlantId = plantId;
  selectedPlantId = plantId;
  showSelectedBar(plantId);

  const canvas = document.getElementById('garden-canvas');
  const rect = canvas.getBoundingClientRect();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const plant = plants.find(p => p.id === plantId);
  if (!plant) return;

  dragOffsetX = (clientX - rect.left) - plant.x_pos;
  dragOffsetY = (clientY - rect.top) - plant.y_pos;

  window.addEventListener('mousemove', onMarkerDrag);
  window.addEventListener('touchmove', onMarkerDrag);
  window.addEventListener('mouseup', stopMarkerDrag);
  window.addEventListener('touchend', stopMarkerDrag);
}

function onMarkerDrag(e) {
  if (!draggingPlantId) return;

  const canvas = document.getElementById('garden-canvas');
  const rect = canvas.getBoundingClientRect();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  let newX = Math.round(clientX - rect.left - dragOffsetX);
  let newY = Math.round(clientY - rect.top - dragOffsetY);

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
  const zoneText = zone ? zone.name : 'Unassigned Bed';

  const isMismatch = zone && zone.sunlight !== plant.sunlight;
  const mismatchWarning = isMismatch
    ? `<span class="text-amber-300 font-bold ml-1">⚠️ Sun mismatch: bed is ${zone.sunlight}</span>`
    : '';

  document.getElementById('selected-item-subtitle').innerHTML = `${zoneText} • ${plant.sunlight}${mismatchWarning}`;

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
    showToast(`Removed ${plant.name} from map`, '📍');
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
  showToast(`Created garden bed "${newZone.name}"`, '🏡');
}

function deleteZone(zoneId) {
  const zone = zones.find(z => z.id === zoneId);
  showConfirmDialog(
    'Delete Garden Bed?',
    `Remove "${zone ? zone.name : 'this bed'}"? Plants in this bed will remain on canvas.`,
    async () => {
      zones = zones.filter(z => z.id !== zoneId);
      plants.forEach(p => {
        if (p.bed_id === zoneId) p.bed_id = null;
      });
      await syncDeleteZone(zoneId);
      renderMap();
      showToast('Bed removed', '🗑️');
    }
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
        All your plants are already placed on the map!
      </div>
    `;
  } else {
    list.innerHTML = unplaced.map(p => `
      <div class="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span class="text-2xl">${p.emoji || '🪴'}</span>
          <div>
            <h4 class="font-bold text-xs text-stone-800">${p.name}</h4>
            <span class="text-[10px] text-stone-500">${p.sunlight} • ${p.category || 'Plant'}</span>
          </div>
        </div>
        <button onclick="placePlantOnMap('${p.id}')" class="px-3 py-1.5 bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-brand-800 transition-colors">
          Place Marker
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
    showToast(`Placed ${plant.name} on map`, '📍');
  }
}
