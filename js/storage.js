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
