import { getSubtesActivos } from './api.js';

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

function getLineaColor(linea) {
    const colors = { 'A': '00a4e4', 'B': 'e30613', 'C': '0065a4', 'D': '008069', 'E': '6c2b6d', 'H': 'f3c300' };
    return colors[linea?.toUpperCase()] || '999999';
}

export async function loadAndRenderSubtesActivos() {
    const container = document.getElementById('subtesActivosList');
    if (!container) return;
    
    try {
        const activos = await getSubtesActivos();
        if (!activos || activos.length === 0) {
            container.innerHTML = '<p class="empty">No hay formaciones reportando posición ahora.</p>';
            return;
        }
        
        const topActivos = activos.slice(0, 6); // Mostramos los primeros 6 para no saturar la pantalla
        
        container.innerHTML = topActivos.map(subte => {
            const color = getLineaColor(subte.linea);
            const estado = subte.detenidoEn ? `Detenido en ${subte.detenidoEn}` : `Próx. parada: ${subte.proximaParada}`;
            const tiempoText = subte.tiempoLlegada === 0 ? 'Llegando' : `En ${subte.tiempoLlegada} min`;
            
            return `
                <button type="button" class="status-item" data-active-subte-id="${subte.id}" data-active-subte-line="${subte.linea}" data-active-subte-color="${color}" data-active-subte-dest="${subte.destino}" style="border-top: none; border-right: none; border-bottom: none; border-left: 4px solid #${color}; width: 100%; text-align: left; cursor: pointer; font-family: inherit; background: transparent;">
                    <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <p class="status-title">Línea ${subte.linea} a ${subte.destino}</p>
                            <span class="status-chip" style="background-color: #${color}; color: white; border: none;">${tiempoText}</span>
                        </div>
                        <p class="line-meta">${estado}</p>
                    </div>
                </button>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando subtes activos:', error);
        container.innerHTML = '<p class="empty">No se pudo cargar la información en vivo.</p>';
    }
}

export async function openSubtesView(navigateTo, renderTransportCard) {
    const subtesActivosList = document.getElementById('subtesActivosList');
    if (subtesActivosList) {
        subtesActivosList.innerHTML = '<p class="empty">Buscando formaciones activas...</p>';
    }

    navigateTo('subtes');
    await ensureSubtesCatalogLoaded();
    renderSubtesLines(subtesDataArray, 1, renderTransportCard);
    loadAndRenderSubtesActivos();
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
        name: stationName,
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
    loadAndRenderSubtesActivos();
}
