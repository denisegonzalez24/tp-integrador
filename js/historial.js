let historyItems = [];
let ctx = {};

const HISTORY_LIMIT = 10;

export function initHistoryModule(context) {
    ctx = context || {};
    const storedHistory = ctx.loadData?.(ctx.storageKey);
    historyItems = Array.isArray(storedHistory) ? storedHistory.map(normalizeStoredHistoryRecord) : [];
    persistHistoryItems();
}

function persistHistoryItems() {
    ctx.saveData?.(ctx.storageKey, historyItems);
}

function normalizeStoredHistoryRecord(record) {
    if (record?.source !== 'subtes') {
        return record;
    }

    const stationName = getSubteStationName(record.data || {});
    if (!stationName) {
        return record;
    }

    return {
        ...record,
        title: stationName,
    };
}

function getRouteName(data = {}) {
    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const vehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};

    return data?.linea
        || data?.route_short_name
        || data?.route_id
        || data?.routeId
        || trip?.route_id
        || trip?.routeId
        || data?.linea?.route_Id
        || data?.linea?.route_id
        || 'Sin linea';
}

function getTransportHeadsign(data = {}) {
    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const vehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};

    return data?.ramal_destino
        || trip?.trip_headsign
        || trip?.tripHeadsign
        || data?.trip?.trip_headsign
        || data?.route_long_name
        || vehicle?.vehicle?.label
        || vehicle?._vehicle?._label
        || 'Sin destino';
}

function getSubteStationName(data = {}) {
    return data?.titulo
        || data?.nombre
        || data?.stop_name
        || data?.station
        || data?.stationName
        || data?.currentStationName
        || '';
}

function getVehiclePosition(data = {}) {
    const vehicle = data?.vehicle || data?.Vehicle || {};
    const position = vehicle?.position || vehicle?._position || {};

    return {
        latitude: data?.latitud ?? position?.latitude ?? position?._latitude,
        longitude: data?.longitud ?? position?.longitude ?? position?._longitude,
    };
}

function getHistoryItemId(record) {
    if (record.kind === 'train-station') {
        return `train-station:${String(record?.data?.id_estacion || record?.data?.id || '').trim().toLowerCase()}`;
    }

    const data = record?.data || {};
    if (record.source === 'subtes') {
        const stationKey = String(getSubteStationName(data) || data?._searchId || data?.id || data?.ids?.[0] || '').trim().toLowerCase();
        return `subte-station:${stationKey || 'item'}`;
    }

    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const vehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
    const routeName = String(getRouteName(data)).trim().toLowerCase();
    const tripId = String(data?.ramal_id || trip?.trip_id || trip?.tripId || data?.trip_id || data?.tripId || '').trim().toLowerCase();
    const vehicleId = String(data?.id_vehiculo || vehicle?.vehicle?.id || vehicle?._vehicle?.id || vehicle?.id || data?.id || '').trim().toLowerCase();

    return `${record.kind}:${routeName}:${tripId || vehicleId || 'item'}`;
}

function buildHistoryRecord(data, source, options = {}) {
    const kind = options.kind || 'transport';
    const viewedAt = new Date().toISOString();

    if (kind === 'train-station') {
        return {
            historyId: getHistoryItemId({ kind, data }),
            kind,
            source,
            viewedAt,
            title: data?.nombre || 'Estacion sin nombre',
            subtitle: `Tren - Linea ${ctx.getStationLineFromRamales?.(data?.incluida_en_ramales || []) || 'Tren'}`,
            data,
        };
    }

    const routeName = getRouteName(data);
    const displayRoute = String(routeName).replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim();
    const sourceLabel = source === 'subtes' ? 'Subte' : 'Colectivo';
    const subteStationName = getSubteStationName(data);

    return {
        historyId: getHistoryItemId({ kind, data }),
        kind,
        source,
        viewedAt,
        title: source === 'subtes' ? (subteStationName || `Subte ${displayRoute || 'Sin linea'}`) : `Linea ${routeName}`,
        subtitle: `${sourceLabel} - ${getTransportHeadsign(data)}`,
        data,
    };
}

export function addHistoryItem(data, source, options = {}) {
    if (!data) {
        return;
    }

    const record = buildHistoryRecord(data, source, options);
    historyItems = [
        record,
        ...historyItems.filter(item => item.historyId !== record.historyId),
    ].slice(0, HISTORY_LIMIT);

    persistHistoryItems();
    ctx.onHistoryChanged?.();
}

function formatViewedAt(value) {
    if (!value) {
        return 'Reciente';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'Reciente';
    }

    return parsed.toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function renderHistoryCard(record) {
    const historyData = record?.data || {};

    if (record?.kind === 'train-station') {
        return `
      <article class="status-item favorite-item" data-history-id="${record.historyId}">
        <button type="button" class="favorite-item-main" data-card-action="open-history">
          <p class="status-title">${record.title || 'Estacion'}</p>
          <p class="line-subtitle">${record.subtitle || 'Tren'}</p>
          <p class="line-meta">ID estacion: ${historyData?.id_estacion || historyData?.id || 'N/A'} - Visto: ${formatViewedAt(record.viewedAt)}</p>
        </button>
        <div class="favorite-item-actions">
          <button type="button" class="history-clear-icon favorite-remove-icon" data-card-action="remove-history" aria-label="Quitar del historial"><span class="trash-icon" aria-hidden="true"></span></button>
        </div>
      </article>
    `;
    }

    return `
    <article class="status-item favorite-item" data-history-id="${record.historyId}">
      <button type="button" class="favorite-item-main" data-card-action="open-history">
        <p class="status-title">${record.title || 'Linea'}</p>
        <p class="line-subtitle">${record.subtitle || 'Transporte'}</p>
        <p class="line-meta">Visto: ${formatViewedAt(record.viewedAt)}</p>
      </button>
      <div class="favorite-item-actions">
        <button type="button" class="history-clear-icon favorite-remove-icon" data-card-action="remove-history" aria-label="Quitar del historial"><span class="trash-icon" aria-hidden="true"></span></button>
      </div>
    </article>
  `;
}

export function renderHistoryView() {
    const historySection = document.getElementById('view-historial');
    if (!historySection) return;

    historySection.innerHTML = `
    <div class="hero-card">
      <div class="hero-icon history-hero-icon" aria-hidden="true">◷</div>
      <div class="history-view-header">
        <h2>Historial</h2>
        ${historyItems.length === 0 ? '' : `<button type="button" class="history-clear-icon" data-history-action="clear-history" aria-label="Vaciar historial"><span class="trash-icon" aria-hidden="true"></span><span>Vaciar</span></button>`}
      </div>
      <p class="hero-text">Tus consultas recientes de trenes, colectivos y proximamente subtes.</p>
      <button type="button" class="link-button back-button" data-history-action="go-home">&larr; Volver</button>
      ${historyItems.length === 0
            ? `
          <div class="empty-state">
            <p class="status-title">No hay historial todavia</p>
            <p class="line-subtitle">Abri una estacion o una linea para que aparezca aca.</p>
          </div>
        `
            : `
          <div id="historyList" class="status-list favorites-list">
            ${historyItems.map(renderHistoryCard).join('')}
          </div>
        `}
    </div>
  `;
}

export function removeHistoryItem(historyId) {
    historyItems = historyItems.filter(item => item.historyId !== historyId);
    persistHistoryItems();
    ctx.onHistoryChanged?.();
}

export function clearHistoryItems() {
    historyItems = [];
    persistHistoryItems();
    ctx.onHistoryChanged?.();
}

export function handleHistoryClick(event) {
    const actionButton = event.target.closest('[data-card-action], [data-history-action]');
    if (!actionButton) {
        return false;
    }

    const historyAction = actionButton.dataset.historyAction;
    if (historyAction === 'go-home') {
        ctx.navigateTo?.('home');
        return true;
    }

    if (historyAction === 'clear-history') {
        clearHistoryItems();
        return true;
    }

    const historyCard = event.target.closest('[data-history-id]');
    if (!historyCard) {
        return false;
    }

    const historyRecord = historyItems.find(item => item.historyId === historyCard.dataset.historyId);
    if (!historyRecord) {
        return false;
    }

    const action = actionButton.dataset.cardAction;
    if (action === 'open-history') {
        if (historyRecord.kind === 'train-station') {
            const stationId = historyRecord.data?.id_estacion || historyRecord.data?.id;
            if (stationId) {
                ctx.openStationDetail?.(stationId, historyRecord.data);
            }
        } else {
            ctx.openTransportDetail?.(historyRecord.data, historyRecord.source || 'historial');
        }
        return true;
    }

    if (action === 'remove-history') {
        removeHistoryItem(historyRecord.historyId);
        return true;
    }

    return false;
}

export function getHistoryItems() {
    return historyItems;
}



