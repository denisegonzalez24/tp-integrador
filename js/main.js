import { getVehiclePositions } from './api.js';
import { saveData, loadData } from './storage.js';

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
    .map(item => {
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;
      return `
        <article class="line-card">
          <div class="line-card-main">
            <div>
              <p class="line-number">Línea ${item.route_short_name || 'N/A'}</p>
              <p class="line-subtitle">${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}</p>
            </div>
          </div>
          <p class="line-route">Viaje ${item.trip?.trip_id || 'N/A'} • ${serviceLabel}</p>
          <p class="line-meta">Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}</p>
        </article>
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

  resultsContainer.innerHTML = pageData.map(item => {
    const routeName = item?.route_short_name || item?.route_id || 'Sin línea';
    const routeLongName = item?.route_long_name || item?.trip?.route_long_name || '';
    const meta = item?.vehicle?.position
      ? `Lat ${item.vehicle.position.latitude.toFixed(4)} • Lon ${item.vehicle.position.longitude.toFixed(4)}`
      : '';
    const tripId = item?.trip?.trip_id || item?.trip_id || '';
    const serviceId = item?.trip?.service_id || item?.service_id || '';
    const directionId = item?.trip?.direction_id || item?.direction_id || '';
    const vehicleId = item?.vehicle?.vehicle?.id || item?.vehicle?.id || '';

    return `
      <article class="line-card">
        <div class="line-card-main">
          <div>
            <p class="line-number">${routeName}</p>
            <p class="line-subtitle">Colectivo · Datos de API</p>
          </div>
        </div>
        ${routeLongName ? `<p class="line-route">${routeLongName}</p>` : ''}
        ${tripId ? `<p class="line-meta">Trip ID: ${tripId}</p>` : ''}
        ${serviceId ? `<p class="line-meta">Service ID: ${serviceId}</p>` : ''}
        ${directionId ? `<p class="line-meta">Direction ID: ${directionId}</p>` : ''}
        ${vehicleId ? `<p class="line-meta">Vehicle ID: ${vehicleId}</p>` : ''}
        ${meta ? `<p class="line-meta">${meta}</p>` : ''}
      </article>
    `;
  }).join('');

  updateBuscarPaginationControls();
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

  const homeSearchBtn = document.getElementById('homeSearchBtn');
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');
  const homeColectivosCard = document.getElementById('homeColectivosCard');
  const colectivosBackBtn = document.getElementById('colectivosBackBtn');
  const colectivosPrevBtn = document.getElementById('colectivosPrevBtn');
  const colectivosNextBtn = document.getElementById('colectivosNextBtn');

  const transportData = await ensureTransportData();
  if (transportData) {
    console.log('Datos de transporte cargados y almacenados localmente.');
  }

  homeSearchBtn?.addEventListener('click', async () => {
    await ensureTransportData();
    navigateTo('buscar');
  });

  homeColectivosCard?.addEventListener('click', openColectivosView);
  homeColectivosCard?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openColectivosView();
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

  if (getViewFromHash() === 'colectivos') {
    renderColectivosLines(transportData, colectivosCurrentPage);
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
