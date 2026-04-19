const STORAGE_PREFIX = 'viajero-amba';
const FAVORITES_STORAGE_KEY = 'favoriteTransportItems';

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

let favoriteItems = loadData(FAVORITES_STORAGE_KEY);
if (!Array.isArray(favoriteItems)) favoriteItems = [];

export function getFavoriteItems() {
  return favoriteItems;
}

export function getFavoriteItemId(data, source) {
  const tripUpdate = data?.trip_update || data?.tripUpdate || {};
  const vehicle = data?.vehicle || data?.Vehicle || {};
  const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
  const routeName = String(data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'sin-linea').trim().toLowerCase();
  const tripId = String(trip.trip_id || trip.tripId || data?.trip_id || data?.tripId || data?.id || '').trim().toLowerCase();
  const vehicleId = String(vehicle.vehicle?.id || vehicle.id || '').trim().toLowerCase();

  return `${source}:${routeName}:${tripId || vehicleId || 'item'}`;
}

export function isFavoriteItem(data, source) {
  const favoriteId = getFavoriteItemId(data, source);
  return favoriteItems.some(item => item.favoriteId === favoriteId);
}

function buildFavoriteRecord(data, source) {
  const tripUpdate = data?.trip_update || data?.tripUpdate || {};
  const vehicle = data?.vehicle || data?.Vehicle || {};
  const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
  const routeShortName = data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'Sin línea';
  const routeLongName = data?.route_long_name || trip.route_long_name || trip.routeLongName || '';
  const headsign = trip.trip_headsign || trip.tripHeadsign || data?.trip?.trip_headsign || 'Sin destino';
  const favoriteId = getFavoriteItemId(data, source);

  return {
    favoriteId,
    source,
    savedAt: new Date().toISOString(),
    title: source === 'subtes' ? `Subte ${String(routeShortName).replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim()}` : `Línea ${routeShortName}`,
    subtitle: routeLongName || headsign,
    data,
  };
}

export function toggleFavoriteItem(data, source) {
  const favoriteId = getFavoriteItemId(data, source);
  const existingIndex = favoriteItems.findIndex(item => item.favoriteId === favoriteId);

  if (existingIndex >= 0) {
    favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
  } else {
    favoriteItems = [buildFavoriteRecord(data, source), ...favoriteItems];
  }

  saveData(FAVORITES_STORAGE_KEY, favoriteItems);
  return favoriteItems;
}

export function removeFavoriteItem(favoriteId) {
  favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
  saveData(FAVORITES_STORAGE_KEY, favoriteItems);
  return favoriteItems;
}
