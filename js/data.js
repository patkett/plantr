// --- SAMPLE STARTER DATA ---
// Seed data used the first time the app runs (no Supabase connection
// and no LocalStorage data yet).

const DEFAULT_PLANTS = [
  {
    id: 'p1',
    name: 'Lavender (Munstead)',
    botanical_name: 'Lavandula angustifolia',
    emoji: '🪻',
    status: 'garden',
    sunlight: 'Full Sun',
    water: 'Low',
    soil: 'Well-Drained',
    category: 'Perennial',
    notes: 'Needs plenty of direct sun and light watering. Great for pollinators.',
    x_pos: 120,
    y_pos: 110,
    bed_id: 'z1'
  },
  {
    id: 'p2',
    name: 'Japanese Forest Grass',
    botanical_name: 'Hakonechloa macra',
    emoji: '🌾',
    status: 'garden',
    sunlight: 'Partial Shade',
    water: 'Moderate',
    soil: 'Moist & Rich',
    category: 'Perennial',
    notes: 'Flowing golden-green foliage. Beautiful in shady borders.',
    x_pos: 520,
    y_pos: 130,
    bed_id: 'z2'
  },
  {
    id: 'p3',
    name: 'Hostas (Empress Wu)',
    botanical_name: 'Hosta hybrid',
    emoji: '🍃',
    status: 'garden',
    sunlight: 'Full Shade',
    water: 'Moderate',
    soil: 'Moist & Rich',
    category: 'Perennial',
    notes: 'Keep soil consistently damp. Watch for garden slugs.',
    x_pos: 550,
    y_pos: 400,
    bed_id: 'z3'
  },
  {
    id: 'p4',
    name: 'Sun Gold Cherry Tomato',
    botanical_name: 'Solanum lycopersicum',
    emoji: '🍅',
    status: 'wishlist',
    sunlight: 'Full Sun',
    water: 'High',
    soil: 'Moist & Rich',
    category: 'Vegetable',
    notes: 'Plan for tomato cage support along south deck.',
    x_pos: null,
    y_pos: null,
    bed_id: null
  }
];

const DEFAULT_ZONES = [
  {
    id: 'z1',
    name: 'South Sun Deck Bed',
    sunlight: 'Full Sun',
    x: 50,
    y: 50,
    width: 320,
    height: 220
  },
  {
    id: 'z2',
    name: 'Patio Partial Shade Border',
    sunlight: 'Partial Shade',
    x: 450,
    y: 50,
    width: 380,
    height: 240
  },
  {
    id: 'z3',
    name: 'North Fence Shade Nook',
    sunlight: 'Full Shade',
    x: 450,
    y: 330,
    width: 380,
    height: 250
  }
];
