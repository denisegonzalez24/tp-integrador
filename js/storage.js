const STORAGE_PREFIX = 'viajero-amba';

function storageKey(key) {
  return `${STORAGE_PREFIX}:${key}`;
}

export function saveData(key, value) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch (error) {
    console.error('No se pudo guardar en localStorage:', error);
  }
}

export function loadData(key) {
  try {
    const raw = localStorage.getItem(storageKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('No se pudo leer de localStorage:', error);
    return null;
  }
}

export function clearData(key) {
  try {
    localStorage.removeItem(storageKey(key));
  } catch (error) {
    console.error('No se pudo borrar de localStorage:', error);
  }
}

export function getFavoriteItems() {
  return loadData('favorites') || [];
}

export function isFavoriteItem(item, source) {
  const items = getFavoriteItems();
  const itemId = String(item._ui_id || item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.route_id || item.routeId || '');
  const favoriteId = `${source}-${itemId}`;
  return items.some(fav => fav.favoriteId === favoriteId);
}

export function toggleFavoriteItem(item, source) {
  const items = getFavoriteItems();
  const itemId = String(item._ui_id || item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.route_id || item.routeId || '');
  const favoriteId = `${source}-${itemId}`;
  const existingIndex = items.findIndex(fav => fav.favoriteId === favoriteId);

  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
  } else {
    let title = item.route_short_name || item.route_id || item.routeId || item.trip?.route_id || 'Sin línea';
    let subtitle = item.trip?.trip_headsign || item.route_long_name || 'Recorrido';
    items.push({ favoriteId, source, title: `Línea ${title}`, subtitle, data: item });
  }
  saveData('favorites', items);
}

export function removeFavoriteItem(favoriteId) {
  const items = getFavoriteItems();
  const filtered = items.filter(fav => fav.favoriteId !== favoriteId);
  saveData('favorites', filtered);
}
