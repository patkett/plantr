// --- MAP VIEWPORT: ZOOM, PANNING, PINCH AND TAP-TO-DESELECT ---
// Depends on the geometry constants and marker/zone state in map.js.

let mapZoom = 1;
const MAP_ZOOM_MAX = 2.5;
const MAP_ZOOM_MIN_CAP = 0.5;   // never start more zoomed-out than this
const MAP_ZOOM_MIN_FLOOR = 0.1;
const VIEWPORT_PADDING = 48;    // p-6 on both sides of #map-viewport

// Smallest zoom level: the whole ground fits into the viewport
function getMinMapZoom() {
  const viewport = document.getElementById('map-viewport');
  if (!viewport || viewport.clientWidth === 0) return 0.25;
  const fit = Math.min((viewport.clientWidth - VIEWPORT_PADDING) / MAP_W, (viewport.clientHeight - VIEWPORT_PADDING) / MAP_H);
  return clamp(fit, MAP_ZOOM_MIN_FLOOR, MAP_ZOOM_MIN_CAP);
}

function setMapZoom(newZoom) {
  mapZoom = clamp(newZoom, getMinMapZoom(), MAP_ZOOM_MAX);
  const canvas = document.getElementById('garden-canvas');
  const wrapper = document.getElementById('canvas-zoom-wrapper');
  if (canvas) canvas.style.transform = `scale(${mapZoom})`;
  if (wrapper) {
    wrapper.style.width = `${MAP_W * mapZoom}px`;
    wrapper.style.height = `${MAP_H * mapZoom}px`;
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

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function isInteractiveMapTarget(target) {
  return !!(
    target.closest('[data-plant-id]') ||
    target.closest('.zone-resize-handle') ||
    target.closest('.zone-editing') ||
    target.closest('#map-selected-bar') ||
    target.closest('#map-zone-bar') ||
    target.closest('button')
  );
}

function startMapPan(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (isInteractiveMapTarget(e.target)) return;
  if (draggingPlacementId || activeResizeZoneId || movingZoneId) return;

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
  if (e.touches.length === 2) {
    // Pinch always zooms, even when a finger lands on a marker or bed
    if (draggingPlacementId || activeResizeZoneId || movingZoneId) return;
    if (e.cancelable) e.preventDefault();
    isPanning = false;
    pinchStartDistance = getTouchDistance(e.touches);
    pinchStartZoom = mapZoom;
  } else if (e.touches.length === 1) {
    if (isInteractiveMapTarget(e.target)) return;
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

  applyMapGeometry();
  // Re-apply the zoom bounds when the viewport changes size (rotation, resize)
  const reclampZoom = () => setMapZoom(mapZoom);
  window.addEventListener('resize', reclampZoom);
  window.addEventListener('orientationchange', reclampZoom);

  viewport.addEventListener('mousedown', startMapPan);
  window.addEventListener('mousemove', onMapPan);
  window.addEventListener('mouseup', stopMapPan);

  viewport.addEventListener('touchstart', handleViewportTouchStart, { passive: false });
  viewport.addEventListener('touchmove', handleViewportTouchMove, { passive: false });
  viewport.addEventListener('touchend', handleViewportTouchEnd);
  viewport.addEventListener('touchcancel', handleViewportTouchEnd);

  viewport.addEventListener('wheel', handleViewportWheel, { passive: false });

  // A tap (not a drag) on empty map space deselects plant / closes bed bar / ends resize mode
  let tapStartX = 0, tapStartY = 0;
  const rememberTapStart = (x, y) => { tapStartX = x; tapStartY = y; };
  viewport.addEventListener('mousedown', (e) => rememberTapStart(e.clientX, e.clientY));
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) rememberTapStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  const handleEmptyTap = (x, y, target) => {
    if (Math.abs(x - tapStartX) > 8 || Math.abs(y - tapStartY) > 8) return; // it was a drag
    if (isInteractiveMapTarget(target)) return;
    let changed = false;
    if (resizingZoneId) { resizingZoneId = null; changed = true; }
    if (editingZoneId) { closeZoneBar(false); changed = true; }
    if (selectedPlacementId) {
      selectedPlacementId = null;
      document.getElementById('map-selected-bar').classList.add('hidden');
      changed = true;
    }
    if (changed) renderMap();
  };
  viewport.addEventListener('click', (e) => handleEmptyTap(e.clientX, e.clientY, e.target));
  viewport.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const tch = e.changedTouches[0];
      handleEmptyTap(tch.clientX, tch.clientY, e.target);
    }
  });
}
