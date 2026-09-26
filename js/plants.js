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

    const count = placementCount(plant);
    const isMapped = count > 0;
    const bedNames = [...new Set((plant.placements || []).map(pl => zones.find(z => z.id === pl.bed_id)).filter(Boolean).map(z => z.name))];
    const isDeceased = plant.status === 'deceased';
    const isWishlist = plant.status === 'wishlist';
    const diedDate = plant.died_at ? new Date(plant.died_at).toLocaleDateString('de-DE') : null;
    const deaths = plant.deaths || [];
    const fmtDeath = d => `${d.bed ? `Beet <strong>${d.bed}</strong>` : 'ohne Beet'}${d.sunlight ? ` (${t(d.sunlight)})` : ''}${d.died_at ? ` am ${new Date(d.died_at).toLocaleDateString('de-DE')}` : ''}`;
    // Deaths of single specimens while the plant itself is still alive
    const historyHtml = !isDeceased && deaths.length > 0
      ? `<p class="text-xs text-stone-600 bg-stone-100 p-2.5 rounded-xl border border-stone-200 leading-relaxed">🪦 ${deaths.length === 1 ? 'Ein Exemplar verstorben' : `${deaths.length} Exemplare verstorben`}: ${deaths.map(fmtDeath).join('; ')}</p>`
      : '';

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
                ${isDeceased ? '<span class="px-2 py-0.5 text-[9px] bg-stone-200 text-stone-700 font-semibold rounded-full border border-stone-300">🪦 Verstorben</span>' : ''}
              </div>
              <p class="text-[11px] text-stone-500 font-medium mt-1">${t(plant.category || 'Perennial')}</p>
            </div>
          </div>

          <div class="flex items-center space-x-1">
            <button onclick="openPlantModal('${plant.id}')" title="Pflanze bearbeiten" class="p-1.5 text-stone-400 hover:text-brand-700 hover:bg-stone-100 rounded-lg transition-colors">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
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
          ${bedNames.map(n => `<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">🏡 ${n}</span>`).join('')}
        </div>

        ${plant.notes ? `<p class="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60 leading-relaxed">${plant.notes}</p>` : ''}
        ${isDeceased ? `<p class="text-xs text-stone-600 bg-stone-100 p-2.5 rounded-xl border border-stone-200 leading-relaxed">🪦 Verstorben${plant.died_in_bed ? ` im Beet <strong>${plant.died_in_bed}</strong>` : ''}${plant.died_bed_sunlight ? ` (${t(plant.died_bed_sunlight)})` : ''}${diedDate ? ` am ${diedDate}` : ''}${deaths.length > 1 ? `<br><span class="text-stone-500">Frühere Exemplare: ${deaths.slice(0, -1).map(fmtDeath).join('; ')}</span>` : ''}</p>` : ''}
        ${historyHtml}

        ${isDeceased ? '' : isWishlist ? `<div class="pt-1 flex items-center justify-between border-t border-stone-100">
          <span class="text-[11px] font-medium text-stone-400 flex items-center gap-1">
            <i data-lucide="shopping-cart" class="w-3.5 h-3.5"></i>
            Wunschliste${plant.wished_by ? ` von ${plant.wished_by}` : ''}
          </span>
          <button onclick="jumpToMapWithPlant('${plant.id}')" title="Platzieren und in den Garten übernehmen" class="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1">
            <span>Auf Karte platzieren</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>` : `<div class="pt-1 flex items-center justify-between border-t border-stone-100">
          <span class="text-[11px] font-medium ${isMapped ? 'text-emerald-700' : 'text-stone-400'} flex items-center gap-1">
            <i data-lucide="${isMapped ? 'check-circle' : 'circle-dashed'}" class="w-3.5 h-3.5"></i>
            ${isMapped ? `${count}× auf Karte platziert` : 'Nicht auf Karte'}
          </span>
          <div class="flex items-center gap-3">
            ${isMapped ? `<button onclick="placePlantOnMap('${plant.id}')" title="Weiteres Exemplar platzieren" class="text-xs font-semibold text-stone-500 hover:text-brand-800 flex items-center gap-0.5">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Weitere</span>
            </button>` : ''}
            <button onclick="jumpToMapWithPlant('${plant.id}')" class="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1">
              <span>${isMapped ? 'Auf Karte ansehen' : 'Auf Karte platzieren'}</span>
              <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </button>
          </div>
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

// Records the death of one specimen (bed + light conditions + date) and
// removes that marker. The plant itself only becomes "deceased" when its
// last specimen dies.
function recordDeath(plant, bedId) {
  const bed = zones.find(z => z.id === bedId);
  const death = { bed: bed ? bed.name : null, sunlight: bed ? bed.sunlight : null, died_at: new Date().toISOString() };
  plant.deaths = [...(plant.deaths || []), death];
  return death;
}

function markPlantFullyDeceased(plant, death) {
  plant.status = 'deceased';
  plant.died_in_bed = death.bed;
  plant.died_bed_sunlight = death.sunlight;
  plant.died_at = death.died_at;
  plant.placements = [];
  syncLegacyPosition(plant);
}

async function markPlacementDeceased(placementId) {
  const found = findPlacement(placementId);
  if (!found) return;
  const { plant, placement } = found;
  const death = recordDeath(plant, placement.bed_id);
  removePlacementFromPlant(plant, placementId);
  const lastOne = placementCount(plant) === 0 && plant.status === 'garden';
  if (lastOne) markPlantFullyDeceased(plant, death);
  await syncSavePlant(plant);
  if (selectedPlacementId === placementId) closeSelectedBar();
  renderPlantList();
  renderMap();
  showToast(
    lastOne
      ? `${plant.name} als verstorben markiert${death.bed ? ` (Beet: ${death.bed})` : ''}`
      : `Exemplar von ${plant.name} als verstorben vermerkt${death.bed ? ` (Beet: ${death.bed})` : ''} – ${placementCount(plant)}× noch auf der Karte`,
    '🪦'
  );
}

function confirmMarkPlacementDeceased(placementId) {
  const found = findPlacement(placementId);
  if (!found) return;
  const { plant, placement } = found;
  const bed = zones.find(z => z.id === placement.bed_id);
  const others = placementCount(plant) - 1;
  showConfirmDialog(
    others > 0 ? 'Exemplar als verstorben markieren?' : 'Pflanze als verstorben markieren?',
    `Dieses Exemplar von "${plant.name}" wird von der Karte entfernt${bed ? ` und das Beet "${bed.name}" als Sterbeort festgehalten` : ''}.${others > 0 ? ` Die Pflanze bleibt mit ${others} weiteren Exemplar${others === 1 ? '' : 'en'} im Verzeichnis lebend.` : ' Die Pflanze wird im Verzeichnis als verstorben geführt.'}`,
    () => markPlacementDeceased(placementId),
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
    document.getElementById('btn-modal-delete-plant').classList.remove('hidden');
  } else {
    document.getElementById('btn-modal-delete-plant').classList.add('hidden');
    title.innerText = 'Neue Pflanze hinzufügen';
    form.reset();
    document.getElementById('plant-id').value = '';
    // Pre-select the status matching the active directory filter
    const statusFilter = document.getElementById('select-status-filter').value;
    document.getElementById('form-status').value = ['garden', 'wishlist'].includes(statusFilter) ? statusFilter : 'garden';
    if (lightFilter !== 'all') document.getElementById('form-sunlight').value = lightFilter;
  }

  modal.classList.remove('hidden');
}

function closePlantModal() {
  document.getElementById('modal-plant-form').classList.add('hidden');
}

async function handlePlantFormSubmit(e, skipDuplicateCheck = false) {
  e.preventDefault();
  const id = document.getElementById('plant-id').value;

  const existing = id ? plants.find(p => p.id === id) : null;

  // Duplicate guard: same name already in the directory (new plants or renames)
  if (!skipDuplicateCheck) {
    const name = document.getElementById('form-name').value.trim().toLowerCase();
    const dupes = plants.filter(p => p.id !== id && (p.name || '').trim().toLowerCase() === name);
    if (dupes.length > 0) {
      const d = dupes[0];
      const where = d.status === 'wishlist' ? 'auf der Wunschliste' : d.status === 'deceased' ? 'als verstorben' : placementCount(d) > 0 ? `${placementCount(d)}× auf der Karte` : 'im Garten';
      showConfirmDialog(
        'Pflanze existiert bereits',
        `"${d.name}" ist schon im Verzeichnis (${where}). Trotzdem als eigenen Eintrag anlegen? Mehrere Exemplare kannst du auch über „Weitere“ auf der Karte platzieren.`,
        () => handlePlantFormSubmit(e, true),
        'Trotzdem anlegen',
        'neutral'
      );
      return;
    }
  }

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
    placements: existing ? [...(existing.placements || [])] : [],
    deaths: existing ? [...(existing.deaths || [])] : [],
    died_in_bed: existing ? existing.died_in_bed || null : null,
    died_bed_sunlight: existing ? existing.died_bed_sunlight || null : null,
    died_at: existing ? existing.died_at || null : null,
    wished_by: existing ? existing.wished_by || null : null
  };

  // Attribute the wish to whoever is using the app when it (newly) lands on the wishlist
  if (plantData.status === 'wishlist' && (!existing || existing.status !== 'wishlist' || !plantData.wished_by)) {
    plantData.wished_by = currentUser || plantData.wished_by;
  }

  let removedFromMap = 0;
  if (plantData.status === 'deceased') {
    if (!existing || existing.status !== 'deceased') {
      // Every specimen still on the map dies with its bed recorded
      const placed = plantData.placements;
      if (placed.length > 0) placed.forEach(pl => recordDeath(plantData, pl.bed_id));
      else recordDeath(plantData, null);
      markPlantFullyDeceased(plantData, plantData.deaths[plantData.deaths.length - 1]);
    }
    plantData.placements = [];
  } else if (existing && existing.status === 'deceased') {
    // Revived / corrected: clear the current death record (history stays)
    plantData.died_in_bed = null;
    plantData.died_bed_sunlight = null;
    plantData.died_at = null;
  }
  if (plantData.status === 'wishlist' && plantData.placements.length > 0) {
    removedFromMap = plantData.placements.length;
    plantData.placements = [];
  }
  syncLegacyPosition(plantData);

  if (id) {
    const idx = plants.findIndex(p => p.id === id);
    if (idx !== -1) plants[idx] = plantData;
    showToast(removedFromMap > 0 ? `${plantData.name} aktualisiert – ${removedFromMap}× von der Karte entfernt (Wunschliste)` : `${plantData.name} aktualisiert`, '🌱');
  } else {
    plants.push(plantData);
    showToast(`${plantData.name} hinzugefügt`, '🌱');
  }

  await syncSavePlant(plantData);
  renderPlantList();
  renderMap();
  closePlantModal();
}

function deletePlantFromModal() {
  const plantId = document.getElementById('plant-id').value;
  if (!plantId) return;
  closePlantModal();
  deletePlant(plantId);
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
      if (selectedPlacementId && !findPlacement(selectedPlacementId)) closeSelectedBar();
      showToast('Pflanze gelöscht', '🗑️');
    }
  );
}
