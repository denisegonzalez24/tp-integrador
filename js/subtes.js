import { getSubtesForecast } from './api.js';

let subtesCurrentPage = 1;
const SUBTES_PAGE_SIZE = 10;
let subtesDataArray = [];

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

function normalizeSubtesData(data) {
    if (Array.isArray(data)) {
        return data;
    }
    if (data && Array.isArray(data.entity)) {
        return data.entity;
    }
    if (data && Array.isArray(data.Entity)) {
        return data.Entity;
    }
    return [];
}

export function setSubtesData(data) {
    subtesDataArray = Array.isArray(data) ? data : [];
}

export async function loadSubtesData() {
    const response = await getSubtesForecast().catch(err => {
        console.error(err);
        return [];
    });
    subtesDataArray = normalizeSubtesData(response);
    return subtesDataArray;
}

export function renderSubtesLines(data, page = 1, renderTransportCard) {
    const listContainer = document.getElementById('subtesList');
    if (!listContainer) return;

    subtesDataArray = normalizeSubtesData(data);
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

        const routeName = trip.route_id || trip.routeId || item.route_id || item.routeId || linea.route_Id || linea.route_id || 'Subte';
        const displayRoute = routeName.replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim();
        const tripId = trip.trip_id || trip.tripId || item.trip_id || item.tripId || '';
        const uniqueId = item.id || tripId || `subte-${index}`;
        item._ui_id = uniqueId;

        let arrivalText = 'Arribos en tiempo real';
        const stopTimeUpdates = tripUpdate.stop_time_update || tripUpdate.stopTimeUpdate;

        if (stopTimeUpdates && stopTimeUpdates.length > 0) {
            const firstUpdate = stopTimeUpdates[0];
            const arrivalTime = firstUpdate.arrival?.time || firstUpdate.departure?.time;

            if (arrivalTime) {
                const date = new Date(arrivalTime * 1000);
                const now = new Date();
                const diffMins = Math.round((date - now) / 60000);

                if (diffMins <= 0) {
                    arrivalText = 'Llegando...';
                } else if (diffMins < 60) {
                    arrivalText = `Proximo arribo en ${diffMins} min`;
                } else {
                    arrivalText = `Proximo arribo: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
            }
        }

        return renderTransportCard({
            item,
            source: 'subtes',
            title: `Linea ${displayRoute === 'Subte' ? 'Subte' : displayRoute}`,
            subtitle: `Subte ${tripId ? `- Viaje ${tripId}` : ''}`,
            routeLine: arrivalText,
        });
    }).join('');

    updateSubtesPaginationControls();
}

export async function openSubtesView(navigateTo, renderTransportCard) {
    const subtesList = document.getElementById('subtesList');
    if (subtesList) subtesList.innerHTML = '<p class="empty">Cargando datos de subtes...</p>';
    navigateTo('subtes');
    const data = await loadSubtesData();
    subtesCurrentPage = 1;
    renderSubtesLines(data || [], subtesCurrentPage, renderTransportCard);
}

export function bindSubtesControls({ navigateTo, renderTransportCard }) {
    const subtesBackBtn = document.getElementById('subtesBackBtn');
    const subtesPrevBtn = document.getElementById('subtesPrevBtn');
    const subtesNextBtn = document.getElementById('subtesNextBtn');
    const subtesPrev10Btn = document.getElementById('subtesPrev10Btn');
    const subtesNext10Btn = document.getElementById('subtesNext10Btn');

    subtesBackBtn?.addEventListener('click', () => navigateTo('home'));

    subtesPrevBtn?.addEventListener('click', () => {
        if (subtesCurrentPage > 1) {
            subtesCurrentPage -= 1;
            renderSubtesLines(subtesDataArray, subtesCurrentPage, renderTransportCard);
        }
    });

    subtesNextBtn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(subtesDataArray.length / SUBTES_PAGE_SIZE));
        if (subtesCurrentPage < totalPages) {
            subtesCurrentPage += 1;
            renderSubtesLines(subtesDataArray, subtesCurrentPage, renderTransportCard);
        }
    });

    subtesPrev10Btn?.addEventListener('click', () => {
        subtesCurrentPage = Math.max(1, subtesCurrentPage - 10);
        renderSubtesLines(subtesDataArray, subtesCurrentPage, renderTransportCard);
    });

    subtesNext10Btn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(subtesDataArray.length / SUBTES_PAGE_SIZE));
        subtesCurrentPage = Math.min(totalPages, subtesCurrentPage + 10);
        renderSubtesLines(subtesDataArray, subtesCurrentPage, renderTransportCard);
    });
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
