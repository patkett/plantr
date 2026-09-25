// --- PLANT DIRECTORY: LIST RENDERING & FILTERS ---

function setLightFilter(filter) {
  lightFilter = filter;

  const filters = ['all', 'sun', 'partial', 'shade'];
  filters.forEach(f => {
    const btn = document.getElementById(`filter-light-${f}`);
    if (!btn) return;

    if ((f === 'all' && filter === 'all') ||
        (f === 'sun' && filter === 'Full Sun') ||
        (f === 'partial' && filter === 'Partial Shade') ||
        (f === 'shade' && filter === 'Full Shade')) {
      btn.className = "px-2.5 py-1 rounded-full text-xs font-medium border bg-brand-800 text-white border-brand-800 transition-colors flex items-center gap-1";
    } else {
      btn.className = "px-2.5 py-1 rounded-full text-xs font-medium border bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200 transition-colors flex items-center gap-1";
    }
  });

  renderPlantList();
}

function renderPlantList() {
  const container = document.getElementById('plant-cards-container');
  const searchTerm = document.getElementById('input-search').value.toLowerCase();
  const statusFilter = document.getElementById('select-status-filter').value;

  const filtered = plants.filter(plant => {
    const matchesSearch = plant.name.toLowerCase().includes(searchTerm) ||
                          (plant.category && plant.category.toLowerCase().includes(searchTerm));

    const matchesStatus = statusFilter === 'all' || plant.status === statusFilter;
    const matchesLight = lightFilter === 'all' || plant.sunlight === lightFilter;

    return matchesSearch && matchesStatus && matchesLight;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 px-4 bg-white rounded-2xl border border-stone-200">
        <div class="text-4xl mb-2">🌿</div>
        <h3 class="font-bold text-stone-700 text-sm">Keine Pflanzen gefunden</h3>
        <p class="text-xs text-stone-400 mt-1">Versuche andere Filter oder Suchbegriffe.</p>
      </div>
    `;
    return;
  }

  const renderCard = (plant) => {
    const lightBadgeColor = plant.sunlight === 'Full Sun'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : plant.sunlight === 'Partial Shade'
        ? 'bg-orange-100 text-orange-800 border-orange-300'
        : 'bg-slate-200 text-slate-800 border-slate-300';

    const isMapped = plant.x_pos !== null && plant.y_pos !== null;
    const bed = zones.find(z => z.id === plant.bed_id);
    const isDeceased = plant.status === 'deceased';
    const diedDate = plant.died_at ? new Date(plant.died_at).toLocaleDateString('de-DE') : null;

    return `
      <div class="bg-white rounded-2xl p-4 border ${isDeceased ? 'border-stone-300 opacity-80' : 'border-stone-200/80'} shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3">
            <div class="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-2xl border border-stone-200/60 shrink-0">
              ${plant.emoji || '🪴'}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-stone-800 text-sm leading-tight">${plant.name}</h3>
                ${plant.status === 'wishlist' ? '<span class="px-2 py-0.5 text-[9px] bg-purple-100 text-purple-700 font-semibold rounded-full border border-purple-200">Wunschliste</span>' : ''}
                ${isDeceased ? '<span class="px-2 py-0.5 text-[9px] bg-stone-200 text-stone-700 font-semibold rounded-full border border-stone-300">🪦 Verstorben</span>' : ''}
              </div>
              <p class="text-[11px] text-stone-500 font-medium mt-1">${t(plant.category || 'Perennial')}</p>
            </div>
          </div>

          <div class="flex items-center space-x-1">
            <button onclick="openPlantModal('${plant.id}')" title="Pflanze bearbeiten" class="p-1.5 text-stone-400 hover:text-brand-700 hover:bg-stone-100 rounded-lg transition-colors">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deletePlant('${plant.id}')" title="Pflanze löschen" class="p-1.5 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded-lg transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Badges -->
        <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span class="px-2.5 py-0.5 rounded-full border font-medium ${lightBadgeColor}">
            ${t(plant.sunlight)}
          </span>
          <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            💧 ${t(plant.water || 'Moderate')} Wasser
          </span>
          <span class="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            🌱 ${t(plant.soil || 'Well-Drained')}
          </span>
          ${bed ? `<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">🏡 ${bed.name}</span>` : ''}
        </div>

        ${isDeceased ? `<p class="text-xs text-stone-600 bg-stone-100 p-2.5 rounded-xl border border-stone-200 leading-relaxed">🪦 Verstorben${plant.died_in_bed ? ` im Beet <strong>${plant.died_in_bed}</strong>` : ''}${plant.died_bed_sunlight ? ` (${t(plant.died_bed_sunlight)})` : ''}${diedDate ? ` am ${diedDate}` : ''}</p>` : ''}
        ${plant.notes ? `<p class="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60 leading-relaxed">${plant.notes}</p>` : ''}

        ${isDeceased ? '' : `<div class="pt-1 flex items-center justify-between border-t border-stone-100">
          <span class="text-[11px] font-medium ${isMapped ? 'text-emerald-700' : 'text-stone-400'} flex items-center gap-1">
            <i data-lucide="${isMapped ? 'check-circle' : 'circle-dashed'}" class="w-3.5 h-3.5"></i>
            ${isMapped ? 'Auf Karte platziert' : 'Nicht auf Karte'}
          </span>
          <button onclick="jumpToMapWithPlant('${plant.id}')" class="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1">
            <span>${isMapped ? 'Auf Karte ansehen' : 'Auf Karte platzieren'}</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </button>
        </div>`}
      </div>
    `;
  };

  const living = filtered.filter(p => p.status !== 'deceased');
  const deceased = filtered.filter(p => p.status === 'deceased');
  let html = living.map(renderCard).join('');
  if (deceased.length > 0) {
    if (living.length > 0) {
      html += `<div class="flex items-center gap-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-stone-500"><span>🪦 Verstorben (${deceased.length})</span><div class="flex-1 h-px bg-stone-200"></div></div>`;
    }
    html += deceased.map(renderCard).join('');
  }
  container.innerHTML = html;

  lucide.createIcons();
}

// Marks a plant as deceased, remembering the bed (and its light conditions)
// it died in, and removes it from the map.
async function markPlantDeceased(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (!plant) return;
  const bed = zones.find(z => z.id === plant.bed_id);
  plant.status = 'deceased';
  plant.died_in_bed = bed ? bed.name : (plant.died_in_bed || null);
  plant.died_bed_sunlight = bed ? bed.sunlight : (plant.died_bed_sunlight || null);
  plant.died_at = new Date().toISOString();
  plant.x_pos = null;
  plant.y_pos = null;
  plant.bed_id = null;
  await syncSavePlant(plant);
  if (typeof selectedPlantId !== 'undefined' && selectedPlantId === plantId) closeSelectedBar();
  renderPlantList();
  renderMap();
  showToast(`${plant.name} als verstorben markiert${bed ? ` (Beet: ${bed.name})` : ''}`, '🪦');
}

function confirmMarkDeceased(plantId) {
  const plant = plants.find(p => p.id === plantId);
  if (!plant) return;
  const bed = zones.find(z => z.id === plant.bed_id);
  showConfirmDialog(
    'Pflanze als verstorben markieren?',
    `"${plant.name}" wird von der Karte entfernt${bed ? ` und das Beet "${bed.name}" als Sterbeort festgehalten` : ''}.`,
    () => markPlantDeceased(plantId),
    'Als verstorben markieren'
  );
}

// --- PLANT MODAL HANDLERS ---
function openPlantModal(plantId = null) {
  const modal = document.getElementById('modal-plant-form');
  const form = document.getElementById('plant-form');
  const title = document.getElementById('plant-modal-title');

  if (plantId) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    title.innerText = 'Pflanze bearbeiten';
    document.getElementById('plant-id').value = plant.id;
    document.getElementById('form-name').value = plant.name;
    document.getElementById('form-emoji').value = plant.emoji || '🪴';
    document.getElementById('form-status').value = plant.status || 'garden';
    document.getElementById('form-sunlight').value = plant.sunlight || 'Full Sun';
    document.getElementById('form-water').value = plant.water || 'Moderate';
    document.getElementById('form-soil').value = plant.soil || 'Well-Drained';
    document.getElementById('form-category').value = plant.category || 'Perennial';
    document.getElementById('form-notes').value = plant.notes || '';
  } else {
    title.innerText = 'Neue Pflanze hinzufügen';
    form.reset();
    document.getElementById('plant-id').value = '';
  }

  modal.classList.remove('hidden');
}

function closePlantModal() {
  document.getElementById('modal-plant-form').classList.add('hidden');
}

async function handlePlantFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('plant-id').value;

  const existing = id ? plants.find(p => p.id === id) : null;

  const plantData = {
    id: id || 'p_' + Date.now(),
    name: document.getElementById('form-name').value,
    botanical_name: existing ? (existing.botanical_name || null) : null,
    emoji: document.getElementById('form-emoji').value || '🪴',
    status: document.getElementById('form-status').value,
    sunlight: document.getElementById('form-sunlight').value,
    water: document.getElementById('form-water').value,
    soil: document.getElementById('form-soil').value,
    category: document.getElementById('form-category').value,
    notes: document.getElementById('form-notes').value,
    x_pos: existing ? existing.x_pos : null,
    y_pos: existing ? existing.y_pos : null,
    bed_id: existing ? existing.bed_id : null,
    died_in_bed: existing ? existing.died_in_bed || null : null,
    died_bed_sunlight: existing ? existing.died_bed_sunlight || null : null,
    died_at: existing ? existing.died_at || null : null
  };

  if (plantData.status === 'deceased') {
    if (!existing || existing.status !== 'deceased') {
      const bed = existing ? zones.find(z => z.id === existing.bed_id) : null;
      plantData.died_in_bed = bed ? bed.name : null;
      plantData.died_bed_sunlight = bed ? bed.sunlight : null;
      plantData.died_at = new Date().toISOString();
    }
    plantData.x_pos = null;
    plantData.y_pos = null;
    plantData.bed_id = null;
  } else if (existing && existing.status === 'deceased') {
    // Revived / corrected: clear the death record
    plantData.died_in_bed = null;
    plantData.died_bed_sunlight = null;
    plantData.died_at = null;
  }

  if (id) {
    const idx = plants.findIndex(p => p.id === id);
    if (idx !== -1) plants[idx] = plantData;
    showToast(`${plantData.name} aktualisiert`, '🌱');
  } else {
    plants.push(plantData);
    showToast(`${plantData.name} hinzugefügt`, '🌱');
  }

  await syncSavePlant(plantData);
  renderPlantList();
  renderMap();
  closePlantModal();
}

function deletePlant(plantId) {
  const plant = plants.find(p => p.id === plantId);
  showConfirmDialog(
    'Pflanze löschen?',
    `"${plant ? plant.name : 'Diese Pflanze'}" aus deinem Gartenverzeichnis entfernen?`,
    async () => {
      plants = plants.filter(p => p.id !== plantId);
      await syncDeletePlant(plantId);
      renderPlantList();
      renderMap();
      if (selectedPlantId === plantId) closeSelectedBar();
      showToast('Pflanze gelöscht', '🗑️');
    }
  );
}
