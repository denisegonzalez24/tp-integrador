import { getVehiclePositions, getSubtesForecast } from './api.js';
import { saveData, loadData } from './storage.js';

const TRANSPORT_DATA_KEY = 'transportData';
const FAVORITES_STORAGE_KEY = 'favoriteTransportItems';
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
let subtesCurrentPage = 1;
const SUBTES_PAGE_SIZE = 10;
let subtesDataArray = [];
let favoriteItems = loadFavoriteItems();
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

function loadFavoriteItems() {
  const storedFavorites = loadData(FAVORITES_STORAGE_KEY);
  return Array.isArray(storedFavorites) ? storedFavorites : [];
}

function persistFavoriteItems() {
  saveData(FAVORITES_STORAGE_KEY, favoriteItems);
}

function getFavoriteItemId(data, source) {
  const tripUpdate = data?.trip_update || data?.tripUpdate || {};
  const vehicle = data?.vehicle || data?.Vehicle || {};
  const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
  const routeName = String(data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'sin-linea').trim().toLowerCase();
  const tripId = String(trip.trip_id || trip.tripId || data?.trip_id || data?.tripId || data?.id || '').trim().toLowerCase();
  const vehicleId = String(vehicle.vehicle?.id || vehicle.id || '').trim().toLowerCase();

  return `${source}:${routeName}:${tripId || vehicleId || 'item'}`;
}

function isFavoriteItem(data, source) {
  const favoriteId = getFavoriteItemId(data, source);
  return favoriteItems.some(item => item.favoriteId === favoriteId);
}

function buildFavoriteRecord(data, source) {
  const tripUpdate = data?.trip_update || data?.tripUpdate || {};
  const vehicle = data?.vehicle || data?.Vehicle || {};
  const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
  const routeShortName = data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'Sin línea';
  const routeLongName = data?.route_long_name || trip.route_long_name || trip.routeLongName || '';
  const headsign = trip.trip_headsign || trip.tripHeadsign || data?.trip?.trip_headsign || 'Sin destino';
  const favoriteId = getFavoriteItemId(data, source);

  return {
    favoriteId,
    source,
    savedAt: new Date().toISOString(),
    title: source === 'subtes' ? `Subte ${String(routeShortName).replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim()}` : `Línea ${routeShortName}`,
    subtitle: routeLongName || headsign,
    data,
  };
}

function toggleFavoriteItem(data, source) {
  const favoriteId = getFavoriteItemId(data, source);
  const existingIndex = favoriteItems.findIndex(item => item.favoriteId === favoriteId);

  if (existingIndex >= 0) {
    favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
  } else {
    favoriteItems = [buildFavoriteRecord(data, source), ...favoriteItems];
  }

  persistFavoriteItems();
  refreshFavoriteAwareViews();
}

function removeFavoriteItem(favoriteId) {
  favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
  persistFavoriteItems();
  refreshFavoriteAwareViews();
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

function renderFavoriteCard(record) {
  const favoriteData = record?.data || {};
  const title = record?.title || 'Favorito';
  const subtitle = record?.subtitle || 'Guardado en favoritos';
  const routeName = favoriteData?.route_short_name || favoriteData?.route_id || favoriteData?.routeId || favoriteData?.trip?.route_id || favoriteData?.trip?.routeId || favoriteData?.linea?.route_Id || favoriteData?.linea?.route_id || 'Sin línea';
  const vehicle = favoriteData?.vehicle || favoriteData?.Vehicle || {};
  const lat = vehicle.position?.latitude;
  const lon = vehicle.position?.longitude;

  return `
    <article class="status-item favorite-item" data-favorite-id="${record.favoriteId}">
      <button type="button" class="favorite-item-main" data-card-action="open-favorite">
        <p class="status-title">${title}</p>
        <p class="line-subtitle">${subtitle}</p>
        <p class="line-meta">${routeName}${lat !== undefined && lon !== undefined ? ` • Lat ${lat.toFixed(4)} • Lon ${lon.toFixed(4)}` : ''}</p>
      </button>
      <div class="favorite-item-actions">
        <button type="button" class="secondary-btn" data-card-action="remove-favorite">Quitar</button>
      </div>
    </article>
  `;
}

function renderFavoritesView() {
  const favoritesSection = document.getElementById('view-favoritos');
  if (!favoritesSection) return;

  favoritesSection.innerHTML = `
    <div class="hero-card">
      <div class="hero-icon" aria-hidden="true">⭐</div>
      <h2>Favoritos</h2>
      <p class="hero-text">Guardá tus líneas y paradas más usadas para acceder rápido.</p>
      ${favoriteItems.length === 0
      ? `
          <div class="empty-state">
            <p class="status-title">Aún no hay favoritos</p>
            <p class="line-subtitle">Abrí una línea, revisá su detalle y marcala como favorita.</p>
            <button type="button" class="primary-btn favorite-cta" data-favorites-action="browse-colectivos">Ver colectivos</button>
          </div>
        `
      : `
          <div id="favoritesList" class="status-list favorites-list">
            ${favoriteItems.map(renderFavoriteCard).join('')}
          </div>
        `}
    </div>
  `;
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
    renderLineDetails(currentDetailData, currentDetailSource || 'detalle');
  }
}

function renderViewForName(viewName, transportData) {
  switch (viewName) {
    case 'colectivos':
      if (transportData) {
        renderColectivosLines(transportData, colectivosCurrentPage);
      } else if (colectivosTripData.length > 0) {
        renderColectivosLines(colectivosTripData, colectivosCurrentPage);
      }
      break;
    case 'solo-colectivos':
      if (transportData) {
        renderSoloColectivosLines(transportData, soloColectivosCurrentPage);
      } else if (soloColectivosTripData.length > 0) {
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


function getBuscarPageData(page = 1) {
  const startIndex = (page - 1) * BUSCAR_PAGE_SIZE;
  return buscarTransportData.slice(startIndex, startIndex + BUSCAR_PAGE_SIZE);
}

function getColectivosPageData(page = 1) {
  const startIndex = (page - 1) * COLECTIVOS_PAGE_SIZE;
  return colectivosTripData.slice(startIndex, startIndex + COLECTIVOS_PAGE_SIZE);
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

function updateColectivosPaginationControls() {
  const prev10Btn = document.getElementById('colectivosPrev10Btn');
  const prevBtn = document.getElementById('colectivosPrevBtn');
  const nextBtn = document.getElementById('colectivosNextBtn');
  const next10Btn = document.getElementById('colectivosNext10Btn');
  const pageLabel = document.getElementById('colectivosPageLabel');
  const totalPages = Math.max(1, Math.ceil(colectivosTripData.length / COLECTIVOS_PAGE_SIZE));

  if (prev10Btn) prev10Btn.disabled = colectivosCurrentPage <= 1;
  if (prevBtn) prevBtn.disabled = colectivosCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = colectivosCurrentPage >= totalPages;
  if (next10Btn) next10Btn.disabled = colectivosCurrentPage >= totalPages;
  if (pageLabel) pageLabel.textContent = `${colectivosCurrentPage} de ${totalPages}`;
}

function renderColectivosLines(data, page = 1) {
  const listContainer = document.getElementById('colectivosList');
  if (!listContainer) return;

  colectivosTripData = data || [];
  colectivosCurrentPage = page;

  if (!Array.isArray(colectivosTripData) || colectivosTripData.length === 0) {
    listContainer.innerHTML = '<p class="empty">No se encontraron líneas de colectivos.</p>';
    updateColectivosPaginationControls();
    return;
  }

  const pageData = getColectivosPageData(colectivosCurrentPage);

  listContainer.innerHTML = pageData
    .map((item, index) => {
      const uniqueId = item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `colectivo-${index}`;
      item._ui_id = uniqueId;
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;

      return renderTransportCard({
        item,
        source: 'colectivos',
        title: `Línea ${item.route_short_name || 'N/A'}`,
        subtitle: `${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}`,
        routeLine: `Viaje ${item.trip?.trip_id || item.id || 'N/A'} • ${serviceLabel}`,
        metaLines: [
          `Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}`,
        ],
      });
    })
    .join('');

  updateColectivosPaginationControls();
}

async function openColectivosView() {
  const transportData = await ensureTransportData();
  colectivosCurrentPage = 1;
  renderColectivosLines(transportData, colectivosCurrentPage);
  navigateTo('colectivos');
}

function getSoloColectivosPageData(page = 1) {
  const startIndex = (page - 1) * SOLO_COLECTIVOS_PAGE_SIZE;
  return soloColectivosTripData.slice(startIndex, startIndex + SOLO_COLECTIVOS_PAGE_SIZE);
}

function updateSoloColectivosPaginationControls() {
  const prev10Btn = document.getElementById('soloColectivosPrev10Btn');
  const prevBtn = document.getElementById('soloColectivosPrevBtn');
  const nextBtn = document.getElementById('soloColectivosNextBtn');
  const next10Btn = document.getElementById('soloColectivosNext10Btn');
  const pageLabel = document.getElementById('soloColectivosPageLabel');
  const totalPages = Math.max(1, Math.ceil(soloColectivosTripData.length / SOLO_COLECTIVOS_PAGE_SIZE));

  if (prev10Btn) prev10Btn.disabled = soloColectivosCurrentPage <= 1;
  if (prevBtn) prevBtn.disabled = soloColectivosCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = soloColectivosCurrentPage >= totalPages;
  if (next10Btn) next10Btn.disabled = soloColectivosCurrentPage >= totalPages;
  if (pageLabel) pageLabel.textContent = `${soloColectivosCurrentPage} de ${totalPages}`;
}

function renderSoloColectivosLines(data, page = 1) {
  const listContainer = document.getElementById('soloColectivosList');
  if (!listContainer) return;

  soloColectivosTripData = data || [];
  soloColectivosCurrentPage = page;

  if (!Array.isArray(soloColectivosTripData) || soloColectivosTripData.length === 0) {
    listContainer.innerHTML = '<p class="empty">No se encontraron líneas de colectivos.</p>';
    updateSoloColectivosPaginationControls();
    return;
  }

  const pageData = getSoloColectivosPageData(soloColectivosCurrentPage);

  listContainer.innerHTML = pageData
    .map((item, index) => {
      const uniqueId = item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `solo-colectivo-${index}`;
      item._ui_id = uniqueId;
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;

      return renderTransportCard({
        item,
        source: 'solo-colectivos',
        title: `Línea ${item.route_short_name || 'N/A'}`,
        subtitle: `${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}`,
        routeLine: `Viaje ${item.trip?.trip_id || item.id || 'N/A'} • ${serviceLabel}`,
        metaLines: [
          `Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}`,
        ],
      });
    })
    .join('');

  updateSoloColectivosPaginationControls();
}

async function openSoloColectivosView() {
  const transportData = await ensureTransportData();
  soloColectivosCurrentPage = 1;
  renderSoloColectivosLines(transportData, soloColectivosCurrentPage);
  navigateTo('solo-colectivos');
}

function getSubtesPageData(page = 1) {
  const startIndex = (page - 1) * SUBTES_PAGE_SIZE;
  return subtesDataArray.slice(startIndex, startIndex + SUBTES_PAGE_SIZE);
}

function updateSubtesPaginationControls() {
  const prev10Btn = document.getElementById('subtesPrev10Btn');
  const prevBtn = document.getElementById('subtesPrevBtn');
  const nextBtn = document.getElementById('subtesNextBtn');
  const next10Btn = document.getElementById('subtesNext10Btn');
  const pageLabel = document.getElementById('subtesPageLabel');
  const totalPages = Math.max(1, Math.ceil(subtesDataArray.length / SUBTES_PAGE_SIZE));

  if (prev10Btn) prev10Btn.disabled = subtesCurrentPage <= 1;
  if (prevBtn) prevBtn.disabled = subtesCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = subtesCurrentPage >= totalPages;
  if (next10Btn) next10Btn.disabled = subtesCurrentPage >= totalPages;
  if (pageLabel) pageLabel.textContent = `${subtesCurrentPage} de ${totalPages}`;
}

function renderSubtesLines(data, page = 1) {
  const listContainer = document.getElementById('subtesList');
  if (!listContainer) return;

  // Normalizamos los datos (la API puede devolver un array directo o dentro de "entity")
  let normalizedData = [];
  if (Array.isArray(data)) {
    normalizedData = data;
  } else if (data && Array.isArray(data.entity)) {
    normalizedData = data.entity;
  } else if (data && Array.isArray(data.Entity)) {
    normalizedData = data.Entity;
  }

  subtesDataArray = normalizedData;
  subtesCurrentPage = page;

  if (subtesDataArray.length === 0) {
    listContainer.innerHTML = '<p class="empty">No se encontraron datos de subtes.</p>';
    updateSubtesPaginationControls();
    return;
  }

  const pageData = getSubtesPageData(subtesCurrentPage);

  listContainer.innerHTML = pageData.map((item, index) => {
    const tripUpdate = item.trip_update || item.tripUpdate || {};
    const vehicle = item.vehicle || item.Vehicle || {};
    const trip = tripUpdate.trip || vehicle.trip || item.trip || {};
    const linea = item.linea || item.Linea || {};

    let routeName = trip.route_id || trip.routeId || item.route_id || item.routeId || linea.route_Id || linea.route_id || 'Subte';
    const displayRoute = routeName.replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim();
    const tripId = trip.trip_id || trip.tripId || item.trip_id || item.tripId || '';
    const uniqueId = item.id || tripId || `subte-${index}`;
    item._ui_id = uniqueId;

    let arrivalText = 'Arribos en tiempo real';
    const stopTimeUpdates = tripUpdate.stop_time_update || tripUpdate.stopTimeUpdate;

    if (stopTimeUpdates && stopTimeUpdates.length > 0) {
      // Tomamos la primera parada de la lista de actualizaciones
      const firstUpdate = stopTimeUpdates[0];
      const arrivalTime = firstUpdate.arrival?.time || firstUpdate.departure?.time;

      if (arrivalTime) {
        const date = new Date(arrivalTime * 1000); // Convertir de segundos a milisegundos
        const now = new Date();
        const diffMins = Math.round((date - now) / 60000); // Diferencia en minutos

        if (diffMins <= 0) {
          arrivalText = 'Llegando...';
        } else if (diffMins < 60) {
          arrivalText = `Próximo arribo en ${diffMins} min`;
        } else {
          arrivalText = `Próximo arribo: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
      }
    }

    return renderTransportCard({
      item,
      source: 'subtes',
      title: `Línea ${displayRoute === 'Subte' ? 'Subte' : displayRoute}`,
      subtitle: `Subte ${tripId ? `· Viaje ${tripId}` : ''}`,
      routeLine: arrivalText,
    });
  }).join('');

  updateSubtesPaginationControls();
}

async function openSubtesView() {
  const subtesList = document.getElementById('subtesList');
  if (subtesList) subtesList.innerHTML = '<p class="empty">Cargando datos de subtes...</p>';
  navigateTo('subtes');
  const data = await getSubtesForecast().catch(err => console.error(err));
  subtesCurrentPage = 1;
  renderSubtesLines(data || [], subtesCurrentPage);
}

function renderSearchResults(data, page = 1) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  buscarTransportData = data || [];
  buscarCurrentPage = page;

  if (!Array.isArray(buscarTransportData) || buscarTransportData.length === 0) {
    resultsContainer.innerHTML = '<p class="empty">No se encontraron resultados.</p>';
    updateBuscarPaginationControls();
    return;
  }

  const pageData = getBuscarPageData(buscarCurrentPage);

  resultsContainer.innerHTML = pageData.map((item, index) => {
    const routeName = item?.route_short_name || item?.route_id || 'Sin línea';
    const routeLongName = item?.route_long_name || item?.trip?.route_long_name || '';
    const meta = item?.vehicle?.position
      ? `Lat ${item.vehicle.position.latitude.toFixed(4)} • Lon ${item.vehicle.position.longitude.toFixed(4)}`
      : '';
    const uniqueId = item.id || item?.trip?.trip_id || item?.trip_id || item?.vehicle?.vehicle?.id || `buscar-${index}`;
    item._ui_id = uniqueId;
    const serviceId = item?.trip?.service_id || item?.service_id || '';
    const directionId = item?.trip?.direction_id || item?.direction_id || '';
    const vehicleId = item?.vehicle?.vehicle?.id || item?.vehicle?.id || '';

    return renderTransportCard({
      item,
      source: 'buscar',
      title: routeName,
      subtitle: 'Colectivo · Datos de API',
      routeLine: routeLongName,
      metaLines: [
        uniqueId ? `ID: ${uniqueId}` : '',
        serviceId ? `Service ID: ${serviceId}` : '',
        directionId ? `Direction ID: ${directionId}` : '',
        vehicleId ? `Vehicle ID: ${vehicleId}` : '',
        meta,
      ].filter(Boolean),
    });
  }).join('');

  updateBuscarPaginationControls();
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
  const actionButton = event.target.closest('[data-card-action]');
  if (!actionButton) {
    return;
  }

  const listId = event.currentTarget.id;
  const action = actionButton.dataset.cardAction;

  if (listId === 'view-favoritos' || listId === 'favoritesList') {
    const favoriteCard = event.target.closest('[data-favorite-id]');
    if (!favoriteCard) {
      return;
    }

    const favoriteRecord = favoriteItems.find(item => item.favoriteId === favoriteCard.dataset.favoriteId);
    if (!favoriteRecord) {
      return;
    }

    if (action === 'open-favorite') {
      renderLineDetails(favoriteRecord.data, favoriteRecord.source || 'favoritos');
      navigateTo('detalle');
    }

    if (action === 'remove-favorite') {
      removeFavoriteItem(favoriteRecord.favoriteId);
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

async function testSubtesAPI() {
  try {
    console.log('Iniciando prueba de la API de Subtes...');
    const subtesData = await getSubtesForecast();
    console.log('✅ Éxito - Datos de Subtes obtenidos:', subtesData);
  } catch (error) {
    console.error('❌ Error al obtener datos de Subtes:', error);
  }
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

  testSubtesAPI(); // Llamada de prueba para verificar subtes

  const homeSearchBtn = document.getElementById('homeSearchBtn');
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');
  const homeColectivosCard = document.getElementById('homeColectivosCard');
  const homeFavoritesCard = document.getElementById('homeFavoritesCard');
  const colectivosBackBtn = document.getElementById('colectivosBackBtn');
  const colectivosPrevBtn = document.getElementById('colectivosPrevBtn');
  const colectivosNextBtn = document.getElementById('colectivosNextBtn');
  const homeSubtesCard = document.getElementById('homeSubtesCard');

  const colectivosList = document.getElementById('colectivosList');
  const soloColectivosList = document.getElementById('soloColectivosList');
  const subtesList = document.getElementById('subtesList');
  const searchResults = document.getElementById('searchResults');
  const favoritesSection = document.getElementById('view-favoritos');
  const detalleBackBtn = document.getElementById('detalleBackBtn');

  colectivosList?.addEventListener('click', handleLineClick);
  soloColectivosList?.addEventListener('click', handleLineClick);
  subtesList?.addEventListener('click', handleLineClick);
  searchResults?.addEventListener('click', handleLineClick);
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

  // Controles de Subtes
  const subtesBackBtn = document.getElementById('subtesBackBtn');
  const subtesPrevBtn = document.getElementById('subtesPrevBtn');
  const subtesNextBtn = document.getElementById('subtesNextBtn');
  const subtesPrev10Btn = document.getElementById('subtesPrev10Btn');
  const subtesNext10Btn = document.getElementById('subtesNext10Btn');

  subtesBackBtn?.addEventListener('click', () => navigateTo('home'));

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
    renderSearchResults(allData, buscarCurrentPage);
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
