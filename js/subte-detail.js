import { getSubtesForecast } from './api.js';

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function mapRouteIdToLine(routeId) {
    const normalizedRoute = normalizeText(routeId)
        .replace(/\s+/g, '')
        .replace(/^linea/, '')
        .toUpperCase();

    if (!normalizedRoute) {
        return '';
    }

    return normalizedRoute;
}

function toClockTime(epochSeconds) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds)) {
        return 'Sin horario';
    }

    return new Date(seconds * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function toCountdownLabel(epochSeconds) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds)) {
        return 'Sin estimacion';
    }

    const diffMins = Math.round((seconds * 1000 - Date.now()) / 60000);
    if (diffMins <= 0) {
        return 'Llegando';
    }

    return `En ${diffMins} min`;
}

function normalizeForecastEntities(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && Array.isArray(payload.Entity)) {
        return payload.Entity;
    }
    if (payload && Array.isArray(payload.entity)) {
        return payload.entity;
    }
    return [];
}

function buildArrivalItems(entities, stationName, lineId) {
    const normalizedStationName = normalizeText(stationName);
    const normalizedLine = String(lineId || '').trim().toUpperCase();

    const arrivals = [];

    entities.forEach(entity => {
        const linea = entity?.Linea || entity?.linea || {};
        const routeId = linea?.Route_Id || linea?.route_id || linea?.RouteId || '';
        const mappedLine = mapRouteIdToLine(routeId);

        if (normalizedLine && mappedLine && mappedLine !== normalizedLine) {
            return;
        }

        const estaciones = Array.isArray(linea?.Estaciones)
            ? linea.Estaciones
            : Array.isArray(linea?.estaciones)
                ? linea.estaciones
                : [];

        estaciones.forEach(stop => {
            const stopName = String(stop?.stop_name || '').trim();
            if (normalizeText(stopName) !== normalizedStationName) {
                return;
            }

            const arrivalTime = stop?.arrival?.time || stop?.departure?.time;
            arrivals.push({
                stopName,
                line: mappedLine || normalizedLine || 'Subte',
                tripId: linea?.Trip_Id || linea?.trip_id || 'N/A',
                direction: linea?.Direction_ID ?? linea?.direction_id,
                arrivalTime,
            });
        });
    });

    return arrivals.sort((a, b) => Number(a.arrivalTime || 0) - Number(b.arrivalTime || 0));
}

function renderDetailState(stationName, lineId, arrivals) {
    const container = document.getElementById('subteDetailState');
    if (!container) {
        return;
    }

    if (!Array.isArray(arrivals) || arrivals.length === 0) {
        container.innerHTML = `
            <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
                <p class="status-title">No hay arribos disponibles</p>
                <p class="line-subtitle">Estacion: ${stationName || 'Sin estacion'}</p>
                <p class="line-meta">Linea: ${lineId || 'Todas'}</p>
            </article>
        `;
        return;
    }

    container.innerHTML = `
        <article class="status-item train-header-card" style="align-items: flex-start; flex-direction: column; gap: 8px;">
            <p class="line-meta train-header-meta">Linea ${lineId || arrivals[0]?.line || 'Subte'}</p>
            <div class="train-title-row">
                <p class="status-title train-main-title">${stationName}</p>
                <span class="status-chip train-type-chip">Subte</span>
            </div>
            <p class="line-subtitle train-route">Proximos arribos en tiempo real</p>
        </article>
        <div class="status-list train-arrivals-list">
            ${arrivals.map(item => `
                <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                    <p class="status-title" style="font-size: 1.35rem;">${toClockTime(item.arrivalTime)}</p>
                    <p class="line-subtitle">${item.stopName}</p>
                    <p class="line-meta">${toCountdownLabel(item.arrivalTime)} · Viaje ${item.tripId}</p>
                </article>
            `).join('')}
        </div>
    `;
}

function renderNotFoundState(message) {
    const container = document.getElementById('subteDetailState');
    if (!container) {
        return;
    }

    container.innerHTML = `
        <article class="status-item" style="align-items: flex-start; flex-direction: column; gap: 8px;">
            <p class="status-title">No se pudo cargar el detalle</p>
            <p class="line-meta">${message}</p>
        </article>
    `;
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const stationName = String(params.get('station') || '').trim();
    const lineId = String(params.get('linea') || '').trim().toUpperCase();

    const backBtn = document.getElementById('subteDetailBackBtn');
    backBtn?.addEventListener('click', () => window.history.back());

    if (!stationName) {
        renderNotFoundState('Falta el nombre de la estacion.');
        return;
    }

    try {
        const payload = await getSubtesForecast();
        const entities = normalizeForecastEntities(payload);
        const arrivals = buildArrivalItems(entities, stationName, lineId);
        renderDetailState(stationName, lineId, arrivals);
    } catch (error) {
        console.error('Error al cargar detalle de subte:', error);
        renderNotFoundState('Intenta nuevamente en unos instantes.');
    }
}

document.addEventListener('DOMContentLoaded', init);
