import { getTrainStationsByRamal } from './api.js';

const RAMALES_MAP = {
    141: 'Mitre',
    151: 'Mitre',
    31: 'Sarmiento',
    65: 'Roca',
    131: 'San Martin',
};

const TRENES_LINEAS_JSON_PATH = './datos/trenes-lineas.json';
const TRENES_RAMALES_JSON_PATH = './datos/trenes-ramales.json';

let trenesLineas = [];
let trenesLineasLoaded = false;
let trenesRamales = [];
let trenesRamalesLoaded = false;
const ramalStationsCache = new Map();

export function getStationLineFromRamales(ramales = []) {
    const mappedNames = Array.from(new Set(
        ramales
            .map(ramalId => RAMALES_MAP[Number(ramalId)])
            .filter(Boolean),
    ));

    return mappedNames.length > 0 ? mappedNames.join(' / ') : 'Tren';
}

function normalizeTrenesResponse(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && Array.isArray(payload.results)) {
        return payload.results;
    }

    if (payload && Array.isArray(payload.data)) {
        return payload.data;
    }

    if (payload && Array.isArray(payload.entity)) {
        return payload.entity;
    }

    return [];
}

async function ensureTrenesLineasLoaded() {
    if (trenesLineasLoaded && Array.isArray(trenesLineas) && trenesLineas.length > 0) {
        return;
    }

    try {
        const response = await fetch(TRENES_LINEAS_JSON_PATH);
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
        }

        const payload = await response.json();
        trenesLineas = Array.isArray(payload) ? payload : [];
        trenesLineasLoaded = true;
    } catch (error) {
        console.error('Error al cargar lineas estaticas:', error);
        trenesLineas = [];
    }
}

async function ensureTrenesRamalesLoaded() {
    if (trenesRamalesLoaded && Array.isArray(trenesRamales) && trenesRamales.length > 0) {
        return;
    }

    try {
        const response = await fetch(TRENES_RAMALES_JSON_PATH);
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
        }

        const payload = await response.json();
        trenesRamales = Array.isArray(payload) ? payload : [];
        trenesRamalesLoaded = true;
    } catch (error) {
        console.error('Error al cargar ramales estaticos:', error);
        trenesRamales = [];
    }
}

async function loadTrainStationsForRamal(idRamal) {
    try {
        const payload = await getTrainStationsByRamal(idRamal);
        return normalizeTrenesResponse(payload).sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || '')));
    } catch (error) {
        console.error(`Error al cargar estaciones del ramal ${idRamal}:`, error);
        return [];
    }
}

function renderRamalStationsButtons(stations = []) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return '<p class="empty">No hay estaciones disponibles para este ramal.</p>';
    }

    return stations.map(estacion => {
        const stationId = estacion?.id_estacion || estacion?.id || estacion?.station_id || '';
        const stationName = estacion?.nombre || 'Estacion';

        return `
      <button type="button" class="train-station-card" data-card-action="open-station" data-station-id="${stationId}">
        <span class="train-station-name">${stationName}</span>
        <span class="train-station-action">Ver detalle</span>
      </button>
    `;
    }).join('');
}

async function ensureRamalStationsLoaded(ramalId, container) {
    if (!container || !ramalId) {
        return;
    }

    const cacheKey = String(ramalId);
    if (ramalStationsCache.has(cacheKey)) {
        container.innerHTML = renderRamalStationsButtons(ramalStationsCache.get(cacheKey));
        return;
    }

    container.innerHTML = '<p class="empty">Cargando estaciones...</p>';
    const stations = await loadTrainStationsForRamal(ramalId);
    ramalStationsCache.set(cacheKey, stations);
    container.innerHTML = renderRamalStationsButtons(stations);
}

async function renderTrenesLines(data, listContainerId = 'trenesList') {
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;

    if (!Array.isArray(data) || data.length === 0) {
        listContainer.innerHTML = '<p class="empty">No se encontraron lineas de trenes.</p>';
        return;
    }

    const lineMarkup = await Promise.all(data.map(async linea => {
        const hasAlerts = Array.isArray(linea.alerta) && linea.alerta.length > 0;
        const lineaRamales = trenesRamales
            .filter(ramal => Number(ramal.id_gerencia) === Number(linea.id))
            .sort((a, b) => Number(a?.orden_ramal || 0) - Number(b?.orden_ramal || 0) || String(a?.nombre || '').localeCompare(String(b?.nombre || '')));

        const ramalesMarkup = lineaRamales.map(ramal => {
            const ramalHasAlerts = Array.isArray(ramal.alerta) && ramal.alerta.length > 0;
            const estacionInicial = ramal.cabecera_inicial?.nombre || 'Estacion inicial';
            const estacionFinal = ramal.cabecera_final?.nombre || 'Estacion final';

            return `
        <details class="trenes-ramal-details" data-ramal-id="${ramal.id}">
          <summary class="trenes-ramal-summary">
            <p class="ramal-nombre">${ramal.nombre}</p>
            ${ramalHasAlerts ? '<span class="train-alert-icon" aria-hidden="true">●</span>' : ''}
          </summary>
          <div class="ramal-estaciones">
            <p class="estaciones-title">Recorrido: ${estacionInicial} -> ${estacionFinal}</p>
            <p class="estaciones-count">${ramal.estaciones} estaciones</p>
            <div class="ramal-stations-list" data-ramal-stations="${ramal.id}">
              <p class="empty">Desplega este ramal para cargar estaciones.</p>
            </div>
          </div>
        </details>
      `;
        });

        return `
      <details class="trenes-line-details" data-linea-id="${linea.id}">
        <summary class="trenes-line-summary">
          <div class="trenes-line-header">
            <p class="trenes-line-name">${linea.nombre}</p>
            <div class="trenes-line-info">
              ${hasAlerts ? '<span class="train-alert-icon" aria-hidden="true">●</span>' : ''}
            </div>
          </div>
        </summary>
        <div class="trenes-ramales-container">
          ${ramalesMarkup.length > 0 ? ramalesMarkup.join('') : '<p class="empty">No hay ramales disponibles para esta linea.</p>'}
        </div>
      </details>
    `;
    }));

    listContainer.innerHTML = lineMarkup.join('');
}

export async function openTrenesView(navigateTo, listContainerId = 'trenesList') {
    const trenesList = document.getElementById(listContainerId);
    if (trenesList) trenesList.innerHTML = '<p class="empty">Cargando lineas de trenes...</p>';
    navigateTo('trenes');

    await ensureTrenesLineasLoaded();
    await ensureTrenesRamalesLoaded();
    await renderTrenesLines(trenesLineas.filter(linea => linea.nombre !== 'Regionales'), listContainerId);
}

export function handleTrenesListInteraction(event) {
    const listId = event.currentTarget.id;
    if (listId !== 'trenesList') {
        return false;
    }

    const ramalSummary = event.target.closest('.trenes-ramal-summary');
    if (ramalSummary) {
        const ramalDetails = ramalSummary.closest('.trenes-ramal-details');
        const ramalId = ramalDetails?.dataset.ramalId;
        if (ramalDetails && ramalId) {
            setTimeout(() => {
                if (ramalDetails.open) {
                    const stationsContainer = ramalDetails.querySelector('[data-ramal-stations]');
                    ensureRamalStationsLoaded(ramalId, stationsContainer);
                }
            }, 0);
        }
    }

    const actionButton = event.target.closest('[data-card-action]');
    if (!actionButton) {
        return false;
    }

    const action = actionButton.dataset.cardAction;
    if (action !== 'open-station') {
        return false;
    }

    const stationCard = event.target.closest('[data-station-id]');
    const stationId = stationCard?.dataset.stationId;
    if (stationId) {
        window.location.href = `./detail.html?id=${encodeURIComponent(stationId)}`;
    }
    return true;
}
