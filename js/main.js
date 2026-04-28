import { getVehiclePositions, getColectivosRealTime, getSubtesRealTime } from './api.js';
import { saveData, loadData, toggleFavoriteItem, removeFavoriteItem, getFavoriteItems } from './storage.js';
import { renderFavoritesView,renderColectivos, renderColectivosLines, renderSoloColectivosLines, renderSearchResults, renderLineDetails, renderSubtes } from './ui.js';
import { openTrenesView, handleTrenesListInteraction, getStationLineFromRamales, ensureTrenesLineasLoaded, ensureTrenesRamalesLoaded } from './trenes.js';
import { fetchSubtesData, getSubtesRoutes, getParadasBySubteRoute } from './subtes.js';

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
    renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
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

function handleNavClick(event) {
  event.preventDefault();
  const targetView = event.currentTarget.dataset.view;
  navigateTo(targetView);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (char === ',' && !insideQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map(value => value.trim());
}

function parseTripsContent(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
}

async function openColectivosView() {
  const transportData = await ensureTransportData();
  soloColectivosCurrentPage = 1;
  soloColectivosTripData = transportData || [];
  renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
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
    }
    return;
  }

  const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.route_id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.Linea?.Trip_Id) === tripId);

  if (lineData) {
    currentDetailData = lineData;
    currentDetailSource = source;
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
  setActiveView(getViewFromHash());
  initHeaderOnScroll();

  const homeSearchBtn = document.getElementById('homeSearchBtn');
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');
  const buscarBackBtn = document.getElementById('buscarBackBtn');
  const searchTypeFilters = Array.from(document.querySelectorAll('[data-search-type]'));
  const homeColectivosCard = document.getElementById('homeColectivosCard');
  const homeTrenesCard = document.getElementById('homeTrenesCard');
  const homeSubtesCard = document.getElementById('homeSubtesCard');
  const homeFavoritesCard = document.getElementById('homeFavoritesCard');
  const colectivosBackBtn = document.getElementById('colectivosBackBtn');
  const colectivosPrevBtn = document.getElementById('colectivosPrevBtn');
  const colectivosNextBtn = document.getElementById('colectivosNextBtn');
  const colectivosPrev10Btn = document.getElementById('colectivosPrev10Btn');
  const colectivosNext10Btn = document.getElementById('colectivosNext10Btn');

  const colectivosList = document.getElementById('colectivosList');
  const soloColectivosList = document.getElementById('soloColectivosList');
  const searchResults = document.getElementById('searchResults');
  const favoritesSection = document.getElementById('view-favoritos');
  const detalleBackBtn = document.getElementById('detalleBackBtn');
  const subtesBackBtn = document.getElementById('subtesBackBtn');
  const trenesBackBtn = document.getElementById('trenesBackBtn');
  const subtesList = document.getElementById('subtesList');

  colectivosList?.addEventListener('click', handleLineClick);
  soloColectivosList?.addEventListener('click', handleLineClick);
  searchResults?.addEventListener('click', handleLineClick);
  subtesList?.addEventListener('click', handleLineClick);
  favoritesSection?.addEventListener('click', handleLineClick);

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
      openColectivosView();
      return;
    }

    if (actionButton.dataset.favoritesAction === 'go-home') {
      navigateTo('home');
    }
  });

  homeSearchBtn?.addEventListener('click', () => {
    navigateTo('buscar');
  });

  buscarBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  searchTypeFilters.forEach(button => {
    button.addEventListener('click', async () => {
      // Retain logic if type changes
    });
  });

  homeColectivosCard?.addEventListener('click', () => openColectivosView());
  homeColectivosCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openColectivosView();
    }
  });

  homeTrenesCard?.addEventListener('click', () => openTrenesView(navigateTo));
  homeTrenesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTrenesView(navigateTo);
    }
  });

  homeSubtesCard?.addEventListener('click', () => openSubtesView());
  homeSubtesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSubtesView();
    }
  });

  homeFavoritesCard?.addEventListener('click', () => navigateTo('favoritos'));
  homeFavoritesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('favoritos');
    }
  });
  colectivosNextBtn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(colectivosTripData.length / COLECTIVOS_PAGE_SIZE));
    if (colectivosCurrentPage < totalPages) {
      colectivosCurrentPage += 1;
      renderColectivosLines(colectivosTripData, colectivosCurrentPage);
    }
  });

  colectivosPrev10Btn?.addEventListener('click', () => {
    if (colectivosCurrentPage > 1) {
      colectivosCurrentPage = Math.max(1, colectivosCurrentPage - 10);
      renderColectivosLines(colectivosTripData, colectivosCurrentPage);
    }
  });

  colectivosNext10Btn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(colectivosTripData.length / COLECTIVOS_PAGE_SIZE));
    if (colectivosCurrentPage < totalPages) {
      colectivosCurrentPage = Math.min(totalPages, colectivosCurrentPage + 10);
      renderColectivosLines(colectivosTripData, colectivosCurrentPage);
    }
  });

  const soloColectivosBackBtn = document.getElementById('soloColectivosBackBtn');
  const soloColectivosPrevBtn = document.getElementById('soloColectivosPrevBtn');
  const soloColectivosNextBtn = document.getElementById('soloColectivosNextBtn');
  const soloColectivosPrev10Btn = document.getElementById('soloColectivosPrev10Btn');
  const soloColectivosNext10Btn = document.getElementById('soloColectivosNext10Btn');

  colectivosBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  soloColectivosBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  soloColectivosPrevBtn?.addEventListener('click', () => {
    if (soloColectivosCurrentPage > 1) {
      soloColectivosCurrentPage -= 1;
      renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
    }
  });

  soloColectivosNextBtn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(soloColectivosTripData.length / SOLO_COLECTIVOS_PAGE_SIZE));
    if (soloColectivosCurrentPage < totalPages) {
      soloColectivosCurrentPage += 1;
      renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
    }
  });

  soloColectivosPrev10Btn?.addEventListener('click', () => {
    if (soloColectivosCurrentPage > 1) {
      soloColectivosCurrentPage = Math.max(1, soloColectivosCurrentPage - 10);
      renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
    }
  });

  soloColectivosNext10Btn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(soloColectivosTripData.length / SOLO_COLECTIVOS_PAGE_SIZE));
    if (soloColectivosCurrentPage < totalPages) {
      soloColectivosCurrentPage = Math.min(totalPages, soloColectivosCurrentPage + 10);
      renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
    }
  });

  subtesBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  trenesBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  // Cargar datos estáticos y de la API al final
  // Esto evita que la API bloquee la inicialización de los botones en la UI
  await ensureTrenesLineasLoaded();
  await ensureTrenesRamalesLoaded();
  const transportData = await ensureTransportData();
  if (transportData) console.log('Datos de transporte cargados y almacenados localmente.');

  renderViewForName(getViewFromHash(), transportData);

  searchButton?.addEventListener('click', async () => {
    const allData = await ensureTransportData();
    if (!allData) {
      renderSearchResults([]);
      return;
    }

    buscarCurrentPage = 1;
    buscarTransportData = allData;
    renderSearchResults(buscarTransportData, buscarCurrentPage);
  });

  searchInput?.addEventListener('keydown', async event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchButton.click();
    }
  });

});