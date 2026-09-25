// --- PLANT PLACEMENTS & DEATH HISTORY HELPERS ---
// A plant (species) can be placed on the map multiple times. Each placement
// is { id, bed_id, x, y }. Deaths of single specimens are kept in
// plant.deaths as { bed, sunlight, died_at }.

const MAP_CENTER = { x: 450, y: 300 };

// Upgrades legacy records (single x_pos/y_pos/bed_id) to the placements model.
function normalizePlant(plant) {
  if (!Array.isArray(plant.placements)) plant.placements = [];
  if (plant.placements.length === 0 && plant.x_pos != null && plant.y_pos != null) {
    plant.placements.push({ id: `${plant.id}_1`, bed_id: plant.bed_id || null, x: plant.x_pos, y: plant.y_pos });
  }
  if (!Array.isArray(plant.deaths)) plant.deaths = [];
  syncLegacyPosition(plant);
  return plant;
}

// Mirrors the first placement into the legacy columns so older clients and
// existing Supabase rows keep a meaningful position.
function syncLegacyPosition(plant) {
  const first = plant.placements[0];
  plant.x_pos = first ? first.x : null;
  plant.y_pos = first ? first.y : null;
  plant.bed_id = first ? first.bed_id : null;
}

function bedIdAt(x, y) {
  const zone = zones.find(z => {
    const zw = z.width || z.w || 300;
    const zh = z.height || z.h || 200;
    return x >= z.x && x <= (z.x + zw) && y >= z.y && y <= (z.y + zh);
  });
  return zone ? zone.id : null;
}

function findPlacement(placementId) {
  for (const plant of plants) {
    const placement = (plant.placements || []).find(pl => pl.id === placementId);
    if (placement) return { plant, placement };
  }
  return null;
}

function addPlacement(plant, x = MAP_CENTER.x, y = MAP_CENTER.y) {
  normalizePlant(plant);
  const placement = { id: `${plant.id}_${Date.now()}`, bed_id: bedIdAt(x, y), x, y };
  plant.placements.push(placement);
  syncLegacyPosition(plant);
  return placement;
}

function removePlacementFromPlant(plant, placementId) {
  plant.placements = (plant.placements || []).filter(pl => pl.id !== placementId);
  syncLegacyPosition(plant);
}

function placementsInBed(zoneId) {
  const result = [];
  plants.forEach(plant => (plant.placements || []).forEach(pl => {
    if (pl.bed_id === zoneId) result.push({ plant, placement: pl });
  }));
  return result;
}

function placementCount(plant) {
  return (plant.placements || []).length;
}

function isPlaceable(plant) {
  return plant.status === 'garden';
}
