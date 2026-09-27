// --- STATISTIKEN ---
// Derived from placements (living specimens) and deaths (with planted_at /
// died_at). Everything is computed on the fly from the in-memory state.

const STATS_MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Days between two dates (second defaults to today); null if unknown
function statsDays(from, to) {
  const a = parseDate(from);
  if (!a) return null;
  const b = parseDate(to) || new Date();
  const d = Math.floor((b - a) / 86400000);
  return isNaN(d) || d < 0 ? null : d;
}

function statsDuration(days) {
  if (days === null) return '–';
  if (days < 30) return `${days} T.`;
  if (days < 365) return `${Math.round(days / 30.44)} Mo.`;
  const years = days / 365.25;
  return `${years < 10 ? years.toFixed(1).replace('.', ',') : Math.round(years)} J.`;
}

const statsAvg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const statsPct = (part, total) => total ? Math.round((part / total) * 100) : null;

// Flat list of every specimen ever placed: { plant, bed, sunlight, planted_at, died_at, alive }
function statsSpecimens() {
  const rows = [];
  plants.forEach(plant => {
    (plant.placements || []).forEach(pl => {
      const bed = zones.find(z => z.id === pl.bed_id);
      rows.push({ plant, bed: bed ? bed.name : null, sunlight: bed ? bed.sunlight : null, planted_at: pl.planted_at || null, died_at: null, alive: true });
    });
    (plant.deaths || []).forEach(d => {
      rows.push({ plant, bed: d.bed || null, sunlight: d.sunlight || null, planted_at: d.planted_at || null, died_at: d.died_at || null, alive: false });
    });
  });
  return rows;
}

function statsGroup(rows, keyFn) {
  const map = new Map();
  rows.forEach(r => {
    const key = keyFn(r);
    if (key === null || key === undefined) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return map;
}

// Survival summary for a group of specimens
function statsSummary(rows) {
  const alive = rows.filter(r => r.alive).length;
  const dead = rows.length - alive;
  const lifespans = rows.map(r => statsDays(r.planted_at, r.alive ? null : r.died_at)).filter(d => d !== null);
  return { total: rows.length, alive, dead, survival: statsPct(alive, rows.length), avgDays: statsAvg(lifespans) };
}

function statsBar(pct, colorClass = 'bg-brand-600') {
  const v = pct === null ? 0 : pct;
  return `<div class="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden"><div class="h-full rounded-full ${colorClass}" style="width:${v}%"></div></div>`;
}

function statsCard(title, subtitle, icon, body) {
  return `<div class="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-3">
    <div class="flex items-start gap-2.5">
      <div class="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0"><i data-lucide="${icon}" class="w-5 h-5"></i></div>
      <div class="min-w-0">
        <h3 class="font-bold text-stone-800 text-sm leading-tight">${title}</h3>
        <p class="text-[11px] text-stone-500 mt-0.5 leading-snug">${subtitle}</p>
      </div>
    </div>
    ${body}
  </div>`;
}

const statsEmpty = text => `<p class="text-xs text-stone-400 italic">${text}</p>`;

// Row: label · N Exemplare · survival bar · rate
function statsRateRow(label, s, extra = '') {
  const color = s.survival === null ? 'bg-stone-300' : s.survival >= 75 ? 'bg-emerald-500' : s.survival >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return `<div class="space-y-1">
    <div class="flex items-baseline justify-between gap-3 text-xs">
      <span class="font-medium text-stone-700 truncate">${label}</span>
      <span class="shrink-0 tabular-nums text-stone-500">${s.alive}/${s.total} leben${s.survival !== null ? ` · <strong class="text-stone-700">${s.survival} %</strong>` : ''}${extra}</span>
    </div>
    ${statsBar(s.survival, color)}
  </div>`;
}

function renderStats() {
  const container = document.getElementById('stats-container');
  if (!container) return;
  const rows = statsSpecimens();
  const withBed = rows.filter(r => r.bed);
  const cards = [];

  // Overview
  const living = plants.filter(p => p.status === 'garden').length;
  const wishlist = plants.filter(p => p.status === 'wishlist').length;
  const deceased = plants.filter(p => p.status === 'deceased').length;
  const deadSpecimens = rows.filter(r => !r.alive).length;
  const aliveSpecimens = rows.filter(r => r.alive).length;
  const conflicts = rows.filter(r => r.alive && r.sunlight && r.sunlight !== r.plant.sunlight).length;
  const tile = (n, label) => `<div class="bg-stone-50 rounded-xl border border-stone-200/70 p-2.5 text-center"><div class="text-lg font-bold text-stone-800 tabular-nums">${n}</div><div class="text-[10px] text-stone-500 leading-tight">${label}</div></div>`;
  cards.push(statsCard('Gartenüberblick', 'Bestand nach Arten und Exemplaren', 'sprout', `
    <div class="grid grid-cols-3 gap-2">
      ${tile(living, 'Arten im Garten')}${tile(aliveSpecimens, 'Exemplare gepflanzt')}${tile(zones.length, 'Beete')}
      ${tile(wishlist, 'auf Wunschliste')}${tile(deadSpecimens, 'Exemplare verstorben')}${tile(deceased, 'Arten verloren')}
    </div>
    ${conflicts > 0 ? `<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">⚠️ ${conflicts} Exemplar${conflicts === 1 ? ' steht' : 'e stehen'} in einem Beet mit unpassendem Licht.</p>` : ''}`));

  // Location success: per bed and per light condition
  const byBed = statsGroup(withBed, r => r.bed);
  const byLight = statsGroup(withBed, r => r.sunlight);
  const bedRows = [...byBed.entries()].map(([bed, rs]) => ({ bed, s: statsSummary(rs) })).sort((a, b) => (b.s.survival ?? -1) - (a.s.survival ?? -1) || b.s.total - a.s.total);
  const lightRows = [...byLight.entries()].map(([light, rs]) => ({ light, s: statsSummary(rs) })).sort((a, b) => (b.s.survival ?? -1) - (a.s.survival ?? -1));
  cards.push(statsCard('Standort-Erfolg', 'Überlebensrate der Exemplare pro Beet und Lichtverhältnis', 'map-pin', bedRows.length === 0 ? statsEmpty('Noch keine Exemplare in Beeten platziert.') : `
    <div class="space-y-2.5">${bedRows.map(({ bed, s }) => statsRateRow(bed, s, s.avgDays !== null ? ` · ø ${statsDuration(s.avgDays)}` : '')).join('')}</div>
    <div class="pt-2 border-t border-stone-100 space-y-2.5">
      <p class="text-[10px] font-bold uppercase tracking-wider text-stone-400">Nach Licht</p>
      ${lightRows.map(({ light, s }) => statsRateRow(sunLabel(light), s)).join('')}
    </div>`));

  // Best conditions per species (only species with at least one death and one bed)
  const speciesBest = plants.map(plant => {
    const rs = withBed.filter(r => r.plant === plant);
    if (rs.length < 2 || !rs.some(r => !r.alive)) return null;
    const groups = [...statsGroup(rs, r => r.sunlight).entries()].map(([light, g]) => ({ light, s: statsSummary(g) })).filter(g => g.s.survival !== null);
    if (groups.length < 2) return null;
    groups.sort((a, b) => b.s.survival - a.s.survival);
    return { plant, best: groups[0], worst: groups[groups.length - 1] };
  }).filter(Boolean);
  if (speciesBest.length > 0) {
    cards.push(statsCard('Was wo am besten gedeiht', 'Arten mit unterschiedlichem Erfolg je nach Licht', 'sun', `
      <div class="space-y-2 text-xs">${speciesBest.map(({ plant, best, worst }) => `<div class="flex items-baseline justify-between gap-3 border-t border-stone-100 first:border-t-0 pt-2 first:pt-0">
        <span class="font-medium text-stone-700 truncate">${plant.name}</span>
        <span class="shrink-0 text-stone-500 text-right">${sunLabel(best.light)} <strong class="text-emerald-700">${best.s.survival} %</strong> · ${sunLabel(worst.light)} <strong class="text-red-600">${worst.s.survival} %</strong></span>
      </div>`).join('')}</div>`));
  }

  // Average lifespan per species
  const lifeRows = plants.map(plant => {
    const dead = rows.filter(r => r.plant === plant && !r.alive).map(r => statsDays(r.planted_at, r.died_at)).filter(d => d !== null);
    const aliveAges = rows.filter(r => r.plant === plant && r.alive).map(r => statsDays(r.planted_at, null)).filter(d => d !== null);
    if (dead.length === 0 && aliveAges.length === 0) return null;
    return { plant, deadCount: dead.length, avgDead: statsAvg(dead), oldest: aliveAges.length ? Math.max(...aliveAges) : null };
  }).filter(Boolean).sort((a, b) => (b.avgDead ?? b.oldest ?? 0) - (a.avgDead ?? a.oldest ?? 0));
  cards.push(statsCard('Lebensdauer pro Art', 'Ø Lebensdauer verstorbener Exemplare und Alter des ältesten lebenden', 'hourglass', lifeRows.length === 0 ? statsEmpty('Sobald Exemplare ein Pflanzdatum haben, erscheint hier ihre Lebensdauer.') : `
    <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-xs items-baseline">
      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-400">Art</span>
      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-400 text-right">Ø bis Tod</span>
      <span class="text-[10px] font-bold uppercase tracking-wider text-stone-400 text-right">Ältestes</span>
      ${lifeRows.map(({ plant, deadCount, avgDead, oldest }) => `
        <span class="font-medium text-stone-700 truncate">${plant.name}</span>
        <span class="text-right tabular-nums ${avgDead === null ? 'text-stone-300' : 'text-stone-700'}">${avgDead === null ? '–' : `${statsDuration(avgDead)} <span class="text-stone-400">(${deadCount}×)</span>`}</span>
        <span class="text-right tabular-nums ${oldest === null ? 'text-stone-300' : 'text-emerald-700'}">${oldest === null ? '–' : statsDuration(oldest)}</span>`).join('')}
    </div>`));

  // Seasonal survival: planting month vs. mortality
  const dated = rows.filter(r => r.planted_at && parseDate(r.planted_at));
  const byMonth = statsGroup(dated, r => parseDate(r.planted_at).getMonth());
  const monthRows = [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([m, rs]) => ({ m, s: statsSummary(rs) }));
  const seasons = [['Frühjahr', [2, 3, 4]], ['Sommer', [5, 6, 7]], ['Herbst', [8, 9, 10]], ['Winter', [11, 0, 1]]]
    .map(([name, months]) => ({ name, s: statsSummary(dated.filter(r => months.includes(parseDate(r.planted_at).getMonth()))) }))
    .filter(x => x.s.total > 0);
  cards.push(statsCard('Saisonale Überlebensrate', 'Pflanzmonat im Vergleich zur Sterblichkeit – zeigt gute Pflanzfenster', 'calendar-range', dated.length === 0 ? statsEmpty('Noch keine Exemplare mit Pflanzdatum.') : `
    <div class="space-y-2.5">${seasons.map(({ name, s }) => statsRateRow(name, s)).join('')}</div>
    <div class="pt-2 border-t border-stone-100">
      <p class="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Nach Monat</p>
      <div class="grid grid-cols-6 gap-1.5">${STATS_MONTHS.map((label, i) => {
        const row = monthRows.find(r => r.m === i);
        const s = row ? row.s : null;
        const color = !s || s.survival === null ? 'bg-stone-100 text-stone-400' : s.survival >= 75 ? 'bg-emerald-100 text-emerald-800' : s.survival >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
        return `<div class="rounded-lg ${color} p-1.5 text-center"><div class="text-[10px] font-semibold">${label}</div><div class="text-xs font-bold tabular-nums">${s ? `${s.survival} %` : '–'}</div><div class="text-[9px] opacity-70">${s ? `${s.total}×` : ''}</div></div>`;
      }).join('')}</div>
    </div>`));

  // Plantings per year
  const byYear = statsGroup(dated, r => parseDate(r.planted_at).getFullYear());
  const yearRows = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, rs]) => ({ y, s: statsSummary(rs) }));
  if (yearRows.length > 0) {
    cards.push(statsCard('Pflanzungen pro Jahr', 'Wie viel gepflanzt wurde und wie viel davon noch lebt', 'trending-up', `
      <div class="space-y-2.5">${yearRows.map(({ y, s }) => statsRateRow(String(y), s)).join('')}</div>`));
  }

  container.innerHTML = cards.join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
