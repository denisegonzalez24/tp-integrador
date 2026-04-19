import { getVehiclePositions } from './api.js';
import { saveData, loadData } from './storage.js';
import { fetchStaticSubteData, enrichSubteRealTimeData, generateTripStopListHTML } from './subtes.js';
import { renderSubtes } from './ui.js';

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
      const routeName = item.route_short_name || 'N/A';
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;
      return `
        <button type="button" class="line-card" data-route="${routeName}" data-trip-id="${uniqueId}" style="text-align: left; width: 100%; cursor: pointer; border: none; background: transparent; font-family: inherit; display: block;">
          <div class="line-card-main">
            <div>
              <p class="line-number">Línea ${routeName}</p>
              <p class="line-subtitle">${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}</p>
            </div>
          </div>
          <p class="line-route">Viaje ${item.trip?.trip_id || item.id || 'N/A'} • ${serviceLabel}</p>
          <p class="line-meta">Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}</p>
        </button>
      `;
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
      const routeName = item.route_short_name || 'N/A';
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;
      return `
        <button type="button" class="line-card" data-route="${routeName}" data-trip-id="${uniqueId}" style="text-align: left; width: 100%; cursor: pointer; border: none; background: transparent; font-family: inherit; display: block;">
          <div class="line-card-main">
            <div>
              <p class="line-number">Línea ${routeName}</p>
              <p class="line-subtitle">${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}</p>
            </div>
          </div>
          <p class="line-route">Viaje ${item.trip?.trip_id || item.id || 'N/A'} • ${serviceLabel}</p>
          <p class="line-meta">Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}</p>
        </button>
      `;
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

    return `
      <button type="button" class="line-card" data-route="${routeName}" data-trip-id="${uniqueId}" style="text-align: left; width: 100%; cursor: pointer; border: none; background: transparent; font-family: inherit; display: block;">
        <div class="line-card-main">
          <div>
            <p class="line-number">${routeName}</p>
            <p class="line-subtitle">Colectivo · Datos de API</p>
          </div>
        </div>
        ${routeLongName ? `<p class="line-route">${routeLongName}</p>` : ''}
        ${uniqueId ? `<p class="line-meta">ID: ${uniqueId}</p>` : ''}
        ${serviceId ? `<p class="line-meta">Service ID: ${serviceId}</p>` : ''}
        ${directionId ? `<p class="line-meta">Direction ID: ${directionId}</p>` : ''}
        ${vehicleId ? `<p class="line-meta">Vehicle ID: ${vehicleId}</p>` : ''}
        ${meta ? `<p class="line-meta">${meta}</p>` : ''}
      </button>
    `;
  }).join('');

  updateBuscarPaginationControls();
}

function renderLineDetails(data) {
  const container = document.getElementById('detalleContent');
  if (!container) return;

  // Detectar si es un subte (posee la propiedad Linea de nuestro mock)
  if (data?.Linea) {
    const routeId = data.Linea.Route_Id || 'Subte';
    const tripId = data.Linea.Trip_Id || 'Desconocido';
    const headsign = data.Linea.headsign || 'Desconocido';
    const stopListHTML = generateTripStopListHTML(tripId, staticSubteData);

    container.innerHTML = `
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <p class="status-title" style="font-size: 1.25rem;">Línea ${routeId.replace('Linea', '')}</p>
        <p class="line-subtitle">Destino: ${headsign}</p>
      </article>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <p class="status-title">Información del Viaje</p>
        <p class="line-meta"><strong>ID Viaje:</strong> ${tripId}</p>
      </article>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; width: 100%;">
        <p class="status-title">Itinerario y Paradas</p>
        ${stopListHTML}
      </article>
    `;
    return;
  }

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

  container.innerHTML = `
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
  const clickedButton = event.target.closest('.line-card[data-trip-id]');
  if (!clickedButton) {
    return;
  }

  const tripId = clickedButton.dataset.tripId;
  if (!tripId) {
    console.warn('El botón de línea no tiene un data-trip-id.');
    return;
  }

  const listId = event.currentTarget.id;
  let dataArray;

  switch (listId) {
    case 'colectivosList':
      dataArray = colectivosTripData;
      break;
    case 'soloColectivosList':
      dataArray = soloColectivosTripData;
      break;
    case 'searchResults':
      dataArray = buscarTransportData;
      break;
    case 'subtesList':
      dataArray = subtesData.Entity || subtesData.entity || [];
      break;
    default:
      console.error('No se pudo determinar la lista de origen.');
      return;
  }

  const lineData = dataArray.find(item => String(item._ui_id) === tripId || String(item.id || item.trip?.trip_id || item.trip_id || item.Linea?.Trip_Id) === tripId);

  if (lineData) {
    renderLineDetails(lineData);
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
  if (viewName === 'colectivos') {
    const transportData = await ensureTransportData();
    renderViewForName(viewName, transportData);
  }

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
  const colectivosBackBtn = document.getElementById('colectivosBackBtn');
  const colectivosPrevBtn = document.getElementById('colectivosPrevBtn');
  const colectivosNextBtn = document.getElementById('colectivosNextBtn');

  const colectivosList = document.getElementById('colectivosList');
  const soloColectivosList = document.getElementById('soloColectivosList');
  const searchResults = document.getElementById('searchResults');
  const detalleBackBtn = document.getElementById('detalleBackBtn');
  const subtesBackBtn = document.getElementById('subtesBackBtn');
  const subtesList = document.getElementById('subtesList');

  colectivosList?.addEventListener('click', handleLineClick);
  soloColectivosList?.addEventListener('click', handleLineClick);
  searchResults?.addEventListener('click', handleLineClick);
  subtesList?.addEventListener('click', handleLineClick);

  detalleBackBtn?.addEventListener('click', () => {
    window.history.back(); // Volver a la vista anterior preservando su estado
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
        renderSubtes(subtesData, 'subtesList');
      } catch (e) {
        console.error('Error cargando mock de subtes:', e);
      }
    }
  }

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

  if (getViewFromHash() === 'colectivos') {
    renderColectivosLines(transportData, colectivosCurrentPage);
  }

  if (getViewFromHash() === 'solo-colectivos') {
    renderSoloColectivosLines(transportData, soloColectivosCurrentPage);
  }

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
