import { getTrainArrivalsByStation } from './api.js';

const ARRIVALS_COUNT = 5;

let currentStationId = '';
let currentSentido = 'todos';
let destinoSeleccionado = 'Todos';
let currentArrivals = [];

function normalizeArrivalsResponse(payload) {
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

function toDisplayTime(value) {
    if (!value) {
        return 'Sin horario';
    }

    if (typeof value === 'number') {
        const date = new Date(value * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (typeof value === 'string') {
        if (/^\d{2}:\d{2}/.test(value)) {
            return value.slice(0, 5);
        }

        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        return value;
    }

    return 'Sin horario';
}

function secondsToDisplayTime(seconds) {
    const safeSeconds = Number(seconds);
    if (!Number.isFinite(safeSeconds)) {
        return '';
    }

    if (safeSeconds <= 0) {
        return 'Llegando';
    }

    const minutes = Math.round(safeSeconds / 60);
    return `En ${minutes} min`;
}

function formatSecondsLabel(seconds) {
    const safeSeconds = Number(seconds);
    if (!Number.isFinite(safeSeconds)) {
        return 'Sin estimacion';
    }

    if (safeSeconds <= 0) {
        return 'Llegando';
    }

    const minutes = Math.round(safeSeconds / 60);
    return `En ${minutes} min`;
}

function getStationName(item) {
    return item?.arribo?.nombre || item?.servicio?.desde?.estacion?.nombre || 'Estacion';
}

function getLineName(item) {
    return item?.servicio?.gerencia?.nombre || 'Tren';
}

function getServiceStatus(item) {
    return item?.servicio?.desde?.estado?.nombre || 'Normal';
}

function getServiceStatusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('demor')) {
        return 'status-warning';
    }
    if (normalized.includes('cancel')) {
        return 'status-warning';
    }
    if (normalized.includes('interrump')) {
        return 'status-warning';
    }

    return 'status-ok';
}

function getRouteLabel(item) {
    const from = item?.servicio?.ramal?.cabeceraInicial?.nombreCorto
        || item?.servicio?.ramal?.cabeceraInicial?.nombre
        || item?.servicio?.desde?.estacion?.nombre
        || 'Origen';
    const to = item?.servicio?.ramal?.cabeceraFinal?.nombreCorto
        || item?.servicio?.ramal?.cabeceraFinal?.nombre
        || getArrivalDestination(item)
        || 'Destino';

    return `${from} - ${to}`;
}

function getDirectionLabel(item) {
    const explicit = item?.servicio?.sentido?.nombre || item?.servicio?.sentido || item?.sentido;
    if (explicit) {
        return String(explicit);
    }

    const destination = getArrivalDestination(item);
    return destination ? `Hacia ${destination}` : 'Sin sentido';
}

function getBranchName(item) {
    return item?.servicio?.ramal?.nombre || item?.ramal || 'Sin ramal';
}

function getPlatformName(item) {
    return item?.arribo?.anden?.nombre || item?.servicio?.desde?.estacion?.anden?.nombre || 'N/A';
}

function getStopProgrammedTime(stop) {
    return stop?.salida?.programada || stop?.llegada?.programada || null;
}

function getStopCountdown(stop) {
    const seconds = Number(stop?.segundos);
    if (!Number.isFinite(seconds)) {
        return '';
    }

    return formatSecondsLabel(seconds);
}

function getArrivalDestination(item) {
    return item?.destino
        || item?.destination
        || item?.servicio?.ramal?.cabeceraFinal?.nombre
        || item?.servicio?.ramal?.nombre
        || item?.trip_headsign
        || item?.headsign
        || item?.ramal
        || 'Sin destino';
}

function getArrivalFilterDestination(item) {
    return item?.servicio?.ramal?.cabeceraFinal?.nombre
        || getArrivalDestination(item)
        || 'Sin destino';
}

function getArrivalTime(item) {
    return item?.horario
        || item?.hora
        || item?.arrival_time
        || item?.arrival
        || item?.tiempo
        || item?.arribo?.salida?.programada
        || item?.arribo?.llegada?.programada
        || secondsToDisplayTime(item?.arribo?.segundos);
}

function renderSentidoFilters() {
    return `
        <div class="train-search-actions" style="margin: 16px 0 4px;">
            <button type="button" class="secondary-btn ${currentSentido === 'todos' ? 'favorite-active' : ''}" data-sentido-filter="todos">Todos</button>
            <button type="button" class="secondary-btn ${currentSentido === '1' ? 'favorite-active' : ''}" data-sentido-filter="1">Ida</button>
            <button type="button" class="secondary-btn ${currentSentido === '2' ? 'favorite-active' : ''}" data-sentido-filter="2">Vuelta</button>
        </div>
    `;
}

function getUniqueDestinos(list = []) {
    return Array.from(
        new Set(
            (Array.isArray(list) ? list : [])
                .map(getArrivalFilterDestination)
                .filter(Boolean),
        ),
    );
}

export function renderFiltros(destinos = []) {
    const uniqueDestinos = ['Todos', ...destinos];

    return `
        <div class="train-search-actions" style="margin: 8px 0 16px; flex-wrap: wrap;">
            ${uniqueDestinos.map(destino => `
                <button
                    type="button"
                    class="secondary-btn filtro-btn ${destino === destinoSeleccionado ? 'active favorite-active' : ''}"
                    data-destino="${destino}"
                >
                    ${destino}
                </button>
            `).join('')}
        </div>
    `;
}

function bindSentidoFilters() {
    const buttons = Array.from(document.querySelectorAll('[data-sentido-filter]'));

    buttons.forEach(button => {
        button.addEventListener('click', async () => {
            const nextSentido = button.dataset.sentidoFilter || 'todos';
            if (nextSentido === currentSentido) {
                return;
            }

            currentSentido = nextSentido;
            await cargarArribos(currentStationId, currentSentido);
        });
    });
}

function bindDestinoFilters() {
    const buttons = Array.from(document.querySelectorAll('[data-destino]'));

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const nextDestino = button.dataset.destino || 'Todos';
            if (nextDestino === destinoSeleccionado) {
                return;
            }

            destinoSeleccionado = nextDestino;
            activarBoton(button);
            aplicarFiltro();
        });
    });
}

export function activarBoton(botonActivo) {
    const buttons = Array.from(document.querySelectorAll('.filtro-btn'));

    buttons.forEach(button => {
        const isActive = button === botonActivo;
        button.classList.toggle('active', isActive);
        button.classList.toggle('favorite-active', isActive);
    });
}

function renderDetailLayout(arrivals) {
    const detailState = document.getElementById('detailState');
    if (!detailState) {
        return;
    }

    const destinos = getUniqueDestinos(currentArrivals);

    detailState.innerHTML = `
        ${renderSentidoFilters()}
        ${renderFiltros(destinos)}
        <div id="arrivalsResults">
            ${renderArrivals(arrivals)}
        </div>
    `;

    bindSentidoFilters();
    bindDestinoFilters();
}

export function aplicarFiltro() {
    const filteredArrivals = destinoSeleccionado === 'Todos'
        ? currentArrivals
        : currentArrivals.filter(item => getArrivalFilterDestination(item) === destinoSeleccionado);

    renderDetailLayout(filteredArrivals);
}

function renderLoadingState() {
    const detailState = document.getElementById('detailState');
    if (!detailState) {
        return;
    }

    detailState.innerHTML = `
        ${renderSentidoFilters()}
        <p class="empty">Cargando arribos...</p>
    `;

    bindSentidoFilters();
}

export async function cargarArribos(id, sentido = 'todos') {
    currentStationId = String(id || '');
    currentSentido = sentido || 'todos';

    if (!currentStationId) {
        renderNotFoundState('');
        return [];
    }

    renderLoadingState();

    try {
        const payload = await getTrainArrivalsByStation(
            currentStationId,
            ARRIVALS_COUNT,
            currentSentido === 'todos' ? null : currentSentido,
        );
        currentArrivals = normalizeArrivalsResponse(payload);

        const destinosDisponibles = getUniqueDestinos(currentArrivals);
        if (destinoSeleccionado !== 'Todos' && !destinosDisponibles.includes(destinoSeleccionado)) {
            destinoSeleccionado = 'Todos';
        }

        renderStationArrivals(currentArrivals);
        return currentArrivals;
    } catch (error) {
        console.error('Error al cargar arribos:', error);
        currentArrivals = [];
        renderRequestErrorState();
        return [];
    }
}

export function renderArrivals(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return '<p class="line-meta">No hay arribos disponibles en este momento.</p>';
    }

    const firstItem = list[0];
    const stationName = getStationName(firstItem);
    const lineName = getLineName(firstItem);
    const statusName = getServiceStatus(firstItem);
    const statusClass = getServiceStatusClass(statusName);
    const routeLabel = getRouteLabel(firstItem);
    const directionLabel = getDirectionLabel(firstItem);
    const branchName = getBranchName(firstItem);

    return `
        <article class="status-item train-header-card" style="align-items: flex-start; flex-direction: column; gap: 8px;">
            <p class="line-meta train-header-meta">Sentido: ${directionLabel} • Ramal: ${branchName} • Linea: ${lineName}</p>
            <div class="train-title-row">
                <p class="status-title train-main-title">${stationName}</p>
                <span class="status-chip train-type-chip">Tren</span>
                <span class="status-chip ${statusClass}">${statusName}</span>
            </div>
            <p class="line-subtitle train-route">${routeLabel}</p>
        </article>
        <div class="status-list train-arrivals-list">
      ${list.map(item => `
                <details class="status-item train-arrival-item">
                    <summary class="train-arrival-summary">
                        <div class="train-arrival-summary-main">
                            <p class="train-arrival-time train-arrival-time-main">${toDisplayTime(getArrivalTime(item))}</p>
                            <p class="status-title">${getArrivalDestination(item)}</p>
                            <p class="line-meta">Anden: ${getPlatformName(item)}</p>
                        </div>
                    </summary>
                    <div class="train-arrival-details">
                        <p class="line-subtitle">Recorrido (horarios por estacion)</p>
                        <div class="train-stops-list">
                            ${(item?.servicio?.estaciones || []).map(stop => `
                                <article class="train-stop-item">
                                    <p class="status-title">${stop?.nombre || 'Estacion'}</p>
                                    <p class="line-meta">Hora: ${toDisplayTime(getStopProgrammedTime(stop))}</p>
                                    ${getStopCountdown(stop) ? `<p class="line-meta">${getStopCountdown(stop)}</p>` : ''}
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </details>
      `).join('')}
    </div>
  `;
}

function renderStationArrivals(arrivals) {
    currentArrivals = Array.isArray(arrivals) ? arrivals : [];
    aplicarFiltro();
}

function renderRequestErrorState() {
    const detailState = document.getElementById('detailState');
    if (!detailState) {
        return;
    }

    detailState.innerHTML = `
    ${renderSentidoFilters()}
    <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
      <p class="status-title">No se pudieron cargar los arribos</p>
      <p class="line-meta">Intenta nuevamente en unos instantes.</p>
    </article>
  `;

    bindSentidoFilters();
}

function renderNotFoundState(stationId) {
    const detailState = document.getElementById('detailState');
    if (!detailState) {
        return;
    }

    detailState.innerHTML = `
    <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
      <p class="status-title">No se encontro la estacion solicitada</p>
      <p class="line-meta">ID recibido: ${stationId || 'sin id'}</p>
      <p class="line-meta">Volve al buscador y abri una estacion desde la lista de resultados.</p>
    </article>
  `;
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    currentStationId = params.get('id') || '';

    const backBtn = document.getElementById('detailBackBtn');
    backBtn?.addEventListener('click', () => window.history.back());

    if (!currentStationId) {
        renderNotFoundState('');
        return;
    }

    await cargarArribos(currentStationId, currentSentido);
}

document.addEventListener('DOMContentLoaded', init);
