import { getVehiclePositions } from './api.js';
import { saveData, loadData } from './storage.js';

const TRANSPORT_DATA_KEY = 'transportData';
const views = Array.from(document.querySelectorAll('.view'));
const navLinks = Array.from(document.querySelectorAll('.bottom-nav .nav-link'));
const validViews = views.map(view => view.id.replace('view-', ''));

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
  if (window.location.hash.slice(1).toLowerCase() !== target) {
    window.location.hash = target;
  } else {
    setActiveView(target);
  }
}

function handleNavClick(event) {
  event.preventDefault();
  const targetView = event.currentTarget.dataset.view;
  navigateTo(targetView);
}

function renderSearchResults(data) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  if (!Array.isArray(data) || data.length === 0) {
    resultsContainer.innerHTML = '<p class="empty">No se encontraron resultados.</p>';
    return;
  }

  resultsContainer.innerHTML = data.slice(0, 8).map(item => {
    const routeName = item?.route_short_name || item?.route_id || 'Sin línea';
    const routeLongName = item?.route_long_name || item?.trip?.route_long_name || '';
    const meta = item?.vehicle?.position
      ? `Lat ${item.vehicle.position.latitude.toFixed(4)} • Lon ${item.vehicle.position.longitude.toFixed(4)}`
      : '';

    return `
      <article class="line-card">
        <div class="line-card-main">
          <div>
            <p class="line-number">${routeName}</p>
            <p class="line-subtitle">Colectivo · Datos guardados</p>
          </div>
        </div>
        ${routeLongName ? `<p class="line-route">${routeLongName}</p>` : ''}
        ${meta ? `<p class="line-meta">${meta}</p>` : ''}
      </article>
    `;
  }).join('');
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

window.addEventListener('hashchange', () => {
  setActiveView(getViewFromHash());
});

document.addEventListener('DOMContentLoaded', async () => {
  navLinks.forEach(link => link.addEventListener('click', handleNavClick));
  setActiveView(getViewFromHash());
  initHeaderOnScroll();

  const homeSearchBtn = document.getElementById('homeSearchBtn');
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');

  const transportData = await ensureTransportData();
  if (transportData) {
    console.log('Datos de transporte cargados y almacenados localmente.');
  }

  homeSearchBtn?.addEventListener('click', async () => {
    await ensureTransportData();
    navigateTo('buscar');
  });

  searchButton?.addEventListener('click', async () => {
    const allData = await ensureTransportData();
    if (!allData) {
      renderSearchResults([]);
      return;
    }

    const query = searchInput?.value.trim().toLowerCase();
    const filteredData = query
      ? allData.filter(item => {
          const routeName = String(item?.route_short_name || item?.route_id || '').toLowerCase();
          const routeLongName = String(item?.route_long_name || item?.trip?.route_long_name || '').toLowerCase();
          return routeName.includes(query) || routeLongName.includes(query);
        })
      : allData;

    renderSearchResults(filteredData);
  });
});
