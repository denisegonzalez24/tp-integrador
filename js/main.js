import { getVehiclePositions } from './api.js';
import { saveData, loadData, toggleFavoriteItem, removeFavoriteItem, getFavoriteItems } from './storage.js';
import { fetchStaticSubteData, enrichSubteRealTimeData } from './subtes.js';
import { renderFavoritesView, renderColectivosLines, renderSoloColectivosLines, renderSubtesLines, renderSearchResults, renderLineDetails, renderSubtes } from './ui.js';

const TRANSPORT_DATA_KEY = 'transportData';
const views = Array.from(document.querySelectorAll('.view'));
const navLinks = Array.from(document.querySelectorAll('.bottom-nav .nav-link'));
const validViews = views.map(view => view.id.replace('view-', ''));
let colectivosCurrentPage = 1;
const COLECTIVOS_PAGE_SIZE = 10;
let colectivosTripData = [];
let buscarCurrentPage = 1;
const BUSCAR_PAGE_SIZE = 10;
let buscarTransportData = [];
let soloColectivosCurrentPage = 1;
const SOLO_COLECTIVOS_PAGE_SIZE = 10;
let soloColectivosTripData = [];
let staticSubteData = null;
let subtesData = { Entity: [] };
let subtesCurrentPage = 1;
const SUBTES_PAGE_SIZE = 10;
let subtesDataArray = [];
let currentDetailData = null;
let currentDetailSource = null;

function getViewFromHash() {
  const hash = window.location.hash.slice(1).toLowerCase();
  return validViews.includes(hash) ? hash : 'home';
}

function setActiveView(viewName) {
  const targetId = `view-${viewName}`;

  views.forEach(view => {
    view.classList.toggle('active', view.id === targetId);
  });

  navLinks.forEach(link => {
    link.classList.toggle('nav-link-active', link.dataset.view === viewName);
  });
}

function navigateTo(viewName) {
  const target = validViews.includes(viewName) ? viewName : 'home';
  window.location.hash = target;
}

function getActiveListData(listId) {
  switch (listId) {
    case 'colectivosList':
      return { data: colectivosTripData, source: 'colectivos' };
    case 'soloColectivosList':
      return { data: soloColectivosTripData, source: 'solo-colectivos' };
    case 'subtesList':
      return { data: subtesDataArray, source: 'subtes' };
    case 'searchResults':
      return { data: buscarTransportData, source: 'buscar' };
    default:
      return { data: [], source: 'desconocido' };
  }
}

function refreshFavoriteAwareViews() {
  const currentView = getViewFromHash();

  if (currentView === 'colectivos' && colectivosTripData.length > 0) {
    renderColectivosLines(colectivosTripData, colectivosCurrentPage);
  }

  if (currentView === 'solo-colectivos' && soloColectivosTripData.length > 0) {
    renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
  }

  if (currentView === 'subtes' && subtesDataArray.length > 0) {
    renderSubtesLines(subtesDataArray, subtesCurrentPage);
  }

  if (currentView === 'buscar' && buscarTransportData.length > 0) {
    renderSearchResults(buscarTransportData, buscarCurrentPage);
  }

  if (currentView === 'favoritos') {
    renderFavoritesView();
  }

  if (currentView === 'detalle' && currentDetailData) {
    renderLineDetails(currentDetailData, currentDetailSource || 'detalle', staticSubteData);
  }
}

function renderViewForName(viewName, transportData) {
  switch (viewName) {
    case 'colectivos':
      if (transportData) colectivosTripData = transportData;
      if (colectivosTripData.length > 0) {
        renderColectivosLines(colectivosTripData, colectivosCurrentPage);
      }
      break;
    case 'solo-colectivos':
      if (transportData) soloColectivosTripData = transportData;
      if (soloColectivosTripData.length > 0) {
        renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
      }
      break;
    case 'subtes':
      if (subtesDataArray.length > 0) {
        renderSubtesLines(subtesDataArray, subtesCurrentPage);
      }
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
        renderLineDetails(currentDetailData, currentDetailSource || 'detalle', staticSubteData);
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
  colectivosCurrentPage = 1;
  colectivosTripData = transportData || [];
  renderColectivosLines(colectivosTripData, colectivosCurrentPage);
  navigateTo('colectivos');
}

async function openSoloColectivosView() {
  const transportData = await ensureTransportData();
  soloColectivosCurrentPage = 1;
  soloColectivosTripData = transportData || [];
  renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage);
  navigateTo('solo-colectivos');
}

function handleLineClick(event) {
  const actionButton = event.target.closest('[data-card-action]');
  if (!actionButton) {
    return;
  }

  const listId = event.currentTarget.id;
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
      renderLineDetails(currentDetailData, currentDetailSource, staticSubteData);
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
    return;
  }

  const { data: dataArray, source } = getActiveListData(listId);
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    console.error('No se pudo determinar la lista de origen.');
    return;
  }

  if (action === 'favorite') {
    const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.Linea?.Trip_Id) === tripId);
    if (lineData) {
      toggleFavoriteItem(lineData, source);
      refreshFavoriteAwareViews();
    }
    return;
  }

  const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id || item.Linea?.Trip_Id) === tripId);

  if (lineData) {
    currentDetailData = lineData;
    currentDetailSource = source;
    renderLineDetails(lineData, source, staticSubteData);
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
  navLinks.forEach(link => link.addEventListener('click', handleNavClick));
  setActiveView(getViewFromHash());
  initHeaderOnScroll();

  staticSubteData = await fetchStaticSubteData();

  const homeSearchBtn = document.getElementById('homeSearchBtn');
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');
  const homeColectivosCard = document.getElementById('homeColectivosCard');
  const homeSubtesCard = document.getElementById('homeSubtesCard');
  const homeFavoritesCard = document.getElementById('homeFavoritesCard');
  const colectivosBackBtn = document.getElementById('colectivosBackBtn');
  const colectivosPrevBtn = document.getElementById('colectivosPrevBtn');
  const colectivosNextBtn = document.getElementById('colectivosNextBtn');

  const colectivosList = document.getElementById('colectivosList');
  const soloColectivosList = document.getElementById('soloColectivosList');
  const searchResults = document.getElementById('searchResults');
  const favoritesSection = document.getElementById('view-favoritos');
  const detalleBackBtn = document.getElementById('detalleBackBtn');
  const subtesBackBtn = document.getElementById('subtesBackBtn');
  const subtesList = document.getElementById('subtesList');
  const subtesPrevBtn = document.getElementById('subtesPrevBtn');
  const subtesNextBtn = document.getElementById('subtesNextBtn');
  const subtesPrev10Btn = document.getElementById('subtesPrev10Btn');
  const subtesNext10Btn = document.getElementById('subtesNext10Btn');

  colectivosList?.addEventListener('click', handleLineClick);
  soloColectivosList?.addEventListener('click', handleLineClick);
  searchResults?.addEventListener('click', handleLineClick);
  subtesList?.addEventListener('click', handleLineClick);
  favoritesSection?.addEventListener('click', handleLineClick);

  detalleBackBtn?.addEventListener('click', () => {
    window.history.back(); // Volver a la vista anterior preservando su estado
  });

  favoritesSection?.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-favorites-action]');
    if (!actionButton) return;

    if (actionButton.dataset.favoritesAction === 'browse-colectivos') {
      openColectivosView();
    }
  });

  const transportData = await ensureTransportData();
  if (transportData) {
    console.log('Datos de transporte cargados y almacenados localmente.');
  }

  homeSearchBtn?.addEventListener('click', async () => {
    await ensureTransportData();
    navigateTo('buscar');
  });

  homeColectivosCard?.addEventListener('click', openSoloColectivosView);
  homeColectivosCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSoloColectivosView();
    }
  });

  async function openSubtesView() {
    navigateTo('subtes');
    if (staticSubteData) {
      try {
        const mockResponse = await fetch('./mock/mock_subtes.json').then(r => r.json());
        subtesData = enrichSubteRealTimeData(mockResponse, staticSubteData);
        subtesDataArray = subtesData.Entity || subtesData.entity || [];
        renderSubtes(subtesData, 'subtesList');
        subtesCurrentPage = 1;
        renderSubtesLines(subtesDataArray, subtesCurrentPage);
      } catch (e) {
        console.error('Error cargando mock de subtes:', e);
      }
    }
  }
  homeFavoritesCard?.addEventListener('click', () => navigateTo('favoritos'));
  homeFavoritesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('favoritos');
    }
  });

  homeSubtesCard?.addEventListener('click', openSubtesView);
  homeSubtesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSubtesView();
    }
  });

  colectivosBackBtn?.addEventListener('click', () => {
    navigateTo('home');
  });

  const colectivosPrev10Btn = document.getElementById('colectivosPrev10Btn');
  const colectivosNext10Btn = document.getElementById('colectivosNext10Btn');

  colectivosPrevBtn?.addEventListener('click', () => {
    if (colectivosCurrentPage > 1) {
      colectivosCurrentPage -= 1;
      renderColectivosLines(colectivosTripData, colectivosCurrentPage);
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

  subtesPrevBtn?.addEventListener('click', () => {
    if (subtesCurrentPage > 1) {
      subtesCurrentPage -= 1;
      renderSubtesLines(subtesDataArray, subtesCurrentPage);
    }
  });

  subtesNextBtn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(subtesDataArray.length / SUBTES_PAGE_SIZE));
    if (subtesCurrentPage < totalPages) {
      subtesCurrentPage += 1;
      renderSubtesLines(subtesDataArray, subtesCurrentPage);
    }
  });

  subtesPrev10Btn?.addEventListener('click', () => {
    subtesCurrentPage = Math.max(1, subtesCurrentPage - 10);
    renderSubtesLines(subtesDataArray, subtesCurrentPage);
  });

  subtesNext10Btn?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(subtesDataArray.length / SUBTES_PAGE_SIZE));
    subtesCurrentPage = Math.min(totalPages, subtesCurrentPage + 10);
    renderSubtesLines(subtesDataArray, subtesCurrentPage);
  });

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
});
