const SUBTES_DATA_JSON_PATH = './datos/subtes.json';

let subtesCurrentPage = 1;
let subtesDataArray = [];
let subtesCatalogLoaded = false;

function normalizeStationName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function hideSubtesPagination() {
    const subtesPagination = document.getElementById('subtesPagination');
    if (subtesPagination) {
        subtesPagination.style.display = 'none';
    }
}

async function ensureSubtesCatalogLoaded() {
    if (subtesCatalogLoaded && Array.isArray(subtesDataArray) && subtesDataArray.length > 0) {
        return;
    }

    try {
        const response = await fetch(SUBTES_DATA_JSON_PATH);
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
        }

        const payload = await response.json();
        subtesDataArray = Array.isArray(payload?.lineas) ? payload.lineas : [];
        subtesCatalogLoaded = true;
    } catch (error) {
        console.error('Error al cargar lineas de subte:', error);
        subtesDataArray = [];
    }
}

function getLineStations(linea) {
    const byName = new Map();

    (Array.isArray(linea?.ramales) ? linea.ramales : []).forEach(ramal => {
        (Array.isArray(ramal?.estaciones) ? ramal.estaciones : []).forEach(station => {
            const stationName = String(station?.nombre || '').trim();
            const key = normalizeStationName(stationName);

            if (!stationName || byName.has(key)) {
                return;
            }

            byName.set(key, {
                nombre: stationName,
            });
        });
    });

    return Array.from(byName.values())
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
}

export function renderSubtesLines(data, page = 1, renderTransportCard) {
    const listContainer = document.getElementById('subtesList');
    if (!listContainer) {
        return;
    }

    hideSubtesPagination();
    subtesCurrentPage = page;
    subtesDataArray = Array.isArray(data) ? data : [];

    if (subtesDataArray.length === 0) {
        listContainer.innerHTML = '<p class="empty">No se encontraron lineas de subte.</p>';
        return;
    }

    listContainer.innerHTML = subtesDataArray.map(linea => {
        const stations = getLineStations(linea);

        return `
      <details class="trenes-line-details" data-subte-line="${linea.id}">
        <summary class="trenes-line-summary">
          <div class="trenes-line-header">
            <p class="trenes-line-name">Linea ${linea.id}</p>
            <div class="trenes-line-info">
              <span class="line-meta">${stations.length} estaciones</span>
            </div>
          </div>
        </summary>
        <div class="trenes-ramales-container">
          <p class="line-meta">${linea?.recorrido || 'Recorrido no disponible'}</p>
          <div class="ramal-stations-list">
            ${stations.map(station => `
              <button
                type="button"
                class="train-station-card"
                data-card-action="open-subte-station"
                data-subte-line-id="${linea.id}"
                data-subte-station-name="${station.nombre}"
              >
                <span class="train-station-name">${station.nombre}</span>
                <span class="train-station-action">Ver detalle</span>
              </button>
            `).join('')}
          </div>
        </div>
      </details>
    `;
    }).join('');
}

export async function loadSubtesData() {
    await ensureSubtesCatalogLoaded();
    return subtesDataArray;
}

export async function openSubtesView(navigateTo, renderTransportCard) {
    const subtesList = document.getElementById('subtesList');
    if (subtesList) {
        subtesList.innerHTML = '<p class="empty">Cargando lineas de subte...</p>';
    }

    navigateTo('subtes');
    await ensureSubtesCatalogLoaded();
    renderSubtesLines(subtesDataArray, 1, renderTransportCard);
}

export function handleSubtesListInteraction(event) {
    const listId = event.currentTarget.id;
    if (listId !== 'subtesList') {
        return false;
    }

    const actionButton = event.target.closest('[data-card-action]');
    if (!actionButton) {
        return false;
    }

    if (actionButton.dataset.cardAction !== 'open-subte-station') {
        return false;
    }

    const stationButton = event.target.closest('[data-subte-station-name]');
    const stationName = stationButton?.dataset.subteStationName;
    const lineId = stationButton?.dataset.subteLineId;

    if (!stationName) {
        return true;
    }

    const params = new URLSearchParams({
        station: stationName,
        linea: lineId || '',
    });
    window.location.href = `./subte-detail.html?${params.toString()}`;
    return true;
}

export function bindSubtesControls({ navigateTo, renderTransportCard }) {
    const subtesBackBtn = document.getElementById('subtesBackBtn');
    hideSubtesPagination();
    subtesBackBtn?.addEventListener('click', () => navigateTo('home'));
}

export function getSubtesData() {
    return subtesDataArray;
}

export function getSubtesCurrentPage() {
    return subtesCurrentPage;
}

export function refreshSubtesView(renderTransportCard) {
    if (subtesDataArray.length > 0) {
        renderSubtesLines(subtesDataArray, subtesCurrentPage, renderTransportCard);
    }
}
