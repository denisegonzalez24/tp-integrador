let colectivosCurrentPage = 1;
const COLECTIVOS_PAGE_SIZE = 10;
let colectivosTripData = [];

let soloColectivosCurrentPage = 1;
const SOLO_COLECTIVOS_PAGE_SIZE = 10;
let soloColectivosTripData = [];

function getColectivosPageData(page = 1) {
    const startIndex = (page - 1) * COLECTIVOS_PAGE_SIZE;
    return colectivosTripData.slice(startIndex, startIndex + COLECTIVOS_PAGE_SIZE);
}

function getSoloColectivosPageData(page = 1) {
    const startIndex = (page - 1) * SOLO_COLECTIVOS_PAGE_SIZE;
    return soloColectivosTripData.slice(startIndex, startIndex + SOLO_COLECTIVOS_PAGE_SIZE);
}

function updatePaginationControls({ prev10BtnId, prevBtnId, nextBtnId, next10BtnId, pageLabelId, currentPage, totalItems, pageSize }) {
    const prev10Btn = document.getElementById(prev10BtnId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);
    const next10Btn = document.getElementById(next10BtnId);
    const pageLabel = document.getElementById(pageLabelId);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (prev10Btn) prev10Btn.disabled = currentPage <= 1;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (next10Btn) next10Btn.disabled = currentPage >= totalPages;
    if (pageLabel) pageLabel.textContent = `${currentPage} de ${totalPages}`;
}

function updateColectivosPaginationControls() {
    updatePaginationControls({
        prev10BtnId: 'colectivosPrev10Btn',
        prevBtnId: 'colectivosPrevBtn',
        nextBtnId: 'colectivosNextBtn',
        next10BtnId: 'colectivosNext10Btn',
        pageLabelId: 'colectivosPageLabel',
        currentPage: colectivosCurrentPage,
        totalItems: colectivosTripData.length,
        pageSize: COLECTIVOS_PAGE_SIZE,
    });
}

function updateSoloColectivosPaginationControls() {
    updatePaginationControls({
        prev10BtnId: 'soloColectivosPrev10Btn',
        prevBtnId: 'soloColectivosPrevBtn',
        nextBtnId: 'soloColectivosNextBtn',
        next10BtnId: 'soloColectivosNext10Btn',
        pageLabelId: 'soloColectivosPageLabel',
        currentPage: soloColectivosCurrentPage,
        totalItems: soloColectivosTripData.length,
        pageSize: SOLO_COLECTIVOS_PAGE_SIZE,
    });
}

function buildColectivoTransportCard(item, index, source, fallbackIdPrefix, renderTransportCard) {
    const uniqueId = item.id_vehiculo || item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `${fallbackIdPrefix}-${index}`;
    item._ui_id = uniqueId;

    const linea = item.linea || item.route_short_name || 'N/A';
    const destino = item.ramal_destino || item.trip?.trip_headsign || 'Sin destino';
    const lat = item.latitud ?? item.vehicle?.position?.latitude;
    const lon = item.longitud ?? item.vehicle?.position?.longitude;
    const vel = item.velocidad ?? item.vehicle?.position?.speed;

    return renderTransportCard({
        item,
        source,
        title: `Linea ${linea}`,
        subtitle: destino,
        routeLine: `Unidad ${item.id_vehiculo || item.trip?.trip_id || 'N/A'}`,
        metaLines: [
            `Posición: Lat ${lat?.toFixed(4) || 'N/A'} - Lon ${lon?.toFixed(4) || 'N/A'}`,
            `Velocidad: ${vel ? (vel * 3.6).toFixed(1) + ' km/h' : '0 km/h'}`
        ],
    });
}

export function renderColectivosLines(data, page = 1, renderTransportCard) {
    const listContainer = document.getElementById('colectivosList');
    if (!listContainer) return;

    colectivosTripData = data || [];
    colectivosCurrentPage = page;

    if (!Array.isArray(colectivosTripData) || colectivosTripData.length === 0) {
        listContainer.innerHTML = '<p class="empty">No se encontraron lineas de colectivos.</p>';
        updateColectivosPaginationControls();
        return;
    }

    const pageData = getColectivosPageData(colectivosCurrentPage);

    listContainer.innerHTML = pageData
        .map((item, index) => buildColectivoTransportCard(item, index, 'colectivos', 'colectivo', renderTransportCard))
        .join('');

    updateColectivosPaginationControls();
}

export function renderSoloColectivosLines(data, page = 1, renderTransportCard) {
    const listContainer = document.getElementById('soloColectivosList');
    if (!listContainer) return;

    soloColectivosTripData = data || [];
    soloColectivosCurrentPage = page;

    if (!Array.isArray(soloColectivosTripData) || soloColectivosTripData.length === 0) {
        listContainer.innerHTML = '<p class="empty">No se encontraron lineas de colectivos.</p>';
        updateSoloColectivosPaginationControls();
        return;
    }

    const pageData = getSoloColectivosPageData(soloColectivosCurrentPage);

    listContainer.innerHTML = pageData
        .map((item, index) => buildColectivoTransportCard(item, index, 'solo-colectivos', 'solo-colectivo', renderTransportCard))
        .join('');

    updateSoloColectivosPaginationControls();
}

export async function openColectivosView({ ensureTransportData, navigateTo, renderTransportCard }) {
    const transportData = await ensureTransportData();
    colectivosCurrentPage = 1;
    renderColectivosLines(transportData, colectivosCurrentPage, renderTransportCard);
    navigateTo('colectivos');
}

export async function openSoloColectivosView({ ensureTransportData, navigateTo, renderTransportCard }) {
    const transportData = await ensureTransportData();
    soloColectivosCurrentPage = 1;
    renderSoloColectivosLines(transportData, soloColectivosCurrentPage, renderTransportCard);
    navigateTo('solo-colectivos');
}

export function bindColectivosControls({ navigateTo, renderTransportCard }) {
    const colectivosBackBtn = document.getElementById('colectivosBackBtn');
    const colectivosPrevBtn = document.getElementById('colectivosPrevBtn');
    const colectivosNextBtn = document.getElementById('colectivosNextBtn');
    const colectivosPrev10Btn = document.getElementById('colectivosPrev10Btn');
    const colectivosNext10Btn = document.getElementById('colectivosNext10Btn');

    colectivosBackBtn?.addEventListener('click', () => navigateTo('home'));

    colectivosPrevBtn?.addEventListener('click', () => {
        if (colectivosCurrentPage > 1) {
            colectivosCurrentPage -= 1;
            renderColectivosLines(colectivosTripData, colectivosCurrentPage, renderTransportCard);
        }
    });

    colectivosNextBtn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(colectivosTripData.length / COLECTIVOS_PAGE_SIZE));
        if (colectivosCurrentPage < totalPages) {
            colectivosCurrentPage += 1;
            renderColectivosLines(colectivosTripData, colectivosCurrentPage, renderTransportCard);
        }
    });

    colectivosPrev10Btn?.addEventListener('click', () => {
        if (colectivosCurrentPage > 1) {
            colectivosCurrentPage = Math.max(1, colectivosCurrentPage - 10);
            renderColectivosLines(colectivosTripData, colectivosCurrentPage, renderTransportCard);
        }
    });

    colectivosNext10Btn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(colectivosTripData.length / COLECTIVOS_PAGE_SIZE));
        if (colectivosCurrentPage < totalPages) {
            colectivosCurrentPage = Math.min(totalPages, colectivosCurrentPage + 10);
            renderColectivosLines(colectivosTripData, colectivosCurrentPage, renderTransportCard);
        }
    });

    const soloColectivosBackBtn = document.getElementById('soloColectivosBackBtn');
    const soloColectivosPrevBtn = document.getElementById('soloColectivosPrevBtn');
    const soloColectivosNextBtn = document.getElementById('soloColectivosNextBtn');
    const soloColectivosPrev10Btn = document.getElementById('soloColectivosPrev10Btn');
    const soloColectivosNext10Btn = document.getElementById('soloColectivosNext10Btn');

    soloColectivosBackBtn?.addEventListener('click', () => navigateTo('home'));

    soloColectivosPrevBtn?.addEventListener('click', () => {
        if (soloColectivosCurrentPage > 1) {
            soloColectivosCurrentPage -= 1;
            renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage, renderTransportCard);
        }
    });

    soloColectivosNextBtn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(soloColectivosTripData.length / SOLO_COLECTIVOS_PAGE_SIZE));
        if (soloColectivosCurrentPage < totalPages) {
            soloColectivosCurrentPage += 1;
            renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage, renderTransportCard);
        }
    });

    soloColectivosPrev10Btn?.addEventListener('click', () => {
        if (soloColectivosCurrentPage > 1) {
            soloColectivosCurrentPage = Math.max(1, soloColectivosCurrentPage - 10);
            renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage, renderTransportCard);
        }
    });

    soloColectivosNext10Btn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(soloColectivosTripData.length / SOLO_COLECTIVOS_PAGE_SIZE));
        if (soloColectivosCurrentPage < totalPages) {
            soloColectivosCurrentPage = Math.min(totalPages, soloColectivosCurrentPage + 10);
            renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage, renderTransportCard);
        }
    });
}

export function getColectivosTripData() {
    return colectivosTripData;
}

export function getSoloColectivosTripData() {
    return soloColectivosTripData;
}

export function getColectivosCurrentPage() {
    return colectivosCurrentPage;
}

export function getSoloColectivosCurrentPage() {
    return soloColectivosCurrentPage;
}

export function refreshColectivosViews(renderTransportCard) {
    if (colectivosTripData.length > 0) {
        renderColectivosLines(colectivosTripData, colectivosCurrentPage, renderTransportCard);
    }
    if (soloColectivosTripData.length > 0) {
        renderSoloColectivosLines(soloColectivosTripData, soloColectivosCurrentPage, renderTransportCard);
    }
}
