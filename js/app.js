// --- APP BOOTSTRAP ---

window.addEventListener('DOMContentLoaded', async () => {
  initSupabaseFromStorage();
  loadSqlScript();
  await fetchAllData();
  renderPlantList();
  renderMap();
  lucide.createIcons();
});
