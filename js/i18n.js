// --- SIMPLE DISPLAY-LABEL TRANSLATIONS (DE) ---
// Internal data values (sunlight/water/soil/category/status) stay in
// English so they keep working as stable keys for filtering, comparisons,
// <select> values, and Supabase storage. This dictionary only translates
// what is SHOWN to the user; call t(value) wherever such a value is
// rendered as visible text.

const LABELS_DE = {
  'Full Sun': 'Volle Sonne',
  'Partial Shade': 'Teilschatten',
  'Full Shade': 'Vollschatten',
  'Low': 'Niedrig',
  'Moderate': 'Mittel',
  'High': 'Hoch',
  'Well-Drained': 'Gut durchlässig',
  'Moist & Rich': 'Feucht & nährstoffreich',
  'Sandy / Dry': 'Sandig / trocken',
  'Clay / Heavy': 'Lehmig / schwer',
  'Perennial': 'Staude',
  'Annual': 'Einjährig',
  'Vegetable': 'Gemüse',
  'Herb': 'Kraut',
  'Shrub': 'Strauch',
  'Tree': 'Baum',
  'Succulent': 'Sukkulente',
  'garden': 'Im Garten',
  'wishlist': 'Wunschliste',
  'deceased': 'Verstorben'
};

function t(value) {
  return LABELS_DE[value] || value;
}
