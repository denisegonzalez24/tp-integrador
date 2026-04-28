﻿import { getVehiclePositions, getColectivosRealTime, getSubtesRealTime } from './api.js';
import { saveData, loadData, toggleFavoriteItem, removeFavoriteItem, getFavoriteItems } from './storage.js';
import { renderFavoritesView,renderColectivos, renderColectivosLines, renderSoloColectivosLines, renderSearchResults, renderLineDetails, renderSubtes } from './ui.js';
import { openTrenesView, handleTrenesListInteraction, getStationLineFromRamales, ensureTrenesLineasLoaded, ensureTrenesRamalesLoaded } from './trenes.js';
import { fetchSubtesData, getSubtesRoutes, getParadasBySubteRoute } from './subtes.js';
import { fetchColectivosData, getColectivosRoutes, getParadasByRoute, getAgencyIdByRoute } from './colectivos.js';

const TRANSPORT_DATA_KEY = 'transportData';
let colectivosCurrentPage = 1;
const COLECTIVOS_PAGE_SIZE = 10;
let colectivosTripData = [];
let buscarCurrentPage = 1;
const BUSCAR_PAGE_SIZE = 10;
let buscarTransportData = [];
let soloColectivosCurrentPage = 1;
const SOLO_COLECTIVOS_PAGE_SIZE = 10;
let soloColectivosTripData = [];
let subtesTripData = [];
﻿import { getVehiclePositions } from './api.js';
import { saveData, loadData } from './storage.js';
import { openTrenesView, handleTrenesListInteraction, getStationLineFromRamales } from './trenes.js';
import {
  renderColectivosLines,
  renderSoloColectivosLines,
  openColectivosView,
  openSoloColectivosView,
  bindColectivosControls,
  getColectivosTripData,
  getSoloColectivosTripData,
  getColectivosCurrentPage,
  getSoloColectivosCurrentPage,
} from './colectivos.js';
import {
  renderSubtesLines,
  openSubtesView,
  loadSubtesData,
  bindSubtesControls,
  handleSubtesListInteraction,
  getSubtesData,
  getSubtesCurrentPage,
  refreshSubtesView,
} from './subtes.js';
import {
  initSearchModule,
  setSearchTransportType,
  renderSearchResults,
  runIntegratedSearch,
  bindSearchPaginationControls,
  handleSearchResultsAction,
  getSearchData,
  getSearchCurrentPage,
} from './busqueda.js';
import {
  initFavoritesModule,
  isFavoriteItem,
  toggleFavoriteItem,
  renderFavoritesView,
  handleFavoritesClick,
} from './favoritos.js';
import {
  initHistoryModule,
  addHistoryItem,
  renderHistoryView,
  handleHistoryClick,
  getHistoryItems,
} from './historial.js';

const TRANSPORT_DATA_KEY = 'transportData';
const FAVORITES_STORAGE_KEY = 'favoriteTransportItems';
const HISTORY_STORAGE_KEY = 'searchHistoryItems';
const TRAIN_STATIONS_CACHE_KEY = 'trainStationsCache';
const views = Array.from(document.querySelectorAll('.view'));
const navLinks = Array.from(document.querySelectorAll('.bottom-nav .nav-link'));
const validViews = views.map(view => view.id.replace('view-', ''));
let currentDetailData = null;
let currentDetailSource = null;

function getViewFromHash() {
  const hash = window.location.hash.slice(1).toLowerCase();
  return document.getElementById(`view-${hash}`) ? hash : 'home';
}

function setActiveView(viewName) {
  const targetId = `view-${viewName}`;

  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.id === targetId);
  });

  document.querySelectorAll('.bottom-nav .nav-link').forEach(link => {
    link.classList.toggle('nav-link-active', link.dataset.view === viewName);
  });
}

function navigateTo(viewName) {
  const target = document.getElementById(`view-${viewName}`) ? viewName : 'home';
  window.location.hash = target;
}
window.navigateTo = navigateTo; // Expuesto globalmente

const TRAIN_STATIONS_CACHE_KEY = 'trainStationsCache';

function getCachedTrainStations() {
  const cached = loadData(TRAIN_STATIONS_CACHE_KEY);
  return Array.isArray(cached) ? cached : [];
}


function getActiveListData(listId) {
  switch (listId) {
    case 'colectivosList':
      return { data: colectivosTripData, source: 'colectivos' };
    case 'soloColectivosList':
      return { data: soloColectivosTripData, source: 'solo-colectivos' };
    case 'subtesList':
      return { data: subtesTripData, source: 'subtes' };
    case 'searchResults':
      return { data: buscarTransportData, source: 'buscar' };
    case 'trenesList':
      return { data: [], source: 'trenes' };
    default:
      return { data: [], source: 'desconocido' };
  }
}

function refreshFavoriteAwareViews() {
  const currentView = getViewFromHash();

  if (currentView === 'colectivos' && soloColectivosTripData.length > 0) {
    renderColectivos(soloColectivosTripData, 'soloColectivosList');
  }

  if (currentView === 'subtes' && subtesTripData.length > 0) {
    renderSubtes(subtesTripData, 'subtesList');
  }

  if (currentView === 'buscar' && buscarTransportData.length > 0) {
    renderSearchResults(buscarTransportData, buscarCurrentPage);
  }

  if (currentView === 'favoritos') {
    renderFavoritesView();
  }

  if (currentView === 'detalle' && currentDetailData) {
    renderLineDetails(currentDetailData, currentDetailSource || 'detalle');
  }
}

function renderViewForName(viewName, transportData) {
  switch (viewName) {
    case 'colectivos':
      openColectivosView();
      break;
    case 'subtes':
      openSubtesView();
      break;
    case 'trenes':
      openTrenesView(navigateTo);
      break;
    case 'buscar':
      if (buscarTransportData.length > 0) {
        renderSearchResults(buscarTransportData, buscarCurrentPage);
      }
      break;
    case 'favoritos':
      renderFavoritesView();
      break;
    case 'detalle':
      if (currentDetailData) {
        renderLineDetails(currentDetailData, currentDetailSource || 'detalle');
      }
      break;
    default:
      break;
  }
}

function persistTrainStationsCache(stations) {
  const existing = loadData(TRAIN_STATIONS_CACHE_KEY);
  const base = Array.isArray(existing) ? existing : [];
  const incoming = Array.isArray(stations) ? stations : [];
  const byId = new Map(base.map(item => [String(item?.id_estacion || item?.id || ''), item]));

  incoming.forEach(item => {
    const stationId = String(item?.id_estacion || item?.id || '');
    if (stationId) {
      byId.set(stationId, item);
    }
  });

  saveData(TRAIN_STATIONS_CACHE_KEY, Array.from(byId.values()));
}

function loadTrainStationsCache() {
  const cached = loadData(TRAIN_STATIONS_CACHE_KEY);
  return Array.isArray(cached) ? cached : [];
}

function getActiveListData(listId) {
  switch (listId) {
    case 'colectivosList':
      return { data: getColectivosTripData(), source: 'colectivos' };
    case 'soloColectivosList':
      return { data: getSoloColectivosTripData(), source: 'solo-colectivos' };
    case 'subtesList':
      return { data: getSubtesData(), source: 'subtes' };
    case 'searchResults':
      return { data: getSearchData(), source: 'buscar' };
    default:
      return { data: [], source: 'desconocido' };
  }
}

async function openColectivosView() {
  const { routes } = await fetchColectivosData();
  soloColectivosCurrentPage = 1;
  soloColectivosTripData = routes || [];
  renderColectivos(soloColectivosTripData, 'soloColectivosList');
  navigateTo('colectivos');
}

async function openSubtesView() {
  const routes = await fetchSubtesData();
  subtesTripData = routes;
  renderSubtes(routes, 'subtesList');
  navigateTo('subtes');
}

async function handleLineClick(event) {
  const listId = event.currentTarget.id;

  if (listId === 'trenesList' && handleTrenesListInteraction(event)) {
    return;
  }

  const actionButton = event.target.closest('[data-card-action]');
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.cardAction;

  if (action === 'favorite-detail') {
    if (currentDetailData) {
      toggleFavoriteItem(currentDetailData, currentDetailSource || 'detalle');
      refreshFavoriteAwareViews();
    }
    return;
  }

  if (listId === 'view-favoritos' || listId === 'favoritesList') {
    const favoriteCard = event.target.closest('[data-favorite-id]');
    if (!favoriteCard) {
      return;
    }

    const favoriteItems = getFavoriteItems();
    const favoriteRecord = favoriteItems.find(item => item.favoriteId === favoriteCard.dataset.favoriteId);
    if (!favoriteRecord) {
      return;
    }

    if (action === 'open-favorite') {
      currentDetailData = favoriteRecord.data;
      currentDetailSource = favoriteRecord.source || 'favoritos';
      renderLineDetails(currentDetailData, currentDetailSource);
      navigateTo('detalle');
    }

    if (action === 'remove-favorite') {
      removeFavoriteItem(favoriteRecord.favoriteId);
      refreshFavoriteAwareViews();
    }
    return;
function getItemTripId(item) {
  return item?._ui_id || item?.id || item?.trip?.trip_id || item?.trip_id || item?.vehicle?.vehicle?.id || item?.vehicle?.id || '';
}

function renderFavoriteToggleButton(item, source) {
  const favoriteActive = isFavoriteItem(item, source);
  return `
    <button type="button" class="favorite-toggle ${favoriteActive ? 'is-active' : ''}" data-card-action="favorite" aria-pressed="${favoriteActive}" aria-label="${favoriteActive ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
      ${favoriteActive ? '★' : '☆'}
    </button>
  `;
}

function renderTransportCard({ item, source, title, subtitle, metaLines = [], routeLine = '' }) {
  const uniqueId = getItemTripId(item) || `${source}-${Math.random().toString(16).slice(2)}`;

  return `
    <article class="line-card transport-card" data-trip-id="${uniqueId}" data-source="${source}">
      <button type="button" class="transport-card-main" data-card-action="open">
        <div class="line-card-main">
          <div>
            <p class="line-number">${title}</p>
            <p class="line-subtitle">${subtitle}</p>
          </div>
        </div>
        ${routeLine ? `<p class="line-route">${routeLine}</p>` : ''}
        ${metaLines.map(line => `<p class="line-meta">${line}</p>`).join('')}
      </button>
      ${renderFavoriteToggleButton(item, source)}
    </article>
  `;
}

function renderHomeHistoryPreview() {
  const homeHistoryPreview = document.getElementById('homeHistoryPreview');
  if (!homeHistoryPreview) return;

  const recentHistory = getHistoryItems().slice(0, 3);

  if (recentHistory.length === 0) {
    homeHistoryPreview.innerHTML = `
      <article class="status-item">
        <div>
          <p class="status-title">Todavia no hay historial</p>
          <p class="line-meta">Tus ultimas consultas de trenes y colectivos van a aparecer aca.</p>
        </div>
      </article>
    `;
    return;
  }

  homeHistoryPreview.innerHTML = recentHistory.map(record => `
    <article class="line-card home-history-card" data-home-history-id="${record.historyId}">
      <button type="button" class="transport-card-main" data-home-history-action="open">
        <div class="line-card-main">
          <div>
            <p class="line-number">${record.title || 'Consulta reciente'}</p>
            <p class="line-subtitle">${record.subtitle || 'Historial'}</p>
          </div>
          <span class="home-history-pill">${record.source === 'trenes' || record.kind === 'train-station' ? 'Tren' : record.source === 'subtes' ? 'Subte' : 'Colectivo'}</span>
        </div>
        <p class="line-meta">Abrir consulta reciente</p>
      </button>
    </article>
  `).join('');
}

function openHistoryRecordFromHome(historyId) {
  const historyRecord = getHistoryItems().find(item => item.historyId === historyId);
  if (!historyRecord) {
    return;
  }

  if (historyRecord.kind === 'train-station') {
    const stationId = historyRecord.data?.id_estacion || historyRecord.data?.id;
    if (stationId) {
      addHistoryItem(historyRecord.data, 'trenes', { kind: 'train-station' });
      window.location.href = `./detail.html?id=${encodeURIComponent(stationId)}`;
    }
    return;
  }

  addHistoryItem(historyRecord.data, historyRecord.source || 'historial');
  renderLineDetails(historyRecord.data, historyRecord.source || 'historial');
  navigateTo('detalle');
}

function refreshFavoriteAwareViews() {
  const currentView = getViewFromHash();

  renderHomeHistoryPreview();

  if (currentView === 'colectivos' && getColectivosTripData().length > 0) {
    renderColectivosLines(getColectivosTripData(), getColectivosCurrentPage(), renderTransportCard);
  }

  if (currentView === 'solo-colectivos' && getSoloColectivosTripData().length > 0) {
    renderSoloColectivosLines(getSoloColectivosTripData(), getSoloColectivosCurrentPage(), renderTransportCard);
  }

  if (currentView === 'subtes' && getSubtesData().length > 0) {
    refreshSubtesView(renderTransportCard);
  }

  if (currentView === 'buscar' && getSearchData().length > 0) {
    renderSearchResults(getSearchData(), getSearchCurrentPage());
  }

  if (currentView === 'favoritos') {
    renderFavoritesView();
  }

  if (currentView === 'historial') {
    renderHistoryView();
  }

  if (currentView === 'detalle' && currentDetailData) {
    renderLineDetails(currentDetailData, currentDetailSource || 'detalle');
  }
}

function renderViewForName(viewName, transportData) {
  switch (viewName) {
    case 'colectivos':
      if (transportData) {
        renderColectivosLines(transportData, getColectivosCurrentPage(), renderTransportCard);
      } else if (getColectivosTripData().length > 0) {
        renderColectivosLines(getColectivosTripData(), getColectivosCurrentPage(), renderTransportCard);
      }
      break;
    case 'solo-colectivos':
      if (transportData) {
        renderSoloColectivosLines(transportData, getSoloColectivosCurrentPage(), renderTransportCard);
      } else if (getSoloColectivosTripData().length > 0) {
        renderSoloColectivosLines(getSoloColectivosTripData(), getSoloColectivosCurrentPage(), renderTransportCard);
      }
      break;
    case 'subtes':
      if (getSubtesData().length > 0) {
        renderSubtesLines(getSubtesData(), getSubtesCurrentPage(), renderTransportCard);
      }
      break;
    case 'buscar':
      if (getSearchData().length > 0) {
        renderSearchResults(getSearchData(), getSearchCurrentPage());
      }
      break;
    case 'favoritos':
      renderFavoritesView();
      break;
    case 'historial':
      renderHistoryView();
      break;
    case 'detalle':
      if (currentDetailData) {
        renderLineDetails(currentDetailData, currentDetailSource || 'detalle');
      }
      break;
    default:
      break;
  }
}

  const clickedCard = event.target.closest('.transport-card');
  if (!clickedCard) {
    return;
  }

  const tripId = clickedCard.dataset.tripId;
  if (!tripId) {
    console.warn('La tarjeta no tiene un data-trip-id.');
  }

  const { data: dataArray, source } = getActiveListData(listId);
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    console.error('No se pudo determinar la lista de origen.');
    return;
  }

  if (action === 'line-detail') {
    const btnType = actionButton.dataset.type;

    if (btnType === 'subte') {
      const tripId = actionButton.dataset.tripId;
      const paradas = getParadasBySubteRoute(tripId) || [];
      const routes = getSubtesRoutes();
      const routeInfo = routes.find(r => String(r.route_id) === String(tripId)) || {};

      let realTimeSubte = null;
      try {
        realTimeSubte = await getSubtesRealTime();
      } catch (error) {
        console.error('Error al obtener posiciones en tiempo real de subtes:', error);
      }

      currentDetailData = { isStaticSubte: true, routeId: tripId, paradas, routeInfo, realTimeSubte };
      currentDetailSource = 'subtes';
      navigateTo('detalle');
      return;
    } else if (btnType === 'colectivo') {
      const routeId = actionButton.dataset.routeId;
      const paradas = getParadasByRoute(routeId) || [];
      const routes = getColectivosRoutes();
      const routeInfo = routes.find(r => String(r.route_id) === String(routeId)) || {};
      const agencyId = getAgencyIdByRoute(routeId);

      let realTimeActive = null;
      try {
        realTimeActive = await getColectivosRealTime(routeId, agencyId);
      } catch (error) {
        console.error('Error al obtener tiempo real de colectivos:', error);
      }

      currentDetailData = { isStaticColectivo: true, routeId, paradas, routeInfo, realTimeActive };
      currentDetailSource = 'colectivos';
      navigateTo('detalle');
      return;
    } else {
      const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.route_id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.Linea?.Trip_Id) === tripId);
      if (lineData) {
        currentDetailData = lineData;
        currentDetailSource = source;
        renderLineDetails(lineData, source);
        navigateTo('detalle');
      } else {
        console.warn(`No se encontró información para el viaje con ID: ${tripId}`);
      }
      return;
    }
  }

  if (action === 'favorite') {
    const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.route_id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.Linea?.Trip_Id) === tripId);
    if (lineData) {
      toggleFavoriteItem(lineData, source);
      refreshFavoriteAwareViews();
function handleNavClick(event) {
  event.preventDefault();
  const targetView = event.currentTarget.dataset.view;
  navigateTo(targetView);
}

function renderLineDetails(data, source = 'detalle') {
  const container = document.getElementById('detalleContent');
  if (!container) return;

  currentDetailData = data;
  currentDetailSource = source;

  const tripUpdate = data?.trip_update || data?.tripUpdate || {};
  const vehicle = data?.vehicle || data?.Vehicle || {};
  const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
  const linea = data?.linea || data?.Linea || {};

  let routeName = data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || linea.route_Id || linea.route_id;
  let tripHeadsign = trip.trip_headsign || trip.tripHeadsign || data?.trip?.trip_headsign || 'Sin destino';
  let directionId = trip.direction_id !== undefined ? trip.direction_id : (trip.directionId !== undefined ? trip.directionId : data?.trip?.direction_id);
  let directionLabel = directionId === '1' || directionId === 1 ? 'Vuelta' : 'Ida';
  let lat = vehicle.position?.latitude;
  let lon = vehicle.position?.longitude;
  let speed = vehicle.position?.speed;
  let tripId = trip.trip_id || trip.tripId || data?.trip_id || data?.tripId || 'N/A';
  let vehicleId = vehicle.vehicle?.id || vehicle.id || 'N/A';

  if (tripUpdate.trip || vehicle.trip) {
    tripHeadsign = tripHeadsign === 'Sin destino' ? 'Subte' : tripHeadsign;
    if (directionId === undefined) directionLabel = '';
  }

  routeName = routeName || 'Sin línea';
  const displayRoute = routeName.replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim();
  const favoriteActive = isFavoriteItem(data, source);

  container.innerHTML = `
    <div class="detail-actions">
      <button type="button" class="secondary-btn ${favoriteActive ? 'favorite-active' : ''}" data-card-action="favorite-detail" aria-pressed="${favoriteActive}">${favoriteActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>
    </div>
    <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
      <p class="status-title" style="font-size: 1.25rem;">Línea ${displayRoute === 'Sin línea' ? 'Sin línea' : displayRoute}</p>
      <p class="line-subtitle">${tripHeadsign}${directionLabel ? ` · ${directionLabel}` : ''}</p>
    </article>
    <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
      <p class="status-title">Información del Vehículo</p>
      <p class="line-meta"><strong>ID Vehículo:</strong> ${vehicleId}</p>
      <p class="line-meta"><strong>ID Viaje:</strong> ${tripId}</p>
      <p class="line-meta"><strong>Velocidad:</strong> ${speed !== undefined ? (speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}</p>
    </article>
    <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
      <p class="status-title">Ubicación Actual</p>
      <p class="line-meta"><strong>Latitud:</strong> ${lat !== undefined ? lat.toFixed(5) : 'N/A'}</p>
      <p class="line-meta"><strong>Longitud:</strong> ${lon !== undefined ? lon.toFixed(5) : 'N/A'}</p>
    </article>
  `;
}

function handleLineClick(event) {
  const listId = event.currentTarget.id;

  if (listId === 'trenesList' && handleTrenesListInteraction(event)) {
    return;
  }

  if (listId === 'subtesList' && handleSubtesListInteraction(event)) {
    return;
  }

  if ((listId === 'view-historial' || listId === 'historyList') && handleHistoryClick(event)) {
    return;
  }

  const actionButton = event.target.closest('[data-card-action]');
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.cardAction;

  if (listId === 'searchResults' && handleSearchResultsAction(event)) {
    return;
  }

  if ((listId === 'view-favoritos' || listId === 'favoritesList') && handleFavoritesClick(event)) {
    return;
  }

  const clickedCard = event.target.closest('.transport-card');
  if (!clickedCard) {
    return;
  }

  const tripId = clickedCard.dataset.tripId;
  if (!tripId) {
    console.warn('La tarjeta no tiene un data-trip-id.');
    return;
  }

  const { data: dataArray, source } = getActiveListData(listId);
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    console.error('No se pudo determinar la lista de origen.');
    return;
  }

  if (action === 'favorite') {
    const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id) === tripId);
    if (lineData) {
      toggleFavoriteItem(lineData, source);
    }
    return;
  }

  const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id) === tripId);

  if (lineData) {
    renderLineDetails(lineData, source);
    navigateTo('detalle');
  } else {
    console.warn(`No se encontró información para el viaje con ID: ${tripId}`);
  }
}

async function ensureTransportData() {
  const storedData = loadData(TRANSPORT_DATA_KEY);
  if (storedData) {
    return storedData;
  }

  try {
    const data = await getVehiclePositions();
    saveData(TRANSPORT_DATA_KEY, data);
    return data;
  } catch (error) {
    console.error('Error al obtener datos de transporte:', error);
    return null;
  }
}

function initHeaderOnScroll() {
  const topHeader = document.getElementById('topHeader');
  if (!topHeader) return;

  const threshold = 90;
  const updateHeader = () => {
    topHeader.classList.toggle('visible', window.scrollY > threshold);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader);
}

window.addEventListener('hashchange', async () => {
  const viewName = getViewFromHash();
  setActiveView(viewName);
  const transportData = viewName === 'colectivos' || viewName === 'solo-colectivos' ? await ensureTransportData() : null;
  renderViewForName(viewName, transportData);
});

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.bottom-nav .nav-link').forEach(link => link.addEventListener('click', handleNavClick));
  initFavoritesModule({
    loadData,
    saveData,
    storageKey: FAVORITES_STORAGE_KEY,
    getStationLineFromRamales,
    onFavoritesChanged: refreshFavoriteAwareViews,
    openStationDetail: (stationId, stationData = null) => {
      if (stationData) {
        addHistoryItem(stationData, 'trenes', { kind: 'train-station' });
      }
      window.location.href = `./detail.html?id=${encodeURIComponent(stationId)}`;
    },
    openTransportDetail: (data, source = 'detalle') => {
      addHistoryItem(data, source);
      renderLineDetails(data, source);
      navigateTo('detalle');
    },
  });

  initHistoryModule({
    loadData,
    saveData,
    storageKey: HISTORY_STORAGE_KEY,
    getStationLineFromRamales,
    navigateTo,
    onHistoryChanged: () => {
      renderHomeHistoryPreview();
      if (getViewFromHash() === 'historial') {
        renderHistoryView();
      }
    },
    openStationDetail: (stationId, stationData = null) => {
      if (stationData) {
        addHistoryItem(stationData, 'trenes', { kind: 'train-station' });
      }
      window.location.href = `./detail.html?id=${encodeURIComponent(stationId)}`;
    },
    openTransportDetail: (data, source = 'detalle') => {
      addHistoryItem(data, source);
      renderLineDetails(data, source);
      navigateTo('detalle');
    },
  });

  initSearchModule({
    ensureTransportData,
    getSubtesData,
    loadSubtesData,
    loadTrainStationsCache,
    persistTrainStationsCache,
    getStationLineFromRamales,
    isFavoriteItem,
    toggleFavoriteItem,
    openStationDetail: (stationId, stationData = null) => {
      if (stationData) {
        addHistoryItem(stationData, 'trenes', { kind: 'train-station' });
      }
      window.location.href = `./detail.html?id=${encodeURIComponent(stationId)}`;
    },
    openTransportDetail: (data, source = 'detalle') => {
      addHistoryItem(data, source);
      renderLineDetails(data, source);
      navigateTo('detalle');
    },
    openSubteStationDetail: (stationName, lineId = '', stationData = null) => {
      if (stationData) {
        addHistoryItem(stationData, 'subtes');
      }
      const params = new URLSearchParams({
        station: stationName || '',
        linea: lineId || '',
      });
      window.location.href = `./subte-detail.html?${params.toString()}`;
    },
  });

  navLinks.forEach(link => link.addEventListener('click', handleNavClick));
  setActiveView(getViewFromHash());
  initHeaderOnScroll();

  const homeSearchBtn = document.getElementById('homeSearchBtn');
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');
  const buscarBackBtn = document.getElementById('buscarBackBtn');
  const searchTypeFilters = Array.from(document.querySelectorAll('[data-search-type]'));
  const homeColectivosCard = document.getElementById('homeColectivosCard');
  const homeTrenesCard = document.getElementById('homeTrenesCard');
  const homeFavoritesCard = document.getElementById('homeFavoritesCard');
  const homeSubtesCard = document.getElementById('homeSubtesCard');
  const homeHistoryViewAllBtn = document.getElementById('homeHistoryViewAllBtn');
  const homeHistoryPreview = document.getElementById('homeHistoryPreview');

  const colectivosList = document.getElementById('colectivosList');
  const soloColectivosList = document.getElementById('soloColectivosList');
  const searchResults = document.getElementById('searchResults');
  const favoritesSection = document.getElementById('view-favoritos');
  const historySection = document.getElementById('view-historial');
  const detalleBackBtn = document.getElementById('detalleBackBtn');
  const subtesBackBtn = document.getElementById('subtesBackBtn');
  const trenesBackBtn = document.getElementById('trenesBackBtn');
  const subtesList = document.getElementById('subtesList');

  colectivosList?.addEventListener('click', handleLineClick);
  soloColectivosList?.addEventListener('click', handleLineClick);
  searchResults?.addEventListener('click', handleLineClick);
  favoritesSection?.addEventListener('click', handleLineClick);
  historySection?.addEventListener('click', handleLineClick);
  homeHistoryPreview?.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-home-history-action]');
    if (!actionButton) return;

    const historyCard = event.target.closest('[data-home-history-id]');
    const historyId = historyCard?.dataset.homeHistoryId;
    if (!historyId) return;

    openHistoryRecordFromHome(historyId);
  });

  detalleBackBtn?.addEventListener('click', () => {
    if (currentDetailSource === 'colectivos' || currentDetailSource === 'solo-colectivos') {
      navigateTo('colectivos');
    } else if (currentDetailSource === 'subtes') {
      navigateTo('subtes');
    } else if (currentDetailSource === 'trenes') {
      navigateTo('trenes');
    } else if (currentDetailSource === 'buscar') {
      navigateTo('buscar');
    } else if (currentDetailSource === 'favoritos') {
      navigateTo('favoritos');
    } else {
      window.history.back();
    }
  });

  favoritesSection?.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-favorites-action]');
    if (!actionButton) return;

    if (actionButton.dataset.favoritesAction === 'browse-colectivos') {
      openColectivosView({ ensureTransportData, navigateTo, renderTransportCard });
      return;
    }

    if (actionButton.dataset.favoritesAction === 'go-home') {
      navigateTo('home');
    }
  });

  const transportData = await ensureTransportData();
  if (transportData) {
    console.log('Datos de transporte cargados y almacenados localmente.');
  }

  homeSearchBtn?.addEventListener('click', () => {
    navigateTo('buscar');
  });

  homeHistoryViewAllBtn?.addEventListener('click', () => {
    navigateTo('historial');
  });

  setSearchTransportType('trenes');

  buscarBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  searchTypeFilters.forEach(button => {
    button.addEventListener('click', async () => {
      const nextType = button.dataset.searchType || 'trenes';
      setSearchTransportType(nextType);
    });
  });

  homeColectivosCard?.addEventListener('click', () => openSoloColectivosView({ ensureTransportData, navigateTo, renderTransportCard }));
  homeColectivosCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSoloColectivosView({ ensureTransportData, navigateTo, renderTransportCard });
    }
  });

  homeTrenesCard?.addEventListener('click', () => openTrenesView(navigateTo));
  homeTrenesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTrenesView(navigateTo);
    }
  });

  homeFavoritesCard?.addEventListener('click', () => navigateTo('favoritos'));
  homeFavoritesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('favoritos');
    }
  });

  homeSubtesCard?.addEventListener('click', () => openSubtesView(navigateTo, renderTransportCard));
  homeSubtesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSubtesView(navigateTo, renderTransportCard);
    }
  });

  const trenesBackBtn = document.getElementById('trenesBackBtn');
  const trenesList = document.getElementById('trenesList');

  trenesBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  trenesList?.addEventListener('click', handleLineClick);

  bindColectivosControls({ navigateTo, renderTransportCard });
  bindSubtesControls({ navigateTo, renderTransportCard });


  renderViewForName(getViewFromHash(), transportData);
  renderHomeHistoryPreview();

  searchButton?.addEventListener('click', async () => {
    await runIntegratedSearch(searchInput?.value || '');
  });

  searchInput?.addEventListener('keydown', async event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await runIntegratedSearch(searchInput.value || '');
    }
  });

  bindSearchPaginationControls();
});
