import { getSubtesForecast } from './api.js';
import { loadData, saveData } from './storage.js';

const FAVORITES_STORAGE_KEY = 'favoriteTransportItems';

let currentStopId = '';
let currentStationName = '';
let currentDirection = 'todos'; // 'todos', '0' (Ida), '1' (Vuelta)
let allArrivals = [];

/**
 * Normaliza texto quitando acentos y espacios
 */
function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Convierte Route_Id (ej: "LineaA") a su notación corta (ej: "A")
 */
function mapRouteIdToLine(routeId) {
    const normalizedRoute = normalizeText(routeId)
        .replace(/\s+/g, '')
        .replace(/^linea/, '')
        .toUpperCase();

    if (!normalizedRoute) {
        return '';
    }

    // Preservar PM-C, PM-S, etc.
    if (/^PM-[A-Z]$/.test(normalizedRoute)) {
        return normalizedRoute;
    }

    // Para otras líneas, extraer solo la primera letra
    return normalizedRoute.charAt(0);
}

/**
 * Convierte unix timestamp a formato legible HH:MM
 */
function toClockTime(epochSeconds) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds)) {
        return 'Sin horario';
    }

    return new Date(seconds * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Calcula el tiempo hasta la llegada
 */
function toCountdownLabel(epochSeconds) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds)) {
        return 'Sin estimacion';
    }

    const diffMins = Math.round((seconds * 1000 - Date.now()) / 60000);
    if (diffMins <= 0) {
        return 'Llegando';
    }

    return `En ${diffMins} min`;
}

/**
 * Formatea delay en segundos a string legible
 */
function formatDelayLabel(delaySeconds) {
    const delay = Number(delaySeconds || 0);
    if (delay === 0) {
        return 'A tiempo';
    }

    const minutes = Math.round(Math.abs(delay) / 60);
    if (delay > 0) {
        return `+${minutes} min`;
    }

    return `-${minutes} min`;
}

/**
 * Obtiene la clase CSS para el delay
 */
function getDelayClass(delaySeconds) {
    const delay = Number(delaySeconds || 0);
    if (delay === 0) {
        return 'status-ok';
    }
    if (delay > 300) { // Más de 5 minutos
        return 'status-warning';
    }

    return 'status-minor';
}

/**
 * Extrae y procesa los arrivals desde la respuesta del API forecastGTFS
 * Puede filtrar por stop_id exacto O por stop_name (búsqueda flexible)
 */
function buildArrivalItems(entities, stopIdOrName, useStationName = false) {
    const normalizedInput = normalizeText(stopIdOrName || '');
    const arrivals = [];

    entities.forEach(entity => {
        const linea = entity?.Linea || entity?.linea || {};
        const tripId = linea?.Trip_Id || linea?.trip_id || 'N/A';
        const routeId = linea?.Route_Id || linea?.route_id || '';
        const directionId = linea?.Direction_ID ?? linea?.direction_id ?? 0;
        const estaciones = Array.isArray(linea?.Estaciones) ? linea.Estaciones : [];

        // Buscar en las estaciones del viaje si coincide
        estaciones.forEach(stop => {
            let matches = false;

            if (useStationName) {
                // Búsqueda por nombre de estación (flexible)
                const normalizedStopName = normalizeText(stop?.stop_name || '');
                matches = normalizedStopName === normalizedInput;
            } else {
                // Búsqueda por stop_id exacto
                const stopIdFromResponse = String(stop?.stop_id || '').trim();
                matches = stopIdFromResponse === String(stopIdOrName || '').trim();
            }

            if (matches) {
                const arrivalTime = stop?.arrival?.time;
                const arrivalDelay = stop?.arrival?.delay || 0;

                arrivals.push({
                    tripId,
                    line: mapRouteIdToLine(routeId),
                    direction: directionId, // 0 = Ida, 1 = Vuelta
                    arrivalTime,
                    delay: arrivalDelay,
                    stopName: stop?.stop_name || 'Estacion desconocida',
                });
            }
        });
    });

    // Ordenar por tiempo de llegada
    return arrivals.sort((a, b) => Number(a.arrivalTime || 0) - Number(b.arrivalTime || 0));
}

/**
 * Filtra arrivals según la dirección seleccionada
 */
function filterArrivalsByDirection(arrivals, direction) {
    if (direction === 'todos') {
        return arrivals;
    }

    const dirNum = Number(direction);
    return arrivals.filter(item => item.direction === dirNum);
}

/**
 * Renderiza los botones de filtro por dirección (Todos/Ida/Vuelta)
 */
function renderDirectionFilters() {
    return `
        <div class="train-search-actions" style="margin: 0;">
            <button type="button" class="secondary-btn detail-filter-btn ${currentDirection === 'todos' ? 'is-active' : ''}" data-direction-filter="todos">Todos</button>
            <button type="button" class="secondary-btn detail-filter-btn ${currentDirection === '0' ? 'is-active' : ''}" data-direction-filter="0">Ida</button>
            <button type="button" class="secondary-btn detail-filter-btn ${currentDirection === '1' ? 'is-active' : ''}" data-direction-filter="1">Vuelta</button>
        </div>
    `;
}

/**
 * Vincula eventos a los botones de filtro de dirección
 */
function bindDirectionFilters() {
    const buttons = Array.from(document.querySelectorAll('[data-direction-filter]'));

    buttons.forEach(button => {
        button.addEventListener('click', async () => {
            const nextDirection = button.dataset.directionFilter || 'todos';
            if (nextDirection === currentDirection) {
                return;
            }

            currentDirection = nextDirection;
            renderArrivals();
        });
    });
}

/**
 * Renderiza el listado de arrivals filtrado
 */
function renderArrivals() {
    const container = document.getElementById('subteDetailState');
    const filtersContainer = document.getElementById('subteDetailFilters');

    if (!container) {
        return;
    }

    // Mostrar filtros
    if (filtersContainer) {
        filtersContainer.innerHTML = renderDirectionFilters();
        bindDirectionFilters();
    }

    const filtered = filterArrivalsByDirection(allArrivals, currentDirection);

    if (filtered.length === 0) {
        container.innerHTML = `
            <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
                <p class="status-title">No hay arribos disponibles</p>
                <p class="line-meta">Filtra por otra dirección</p>
            </article>
        `;
        return;
    }

    // Agrupar por línea para el encabezado
    const lines = [...new Set(filtered.map(a => a.line))];
    const headerLine = lines.join(', ');

    container.innerHTML = `
        <article class="status-item train-header-card" style="align-items: flex-start; flex-direction: column; gap: 8px;">
            <p class="line-meta train-header-meta">Linea ${headerLine}</p>
            <div class="train-title-row">
                <p class="status-title train-main-title">${currentStationName}</p>
                <span class="status-chip train-type-chip">Subte</span>
            </div>
            <p class="line-subtitle train-route">Proximos arribos en tiempo real</p>
        </article>
        <div class="status-list train-arrivals-list">
            ${filtered.map(item => {
        const delayLabel = formatDelayLabel(item.delay);
        const delayClass = getDelayClass(item.delay);
        const directionLabel = item.direction === 0 ? 'Ida' : 'Vuelta';

        return `
                    <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                            <p class="status-title" style="font-size: 1.35rem; margin: 0;">${toClockTime(item.arrivalTime)}</p>
                            <span class="status-chip ${delayClass}" style="font-size: 0.85rem;">${delayLabel}</span>
                        </div>
                        <p class="line-subtitle">${item.stopName}</p>
                        <p class="line-meta">Linea ${item.line} · ${directionLabel} · ${toCountdownLabel(item.arrivalTime)}</p>
                        <p class="line-meta" style="font-size: 0.8rem; opacity: 0.7;">Viaje ${item.tripId}</p>
                    </article>
                `;
    }).join('')}
        </div>
    `;
}

/**
 * Renderiza estado de error
 */
function renderNotFoundState(message) {
    const container = document.getElementById('subteDetailState');
    if (!container) {
        return;
    }

    container.innerHTML = `
        <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
            <p class="status-title">No se pudo cargar el detalle</p>
            <p class="line-meta">${message}</p>
        </article>
    `;
}

/**
 * Renderiza estado de carga
 */
function renderLoadingState() {
    const container = document.getElementById('subteDetailState');
    if (!container) {
        return;
    }

    container.innerHTML = `
        <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
            <p class="status-title">Cargando arrivals...</p>
            <p class="line-meta">Aguarda por favor</p>
        </article>
    `;
}

/**
 * Actualiza el título y descripción del detalle
 */
function updateDetailHeader(stopId, stationName) {
    const titleEl = document.getElementById('subteDetailTitle');
    const infoEl = document.getElementById('subteDetailStationInfo');

    if (titleEl) {
        titleEl.textContent = 'Proximos subtes';
    }

    if (infoEl) {
        infoEl.textContent = `Estacion: ${stationName}`;
    }
}

/**
 * Carga y renderiza los arrivals
 */
async function cargarArribos(stopIdOrName, useStationName = false) {
    renderLoadingState();

    try {
        const payload = await getSubtesForecast();
        const entities = Array.isArray(payload) ? payload : (payload?.Entity || []);

        console.log('=== DEBUG SUBTE DETAIL ===');
        console.log('Input stopIdOrName:', stopIdOrName);
        console.log('useStationName:', useStationName);
        console.log('Total entities en respuesta:', entities.length);

        // Log de las primeras estaciones para ver qué hay
        if (entities.length > 0) {
            entities.slice(0, 2).forEach((entity, idx) => {
                const linea = entity?.Linea || {};
                const estaciones = Array.isArray(linea?.Estaciones) ? linea.Estaciones : [];
                console.log(`Entity ${idx}: Route=${linea?.Route_Id}, Trip=${linea?.Trip_Id}, Estaciones=${estaciones.length}`);
                if (estaciones.length > 0) {
                    console.log(`  Primeras estaciones:`, estaciones.slice(0, 3).map(e => e?.stop_name));
                }
            });
        }

        allArrivals = buildArrivalItems(entities, stopIdOrName, useStationName);

        console.log('Arrivals encontrados:', allArrivals.length);
        if (allArrivals.length > 0) {
            console.log('Primera llegada:', allArrivals[0]);
        }
        console.log('=== FIN DEBUG ===\n');

        if (allArrivals.length === 0) {
            renderNotFoundState('No hay arrivals para esta estacion.');
            return;
        }

        renderArrivals();
    } catch (error) {
        console.error('Error al cargar detalle de subte:', error);
        renderNotFoundState('Error al conectar con el servidor. Intenta nuevamente.');
    }
}

/**
 * Inicializa la página
 */
async function init() {
    const params = new URLSearchParams(window.location.search);

    let stopIdOrName = '';
    let useStationName = false;

    // Detectar qué tipo de búsqueda es (prioridad: id > name > station)
    if (params.has('id')) {
        stopIdOrName = String(params.get('id') || '').trim();
        useStationName = false;  // Búsqueda exacta por stop_id
    } else if (params.has('name')) {
        stopIdOrName = String(params.get('name') || '').trim();
        useStationName = true;   // Búsqueda flexible por nombre
    } else if (params.has('station')) {
        stopIdOrName = String(params.get('station') || '').trim();
        useStationName = true;   // Compatibilidad hacia atrás
    }

    if (!stopIdOrName) {
        renderNotFoundState('Falta parámetro requerido: ?id=<stop_id> o ?name=<station_name>');
        return;
    }

    const stationNameParam = String(params.get('name') || params.get('station') || '').trim();

    currentStopId = stopIdOrName;
    currentStationName = stationNameParam || stopIdOrName;
    updateDetailHeader(currentStopId, currentStationName);

    const backBtn = document.getElementById('subteDetailBackBtn');
    backBtn?.addEventListener('click', () => {
        // Volver a index.html en la vista de subtes
        window.location.href = './index.html?view=subtes';
    });

    await cargarArribos(stopIdOrName, useStationName);
}

document.addEventListener('DOMContentLoaded', init);
