﻿import { getVehiclePositions, getSubteRecorrido } from './api.js';
import { saveData, loadData } from './storage.js';
import { openTrenesView, handleTrenesListInteraction, getStationLineFromRamales } from './trenes.js';
import { renderLineDetails as renderLineDetailsUI } from './ui.js';
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
  loadAndRenderSubtesActivos,
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
let detailRefreshInterval = null;

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

function stopDetailRefresh() {
  if (detailRefreshInterval) {
    clearInterval(detailRefreshInterval);
    detailRefreshInterval = null;
  }
}

function startDetailRefresh() {
  stopDetailRefresh(); // Nos aseguramos de no tener intervalos duplicados
  detailRefreshInterval = setInterval(async () => {
    if (getViewFromHash() !== 'detalle') {
      stopDetailRefresh();
      return;
    }
        
        let dataActualizada = false;

    // Si estamos viendo el detalle de un subte y tenemos su ID, pedimos los datos actualizados
    if (currentDetailData && currentDetailData.isStaticSubte && currentDetailData._subteId) {
      try {
        const entidad = await getSubteRecorrido(currentDetailData._subteId);
        currentDetailData.realTimeSubte = { Entity: [entidad] };
        renderLineDetailsUI(currentDetailData, currentDetailSource);
            dataActualizada = true;
      } catch (error) {
        console.error('Error al auto-recargar el subte:', error);
      }
    }
        // Si estamos viendo el detalle de un colectivo
        else if (currentDetailData && currentDetailData.id_vehiculo) {
          try {
            const colectivos = await getVehiclePositions();
            const colectivoActualizado = colectivos.find(c => c.id_vehiculo === currentDetailData.id_vehiculo);
            if (colectivoActualizado) {
              currentDetailData = colectivoActualizado;
              renderLineDetailsUI(currentDetailData, currentDetailSource);
              dataActualizada = true;
            }
          } catch (error) {
            console.error('Error al auto-recargar el colectivo:', error);
          }
        }

        if (dataActualizada) {
          // ¡Magia! Hacemos un "flash" en el contenedor para mostrar que se actualizó.
          const container = document.getElementById('detalleContent');
          if (container) {
            container.classList.remove('content-refreshed');
            void container.offsetWidth; // Forzamos un reflow visual para reiniciar la animación
            container.classList.add('content-refreshed');
            container.addEventListener('animationend', () => {
              container.classList.remove('content-refreshed');
            }, { once: true });
          }
        }
  }, 30000); // 30000 milisegundos = 30 segundos
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

function getItemTripId(item) {
  return item?._ui_id || item?.id_vehiculo || item?.id || item?.trip?.trip_id || item?.trip_id || item?.vehicle?.vehicle?.id || item?.vehicle?.id || '';
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

async function renderViewForName(viewName, transportData) {
  switch (viewName) {
    case 'colectivos': {
      if (!transportData && getColectivosTripData().length === 0) {
        const list = document.getElementById('colectivosList');
        if (list) list.innerHTML = '<p class="empty">Cargando líneas de colectivos...</p>';
      }
      const dataCol = transportData || await ensureTransportData();
      renderColectivosLines(dataCol, getColectivosCurrentPage(), renderTransportCard);
      break;
    }
    case 'solo-colectivos': {
      if (!transportData && getSoloColectivosTripData().length === 0) {
        const list = document.getElementById('soloColectivosList');
        if (list) list.innerHTML = '<p class="empty">Cargando líneas de colectivos...</p>';
      }
      const dataSolo = transportData || await ensureTransportData();
      renderSoloColectivosLines(dataSolo, getSoloColectivosCurrentPage(), renderTransportCard);
      break;
    }
    case 'subtes': {
      if (getSubtesData().length === 0) {
        const subtesActivosList = document.getElementById('subtesActivosList');
        if (subtesActivosList) subtesActivosList.innerHTML = '<p class="empty">Buscando formaciones activas...</p>';
      }
      const subtesData = await loadSubtesData();
      renderSubtesLines(subtesData, getSubtesCurrentPage(), renderTransportCard);
      loadAndRenderSubtesActivos();
      break;
    }
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
function handleNavClick(event) {
  event.preventDefault();
  const targetView = event.currentTarget.dataset.view;
  navigateTo(targetView);
}

function renderLineDetails(data, source = 'detalle') {
  currentDetailData = data;
  currentDetailSource = source;
  renderLineDetailsUI(data, source);
  startDetailRefresh();
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
    const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id_vehiculo || item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id) === tripId);
    if (lineData) {
      toggleFavoriteItem(lineData, source);
    }
    return;
  }

  const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id_vehiculo || item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || item.vehicle?.id) === tripId);

  if (lineData) {
    renderLineDetails(lineData, source);
    navigateTo('detalle');
  } else {
    console.warn(`No se encontró información para el viaje con ID: ${tripId}`);
  }
}

async function ensureTransportData() {
  const storedData = loadData(TRANSPORT_DATA_KEY);
  // Verificamos que los datos cacheados sean del formato nuevo de tu servidor ngrok
  if (Array.isArray(storedData) && storedData.length > 0 && storedData[0].id_vehiculo) {
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
  if (viewName !== 'detalle') {
    stopDetailRefresh();
  }
  await renderViewForName(viewName, null);
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
  const subtesActivosList = document.getElementById('subtesActivosList');
  const detalleContent = document.getElementById('detalleContent');

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

  detalleContent?.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-card-action="favorite-detail"]');
    if (actionButton && currentDetailData) {
      toggleFavoriteItem(currentDetailData, currentDetailSource || 'detalle');
      refreshFavoriteAwareViews();
    }
  });

  subtesActivosList?.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-active-subte-id]');
    if (!btn) return;

    const subteId = btn.dataset.activeSubteId;
    const linea = btn.dataset.activeSubteLine;
    const color = btn.dataset.activeSubteColor;
    const destino = btn.dataset.activeSubteDest;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<p class="line-meta">Cargando recorrido...</p>';
    btn.disabled = true;

    try {
      const entidad = await getSubteRecorrido(subteId);
      const stopUpdates = entidad?.Linea?.Estaciones || entidad?.TripUpdate?.StopTimeUpdate || entidad?.trip_update?.stop_time_update || [];
      const activeStopIds = stopUpdates.map(stu => stu.stop_id || stu.StopId);

      const catalog = getSubtesData();
      const lineaData = catalog.find(l => l.id === linea);

      let paradas = [];
      if (lineaData && lineaData.ramales) {
        lineaData.ramales.forEach(r => {
          r.estaciones.forEach(est => {
            if (activeStopIds.includes(est.id) && !paradas.some(p => p.stop_id === est.id)) {
              paradas.push({ stop_id: est.id, stop_name: est.nombre });
            }
          });
        });
      }

      paradas.sort((a, b) => activeStopIds.indexOf(a.stop_id) - activeStopIds.indexOf(b.stop_id));

      const detailData = { isStaticSubte: true, routeId: linea, paradas: paradas, routeInfo: { route_short_name: linea, route_long_name: `Hacia ${destino}`, route_color: color, route_text_color: 'ffffff' }, realTimeSubte: { Entity: [entidad] }, _subteId: subteId };

      renderLineDetails(detailData, 'subtes');
      navigateTo('detalle');
    } catch (error) {
      console.error('Error cargando recorrido:', error);
      alert('La formación ya finalizó su recorrido o no está disponible.');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
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
      navigateTo('colectivos');
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

  homeColectivosCard?.addEventListener('click', () => navigateTo('colectivos'));
  homeColectivosCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('colectivos');
    }
  });

  homeTrenesCard?.addEventListener('click', () => navigateTo('trenes'));
  homeTrenesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('trenes');
    }
  });

  homeFavoritesCard?.addEventListener('click', () => navigateTo('favoritos'));
  homeFavoritesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('favoritos');
    }
  });

  homeSubtesCard?.addEventListener('click', () => navigateTo('subtes'));
  homeSubtesCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateTo('subtes');
    }
  });

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
