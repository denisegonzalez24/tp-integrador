import { getTrainStationsByName } from './api.js';

const TRAIN_SEARCH_MIN_CHARS = 3;
const COLECTIVOS_SEARCH_MIN_CHARS = 1;
const SUBTES_SEARCH_MIN_CHARS = 1;
const BUSCAR_PAGE_SIZE = 10;

let buscarCurrentPage = 1;
let buscarTransportData = [];
let searchTransportType = 'todos';
let ctx = {};

export function initSearchModule(context) {
    ctx = context || {};
}

function normalizeTrainStationsResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.entity)) return payload.entity;
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

function buildColectivoSearchItem(item, index) {
    return {
        ...item,
        _searchType: 'colectivos',
        _searchId: item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `buscar-colectivo-${index}`,
    };
}

function buildSubteSearchItem(item, index) {
    return {
        ...item,
        _searchType: 'subtes',
        _searchId: item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `buscar-subte-${index}`,
    };
}

function buildTrainSearchItem(item, index) {
    return {
        ...item,
        _searchType: 'trenes',
        _searchId: item.id_estacion || item.id || `buscar-tren-${index}`,
    };
}

async function searchColectivos(query) {
    const data = await ctx.ensureTransportData?.();
    if (!Array.isArray(data)) {
        return [];
    }

    const normalizedQuery = normalizeText(query);
    return data
        .filter(item => {
            const searchable = [
                item?.route_short_name,
                item?.route_long_name,
                item?.trip?.trip_headsign,
            ].map(normalizeText).join(' ');

            return searchable.includes(normalizedQuery);
        })
        .slice(0, 100)
        .map(buildColectivoSearchItem);
}

async function searchSubtes(query) {
    let source = ctx.getSubtesData?.() || [];

    if (!Array.isArray(source) || source.length === 0) {
        source = await ctx.loadSubtesData?.();
    }

    const normalizedQuery = normalizeText(query);
    return (Array.isArray(source) ? source : [])
        .filter(item => {
            const tripUpdate = item.trip_update || item.tripUpdate || {};
            const vehicle = item.vehicle || item.Vehicle || {};
            const trip = tripUpdate.trip || vehicle.trip || item.trip || {};
            const linea = item.linea || item.Linea || {};

            const searchable = [
                trip?.route_id,
                trip?.routeId,
                item?.route_id,
                item?.routeId,
                linea?.route_Id,
                linea?.route_id,
                trip?.trip_headsign,
                trip?.tripHeadsign,
            ].map(normalizeText).join(' ');

            return searchable.includes(normalizedQuery);
        })
        .slice(0, 100)
        .map(buildSubteSearchItem);
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
              <button type="button" class="secondary-btn ${isFavoriteTrain ? 'favorite-active' : ''}" data-card-action="favorite-train">${isFavoriteTrain ? 'Favorito' : 'Favorito +'}</button>
            </div>
          </div>
          <p class="line-meta">ID estacion: ${stationId || 'N/A'}</p>
        </article>
      `;
        }

        if (item?._searchType === 'colectivos') {
            return `
        <article class="line-card" data-search-id="${item._searchId}">
          <div class="line-card-main">
            <div>
              <p class="line-number">Linea ${item?.route_short_name || 'N/A'}</p>
              <p class="line-subtitle">Colectivo - ${item?.trip?.trip_headsign || 'Sin destino'}</p>
            </div>
            <button type="button" class="link-button station-link" data-card-action="open-search-item">Ver detalle</button>
          </div>
          <p class="line-meta">${item?.route_long_name || item?.trip?.trip_headsign || ''}</p>
        </article>
      `;
        }

        return `
      <article class="line-card" data-search-id="${item._searchId}">
        <div class="line-card-main">
          <div>
            <p class="line-number">Linea ${item?.linea?.route_Id || item?.linea?.route_id || item?.trip?.route_id || item?.trip?.routeId || 'Subte'}</p>
            <p class="line-subtitle">Subte - ${item?.trip?.trip_headsign || item?.trip?.tripHeadsign || 'En servicio'}</p>
          </div>
          <button type="button" class="link-button station-link" data-card-action="open-search-item">Ver detalle</button>
        </div>
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

    if (trimmedQuery.length < typeConfig.minChars) {
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
            results = await searchColectivos(trimmedQuery);
        } else if (searchTransportType === 'subtes') {
            results = await searchSubtes(trimmedQuery);
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
            ctx.openStationDetail?.(stationId);
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

        const selectedItem = buscarTransportData.find(item => String(item?._searchId) === searchId);
        if (!selectedItem) {
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
