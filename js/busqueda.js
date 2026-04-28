import { getTrainStationsByName, getVehiclePositionsDetailed } from './api.js';

const TRAIN_SEARCH_MIN_CHARS = 3;
const COLECTIVOS_SEARCH_MIN_CHARS = 0;
const SUBTES_SEARCH_MIN_CHARS = 1;
import { getSubtesServiceAlerts, getTrainStationsByName, getVehiclePositionsDetailed } from './api.js';

const TRAIN_SEARCH_MIN_CHARS = 3;
const COLECTIVOS_SEARCH_MIN_CHARS = 0;
const SUBTES_SEARCH_MIN_CHARS = 0;
const BUSCAR_PAGE_SIZE = 10;

const COLECTIVOS_DIRECTION_LABELS = {
    0: 'Ida',
    1: 'Vuelta',
};

const COLECTIVOS_STATUS_LABELS = {
    0: 'Detenido',
    1: 'En parada',
    2: 'En movimiento',
};

let buscarCurrentPage = 1;
let buscarTransportData = [];
let searchTransportType = 'todos';
let ctx = {};
let colectivosCache = [];
let colectivosFilters = {
    direccion: 'todos',
    estado: 'todos',
};
let subtesFilters = {
    alerta: 'todos',
    linea: 'todos',
};
let subtesCatalogCache = null;

export function initSearchModule(context) {
    ctx = context || {};
}

function normalizeTrainStationsResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.entity)) return payload.entity;
    return [];
}

function normalizeColectivosResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload._entity)) return payload._entity;
    if (payload && Array.isArray(payload.entity)) return payload.entity;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getSearchTypeConfig(type) {
    switch (type) {
        case 'colectivos':
            return {
                minChars: COLECTIVOS_SEARCH_MIN_CHARS,
                placeholder: 'Buscar colectivo por linea o destino',
            };
        case 'subtes':
            return {
                minChars: SUBTES_SEARCH_MIN_CHARS,
                placeholder: 'Buscar subte por linea o destino',
            };
        case 'trenes':
            return {
                minChars: TRAIN_SEARCH_MIN_CHARS,
                placeholder: 'Buscar estacion de tren (ej: Retiro)',
            };
        default:
            return {
                minChars: TRAIN_SEARCH_MIN_CHARS,
                placeholder: 'Buscar estacion de tren (ej: Retiro)',
            };
    }
}

function renderSearchStatus(message) {
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `<p class="empty">${message}</p>`;
    }
}

function getDynamicFiltersContainer() {
    let container = document.getElementById('filtros-dinamicos');

    if (container) {
        return container;
    }

    const searchBox = document.querySelector('#view-buscar .search-box');
    if (!searchBox) {
        return null;
    }

    container = document.createElement('div');
    container.id = 'filtros-dinamicos';
    searchBox.insertAdjacentElement('afterend', container);

    return container;
}

function buildColectivoSearchItem(item, index) {
    const trip = getColectivoTrip(item);
    const vehicle = getColectivoVehicle(item);
    const position = getColectivoPosition(item);

    return {
        ...item,
        route_short_name: item?.route_short_name || getColectivoLinea(item),
        route_long_name: item?.route_long_name || getColectivoDestino(item),
        trip: {
            ...trip,
            route_id: trip?._route_id || trip?.route_id || getColectivoLinea(item),
            trip_id: trip?._trip_id || trip?.trip_id || item?.id || '',
            trip_headsign: trip?._trip_headsign || trip?.trip_headsign || getColectivoDestino(item),
            direction_id: trip?._direction_id ?? trip?.direction_id ?? '',
        },
        vehicle: {
            ...vehicle,
            current_status: vehicle?._current_status ?? vehicle?.current_status ?? null,
            position: {
                ...position,
            },
            vehicle: {
                ...(vehicle?._vehicle || vehicle?.vehicle || {}),
                id: vehicle?._vehicle?.id || vehicle?.vehicle?.id || vehicle?.id || item?.id || '',
            },
        },
        _searchType: 'colectivos',
        _searchId: getColectivoVehicleId(item) || `buscar-colectivo-${index}`,
    };
}

function buildSubteSearchItem(item, index) {
    return {
        ...item,
        _searchType: 'subtes',
        _searchId: item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `buscar-subte-${index}`,
    };
}

function buildIntegratedSubteSearchItem(item, index) {
    return {
        ...item,
        _searchType: 'subtes',
        _searchId: item._searchId || `buscar-subte-integrado-${index}`,
    };
}

function buildTrainSearchItem(item, index) {
    return {
        ...item,
        _searchType: 'trenes',
        _searchId: item.id_estacion || item.id || `buscar-tren-${index}`,
    };
}

function getColectivoTrip(item) {
    return item?._vehicle?._trip || item?.trip || {};
}

function getColectivoVehicle(item) {
    return item?._vehicle || item?.vehicle || {};
}

function getColectivoLinea(item) {
    return String(
        getColectivoTrip(item)?._route_id
        || getColectivoTrip(item)?.route_id
        || item?.route_short_name
        || item?.route_id
        || '',
    ).trim();
}

function getColectivoDireccion(item) {
    const directionId = getColectivoTrip(item)?._direction_id ?? getColectivoTrip(item)?.direction_id;
    return directionId === undefined || directionId === null || directionId === '' ? null : String(directionId);
}

function getColectivoEstado(item) {
    const status = getColectivoVehicle(item)?._current_status ?? getColectivoVehicle(item)?.current_status ?? item?.current_status;
    return status === undefined || status === null || status === '' ? null : String(status);
}

function getColectivoDestino(item) {
    return getColectivoTrip(item)?._trip_headsign
        || getColectivoTrip(item)?.trip_headsign
        || getColectivoVehicle(item)?._vehicle?._label
        || getColectivoVehicle(item)?.vehicle?.label
        || getColectivoVehicle(item)?._vehicle?._license_plate
        || getColectivoVehicle(item)?.vehicle?.license_plate
        || item?.trip_headsign
        || item?.route_long_name
        || 'Sin destino visible';
}

function getColectivoVehicleId(item) {
    return getColectivoVehicle(item)?._vehicle?.id
        || getColectivoVehicle(item)?.vehicle?.id
        || getColectivoVehicle(item)?.id
        || item?.id
        || '';
}

function getColectivoVehicleLabel(item) {
    return getColectivoVehicle(item)?._vehicle?._label
        || getColectivoVehicle(item)?.vehicle?.label
        || '';
}

function getColectivoLicensePlate(item) {
    return String(
        getColectivoVehicle(item)?._vehicle?._license_plate
        || getColectivoVehicle(item)?.vehicle?.license_plate
        || '',
    ).trim();
}

function getColectivoPosition(item) {
    const rawPosition = getColectivoVehicle(item)?._position || getColectivoVehicle(item)?.position || {};

    return {
        ...rawPosition,
        latitude: rawPosition?._latitude ?? rawPosition?.latitude,
        longitude: rawPosition?._longitude ?? rawPosition?.longitude,
        speed: rawPosition?._speed ?? rawPosition?.speed,
    };
}

function getColectivoDirectionLabel(item) {
    return COLECTIVOS_DIRECTION_LABELS[getColectivoDireccion(item)] || 'Sin direccion';
}

function getColectivoStatusLabel(item) {
    return COLECTIVOS_STATUS_LABELS[getColectivoEstado(item)] || 'Sin estado';
}

function buildFilterSelect({ id, label, options = [], value = '' }) {
    return `
        <label class="search-filter-field" for="${id}">
            <span class="line-meta">${label}</span>
            <select id="${id}" class="search-filter-select">
                ${options.map(option => `
                    <option value="${option.value}" ${String(option.value) === String(value) ? 'selected' : ''}>${option.label}</option>
                `).join('')}
            </select>
        </label>
    `;
}

function bindColectivosFilterEvents() {
    const direccionFilter = document.getElementById('colectivosDireccionFilter');
    const estadoFilter = document.getElementById('colectivosEstadoFilter');

    direccionFilter?.addEventListener('change', event => {
        colectivosFilters.direccion = event.target.value;
    });

    estadoFilter?.addEventListener('change', event => {
        colectivosFilters.estado = event.target.value;
    });
}

function bindSubtesFilterEvents() {
    const alertasFilter = document.getElementById('subtesAlertasFilter');
    const lineaFilter = document.getElementById('subtesLineaFilter');

    alertasFilter?.addEventListener('change', event => {
        subtesFilters.alerta = event.target.value;
    });

    lineaFilter?.addEventListener('change', event => {
        subtesFilters.linea = event.target.value;
    });
}

function getSubtesLineFilterOptions() {
    const preferredOrder = ['A', 'B', 'C', 'D', 'E', 'H', 'PM-C', 'PM-S'];
    const catalogLines = Array.isArray(subtesCatalogCache?.lineas)
        ? subtesCatalogCache.lineas
            .map(line => String(line?.id || '').trim().toUpperCase())
            .filter(Boolean)
        : [];

    const merged = Array.from(new Set([...preferredOrder, ...catalogLines]));
    return [{ value: 'todos', label: 'Todas' }, ...merged.map(line => ({ value: line, label: `Linea ${line}` }))];
}

export function renderFiltros(tipo) {
    const container = getDynamicFiltersContainer();
    if (!container) {
        return;
    }

    if (tipo !== 'colectivos' && tipo !== 'subtes') {
        container.innerHTML = '';
        return;
    }

    if (tipo === 'subtes') {
        container.innerHTML = `
            <div class="search-dynamic-filters">
                ${buildFilterSelect({
            id: 'subtesLineaFilter',
            label: 'Linea',
            options: getSubtesLineFilterOptions(),
            value: subtesFilters.linea,
        })}
                ${buildFilterSelect({
            id: 'subtesAlertasFilter',
            label: 'Alertas',
            options: [
                { value: 'todos', label: 'Todos' },
                { value: 'con_alertas', label: 'Con alertas' },
                { value: 'sin_alertas', label: 'Sin alertas' },
            ],
            value: subtesFilters.alerta,
        })}
            </div>
        `;

        bindSubtesFilterEvents();
        return;
    }

    container.innerHTML = `
        <div class="search-dynamic-filters">
            ${buildFilterSelect({
        id: 'colectivosDireccionFilter',
        label: 'Direccion',
        options: [
            { value: 'todos', label: 'Todos' },
            { value: '0', label: 'Ida' },
            { value: '1', label: 'Vuelta' },
        ],
        value: colectivosFilters.direccion,
    })}
            ${buildFilterSelect({
        id: 'colectivosEstadoFilter',
        label: 'Estado',
        options: [
            { value: 'todos', label: 'Todos' },
            { value: '2', label: 'En movimiento' },
            { value: '1', label: 'En parada' },
        ],
        value: colectivosFilters.estado,
    })}
        </div>
    `;

    bindColectivosFilterEvents();
}

export async function fetchColectivos() {
    const payload = await getVehiclePositionsDetailed();
    const normalizedData = normalizeColectivosResponse(payload);

    colectivosCache = normalizedData;
    renderFiltros('colectivos');

    return colectivosCache;
}

export function filtrarColectivos(data, filtros = {}) {
    const rawQuery = String(document.getElementById('searchInput')?.value || '').trim();
    const normalizedQuery = normalizeText(rawQuery);
    const isNumericQuery = /^\d+$/.test(rawQuery);
    const activeFilters = {
        direccion: filtros.direccion ?? 'todos',
        estado: filtros.estado ?? 'todos',
    };

    return (Array.isArray(data) ? data : [])
        .filter(item => {
            const searchable = [
                getColectivoLinea(item),
                getColectivoDestino(item),
                getColectivoTrip(item)?._trip_id,
                getColectivoTrip(item)?.trip_id,
                getColectivoVehicle(item)?._vehicle?._label,
                getColectivoVehicle(item)?.vehicle?.label,
                getColectivoVehicle(item)?._vehicle?._license_plate,
                getColectivoVehicle(item)?.vehicle?.license_plate,
            ].map(normalizeText).join(' ');

            const linea = getColectivoLinea(item);
            const matchesQuery = normalizedQuery
                ? (isNumericQuery ? linea === rawQuery : searchable.includes(normalizedQuery))
                : true;
            const matchesDireccion = activeFilters.direccion !== 'todos' ? getColectivoDireccion(item) === activeFilters.direccion : true;
            const matchesEstado = activeFilters.estado !== 'todos' ? getColectivoEstado(item) === activeFilters.estado : true;

            return matchesQuery && matchesDireccion && matchesEstado;
        })
        .slice(0, 100)
        .map(buildColectivoSearchItem);
}

export function renderResultados(lista) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) {
        return;
    }

    buscarTransportData = Array.isArray(lista) ? lista : [];
    buscarCurrentPage = 1;

    if (buscarTransportData.length === 0) {
        resultsContainer.innerHTML = '<p class="empty">No se encontraron colectivos con esos filtros.</p>';
        updateBuscarPaginationControls();
        return;
    }

    renderSearchResults(buscarTransportData, buscarCurrentPage);
}

async function searchColectivos() {
    const data = await fetchColectivos();
    return filtrarColectivos(data, colectivosFilters);
}

function mapRouteIdToLine(routeId) {
    const normalizedRoute = normalizeText(routeId)
        .replace(/\s+/g, '')
        .replace(/^linea/, '')
        .toUpperCase();

    if (!normalizedRoute) {
        return '';
    }

    if (/^[A-Z]$/.test(normalizedRoute)) {
        return normalizedRoute;
    }

    if (/^PM-[A-Z]$/.test(normalizedRoute)) {
        return normalizedRoute;
    }

    return normalizedRoute;
}

function buildLineAliasList(linea) {
    const lineValue = String(linea || '').trim().toUpperCase();
    if (!lineValue) {
        return [];
    }

    return [lineValue, `LINEA ${lineValue}`, `L ${lineValue}`];
}

async function resolveSubtesCatalogData() {
    if (subtesCatalogCache && typeof subtesCatalogCache === 'object') {
        return subtesCatalogCache;
    }

    const contextData = ctx.getSubtesCatalogData?.() || ctx.subtesCatalogData;
    if (contextData && typeof contextData === 'object') {
        subtesCatalogCache = contextData;
        return subtesCatalogCache;
    }

    if (typeof globalThis !== 'undefined' && globalThis.data && typeof globalThis.data === 'object') {
        subtesCatalogCache = globalThis.data;
        return subtesCatalogCache;
    }

    try {
        const response = await fetch('./datos/subtes.json');
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
        }

        subtesCatalogCache = await response.json();
        return subtesCatalogCache;
    } catch (error) {
        console.error('No se pudo cargar datos/subtes.json:', error);
        return { estaciones_index: {}, lineas: [] };
    }
}

async function loadSubtesAlertsByLine() {
    try {
        const payload = await getSubtesServiceAlerts();
        const rawAlerts = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.entity)
                ? payload.entity
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];

        const byLine = new Map();

        rawAlerts.forEach(alert => {
            const line = mapRouteIdToLine(alert?.route_id || alert?.routeId || alert?.route || '');
            const text = String(alert?.header_text || alert?.headerText || alert?.description || '').trim();

            if (!line || !text) {
                return;
            }

            if (!byLine.has(line)) {
                byLine.set(line, text);
            }
        });

        return byLine;
    } catch (error) {
        console.error('No se pudieron cargar alertas de subte:', error);
        return new Map();
    }
}

function normalizeSubteAlertFilterValue(filter) {
    if (filter === 'con_alertas' || filter === 'sin_alertas' || filter === 'todos') {
        return filter;
    }
    return 'todos';
}

function normalizeSubteLineFilterValue(filter) {
    const normalized = String(filter || '').trim().toUpperCase();
    if (!normalized || normalized === 'TODOS') {
        return 'todos';
    }

    return normalized;
}

function shouldKeepSubteResult(hasAlert, filter) {
    if (filter === 'con_alertas') {
        return hasAlert;
    }
    if (filter === 'sin_alertas') {
        return !hasAlert;
    }
    return true;
}

function stationMatchesSubteQuery(normalizedQuery, stationName, lineas = [], alerta = '') {
    if (!normalizedQuery) {
        return true;
    }

    const normalizedStation = normalizeText(stationName);
    const normalizedAlert = normalizeText(alerta);
    const lineAliases = lineas.flatMap(buildLineAliasList).map(normalizeText);

    return normalizedStation.includes(normalizedQuery)
        || lineAliases.some(alias => alias.includes(normalizedQuery))
        || normalizedAlert.includes(normalizedQuery);
}

export async function searchSubtes(query, filtro = 'todos') {
    const normalizedQuery = normalizeText(String(query || '').trim());
    const normalizedFilter = normalizeSubteAlertFilterValue(filtro);
    const normalizedLineFilter = normalizeSubteLineFilterValue(subtesFilters.linea);
    const [catalogData, alertsByLine] = await Promise.all([
        resolveSubtesCatalogData(),
        loadSubtesAlertsByLine(),
    ]);

    const estacionesIndex = catalogData?.estaciones_index && typeof catalogData.estaciones_index === 'object'
        ? catalogData.estaciones_index
        : {};
    const deduped = new Map();

    Object.values(estacionesIndex).forEach(station => {
        const stationName = String(station?.nombre || '').trim();
        if (!stationName) {
            return;
        }

        const lineas = Array.from(new Set((Array.isArray(station?.lineas) ? station.lineas : [])
            .map(linea => String(linea || '').trim().toUpperCase())
            .filter(Boolean)));

        if (normalizedLineFilter !== 'todos' && !lineas.includes(normalizedLineFilter)) {
            return;
        }

        const alertas = lineas
            .map(linea => alertsByLine.get(linea))
            .filter(Boolean);
        const alerta = alertas[0] || '';
        const hasAlert = Boolean(alerta);

        if (!shouldKeepSubteResult(hasAlert, normalizedFilter)) {
            return;
        }

        if (!stationMatchesSubteQuery(normalizedQuery, stationName, lineas, alerta)) {
            return;
        }

        const dedupeKey = normalizeText(stationName);
        deduped.set(dedupeKey, {
            titulo: stationName,
            tipo: 'subte',
            linea: lineas,
            ids: Array.isArray(station?.ids) ? station.ids : [],
            ...(alerta ? { alerta } : {}),
            _searchId: `subte:${dedupeKey}`,
        });
    });

    return Array.from(deduped.values())
        .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)))
        .map((item, index) => buildIntegratedSubteSearchItem(item, index));
}

async function searchTrenes(query) {
    const trimmedQuery = String(query || '').trim();
    const cached = ctx.loadTrainStationsCache?.() || [];

    if (trimmedQuery.length < TRAIN_SEARCH_MIN_CHARS) {
        const normalizedQuery = normalizeText(trimmedQuery);
        const filteredCached = normalizedQuery
            ? cached.filter(item => normalizeText(item?.nombre).includes(normalizedQuery))
            : cached;

        return filteredCached.slice(0, 100).map(buildTrainSearchItem);
    }

    const response = await getTrainStationsByName(trimmedQuery);
    const stations = normalizeTrainStationsResponse(response);
    ctx.persistTrainStationsCache?.(stations);
    return stations.slice(0, 100).map(buildTrainSearchItem);
}

function getBuscarPageData(page = 1) {
    const startIndex = (page - 1) * BUSCAR_PAGE_SIZE;
    return buscarTransportData.slice(startIndex, startIndex + BUSCAR_PAGE_SIZE);
}

function updateBuscarPaginationControls() {
    const prevBtn = document.getElementById('buscarPrevBtn');
    const nextBtn = document.getElementById('buscarNextBtn');
    const pageLabel = document.getElementById('buscarPageLabel');
    const totalPages = Math.max(1, Math.ceil(buscarTransportData.length / BUSCAR_PAGE_SIZE));

    if (prevBtn) prevBtn.disabled = buscarCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = buscarCurrentPage >= totalPages;
    if (pageLabel) pageLabel.textContent = `${buscarCurrentPage} de ${totalPages}`;
}

export function setSearchTransportType(type) {
    searchTransportType = type;

    const searchInput = document.getElementById('searchInput');
    const { placeholder } = getSearchTypeConfig(type);
    if (searchInput) {
        searchInput.placeholder = placeholder;
    }

    const filterButtons = Array.from(document.querySelectorAll('[data-search-type]'));
    filterButtons.forEach(button => {
        button.classList.toggle('is-active', button.dataset.searchType === type);
    });

    renderFiltros(type);
}

export function renderSearchResults(data, page = 1) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    buscarTransportData = data || [];
    buscarCurrentPage = page;

    if (!Array.isArray(buscarTransportData) || buscarTransportData.length === 0) {
        resultsContainer.innerHTML = '<p class="empty">No se encontraron resultados para esa busqueda.</p>';
        updateBuscarPaginationControls();
        return;
    }

    const pageData = getBuscarPageData(buscarCurrentPage);

    resultsContainer.innerHTML = pageData.map(item => {
        if (item?._searchType === 'trenes') {
            const stationId = item?.id_estacion || item?.id || '';
            const stationName = item?.nombre || 'Estacion sin nombre';
            const lineName = ctx.getStationLineFromRamales?.(item?.incluida_en_ramales || []) || 'Tren';
            const isFavoriteTrain = ctx.isFavoriteItem?.(item, 'buscar');

            return `
        <article class="line-card station-card" data-station-id="${stationId}">
          <div class="line-card-main">
            <div>
              <p class="line-number">${stationName}</p>
              <p class="line-subtitle">Tren - Linea ${lineName}</p>
            </div>
            <div class="train-search-actions">
              <button type="button" class="link-button station-link" data-card-action="open-station">Ver detalle</button>
                            <button type="button" class="favorite-toggle ${isFavoriteTrain ? 'is-active' : ''}" data-card-action="favorite-train" aria-pressed="${isFavoriteTrain}" aria-label="${isFavoriteTrain ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${isFavoriteTrain ? '★' : '☆'}</button>
            </div>
          </div>
          <p class="line-meta">ID estacion: ${stationId || 'N/A'}</p>
        </article>
      `;
        }

        if (item?._searchType === 'colectivos') {
            const isFavoriteTrain = ctx.isFavoriteItem?.(item, 'buscar');

            return `
                <article class="line-card transport-card" data-search-id="${item._searchId}">
                    <button type="button" class="transport-card-main" data-card-action="open-search-item">
                        <div class="line-card-main">
            <div>
              <p class="line-number">Linea ${getColectivoLinea(item) || 'N/A'}</p>
              <p class="line-subtitle">Colectivo - ${getColectivoVehicleLabel(item) || getColectivoDestino(item)}</p>
            </div>
                        </div>
          <p class="line-meta">Direccion: ${getColectivoDirectionLabel(item)} • Estado: ${getColectivoStatusLabel(item)}</p>
                    </button>
                    <button type="button" class="favorite-toggle ${isFavoriteTrain ? 'is-active' : ''}" data-card-action="favorite-train" aria-pressed="${isFavoriteTrain}" aria-label="${isFavoriteTrain ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${isFavoriteTrain ? '★' : '☆'}</button>
                </article>
      `;
        }

        return `
      <article class="line-card" data-search-id="${item._searchId}">
        <div class="line-card-main">
          <div>
                        <p class="line-number">${item?.titulo || 'Estacion de subte'}</p>
                        <p class="line-subtitle">Subte - Linea ${(Array.isArray(item?.linea) && item.linea.length > 0) ? item.linea.join(' / ') : 'N/A'}</p>
          </div>
          <button type="button" class="link-button station-link" data-card-action="open-search-item">Ver detalle</button>
        </div>
                <p class="line-meta">${item?.alerta ? `Alerta: ${item.alerta}` : 'Sin alertas reportadas'}</p>
      </article>
    `;
    }).join('');

    updateBuscarPaginationControls();
}

export async function runIntegratedSearch(query) {
    const trimmedQuery = String(query || '').trim();
    const resultsContainer = document.getElementById('searchResults');
    const typeConfig = getSearchTypeConfig(searchTransportType);

    if (!resultsContainer) {
        return;
    }

    if (searchTransportType !== 'colectivos' && trimmedQuery.length < typeConfig.minChars) {
        if (searchTransportType === 'trenes') {
            const cachedStations = await searchTrenes(trimmedQuery);
            if (cachedStations.length > 0) {
                buscarCurrentPage = 1;
                renderSearchResults(cachedStations, buscarCurrentPage);
            } else {
                buscarTransportData = [];
                renderSearchStatus(`Ingresa al menos ${TRAIN_SEARCH_MIN_CHARS} caracteres para buscar estaciones.`);
                updateBuscarPaginationControls();
            }
            return;
        }

        buscarTransportData = [];
        renderSearchStatus(`Ingresa al menos ${typeConfig.minChars} caracter${typeConfig.minChars > 1 ? 'es' : ''} para buscar.`);
        updateBuscarPaginationControls();
        return;
    }

    renderSearchStatus('Buscando resultados...');

    try {
        let results = [];

        if (searchTransportType === 'colectivos') {
            results = await searchColectivos();
            renderResultados(results);
            return;
        }

        if (searchTransportType === 'subtes') {
            results = await searchSubtes(trimmedQuery, subtesFilters.alerta);
        } else {
            results = await searchTrenes(trimmedQuery);
        }

        buscarCurrentPage = 1;
        renderSearchResults(results, buscarCurrentPage);
    } catch (error) {
        console.error('Error al buscar transporte:', error);
        buscarTransportData = [];
        renderSearchStatus('No se pudo obtener informacion en este momento. Intenta nuevamente.');
        updateBuscarPaginationControls();
    }
}

export function bindSearchPaginationControls() {
    const buscarPrevBtn = document.getElementById('buscarPrevBtn');
    const buscarNextBtn = document.getElementById('buscarNextBtn');

    buscarPrevBtn?.addEventListener('click', () => {
        if (buscarCurrentPage > 1) {
            buscarCurrentPage -= 1;
            renderSearchResults(buscarTransportData, buscarCurrentPage);
        }
    });

    buscarNextBtn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(buscarTransportData.length / BUSCAR_PAGE_SIZE));
        if (buscarCurrentPage < totalPages) {
            buscarCurrentPage += 1;
            renderSearchResults(buscarTransportData, buscarCurrentPage);
        }
    });
}

export function handleSearchResultsAction(event) {
    const actionButton = event.target.closest('[data-card-action]');
    if (!actionButton) return false;

    const action = actionButton.dataset.cardAction;

    if (action === 'open-station') {
        const stationCard = event.target.closest('[data-station-id]');
        const stationId = stationCard?.dataset.stationId;

        if (stationId) {
            const stationData = buscarTransportData.find(item => String(item?.id_estacion || item?.id || '') === String(stationId));
            ctx.openStationDetail?.(stationId, stationData || null);
        }
        return true;
    }

    if (action === 'favorite-train') {
        const stationCard = event.target.closest('[data-station-id]');
        const stationId = stationCard?.dataset.stationId;

        if (!stationId) {
            return true;
        }

        const stationData = buscarTransportData.find(item => String(item?.id_estacion || item?.id || '') === String(stationId));
        if (!stationData) {
            return true;
        }

        ctx.toggleFavoriteItem?.(stationData, 'buscar');
        return true;
    }

    if (action === 'open-search-item') {
        const searchCard = event.target.closest('[data-search-id]');
        const searchId = searchCard?.dataset.searchId;

        if (!searchId) {
            return true;
        }

        const selectedItem = buscarTransportData.find(item => String(item?._searchId) === String(searchId));
        if (!selectedItem) {
            return true;
        }

        if (selectedItem._searchType === 'subtes') {
            const firstLine = Array.isArray(selectedItem.linea) && selectedItem.linea.length > 0 ? selectedItem.linea[0] : '';
            ctx.openSubteStationDetail?.(selectedItem.titulo, firstLine, selectedItem);
            return true;
        }

        ctx.openTransportDetail?.(selectedItem, selectedItem._searchType || 'buscar');
        return true;
    }

    return false;
}

export function getSearchData() {
    return buscarTransportData;
}

export function getSearchCurrentPage() {
    return buscarCurrentPage;
}
