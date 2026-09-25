// --- APPLICATION STATE ---
// Shared mutable state used across the other modules.

let supabaseClient = null;
let isConnectedToSupabase = false;
let plants = [];
let zones = [];
let activeTab = 'directory';
let lightFilter = 'all';
let selectedPlantId = null;
