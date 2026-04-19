
import { loadData } from './storage.js';

export function renderSubtes(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Soportamos tanto 'entity' estándar como 'Entity' del mock
    const entities = data.entity || data.Entity || [];

    if (entities.length === 0) {
        container.innerHTML = '<p class="empty">No hay subtes disponibles.</p>';
        return;
    }

    const favs = loadData('favoriteTransportItems') || [];

    const cardsHTML = entities.map(item => {
        // Adaptación para el mock JSON y formato estándar GTFS
        const linea = item.Linea || {};
        const routeId = linea.Route_Id || item.route_id || 'Subte';
        const tripId = linea.Trip_Id || item.ID || 'Desconocido';
        
        const favoriteId = `subtes:${String(routeId).toLowerCase()}:${String(tripId).toLowerCase()}`;
        const isFav = favs.some(f => f.favoriteId === favoriteId);

        // Buscamos 'stop_time_update' como solicitaste, o 'Estaciones' del mock
        const estaciones = item.stop_time_update || linea.Estaciones || [];

        const estacionesHTML = estaciones.map(estacion => {
            const stopName = estacion.stop_name || estacion.stop_id;
            const arrivalDelay = estacion.arrival?.delay || 0;
            const arrivalTime = estacion.arrival?.time 
                ? new Date(estacion.arrival.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : 'Sin tiempo';

            // Aplicamos la clase .text-danger si el delay supera los 300 segundos
            const timeClass = arrivalDelay > 300 ? 'text-danger' : '';

            return `<p class="line-meta">• ${stopName}: <strong class="${timeClass}">${arrivalTime}</strong> (Demora: ${arrivalDelay}s)</p>`;
        }).join('');

        return `
            <article class="line-card transport-card" data-trip-id="${tripId}" data-source="subtes" style="position: relative;">
                <button type="button" class="transport-card-main" data-card-action="open" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; cursor: pointer; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left;">
                    <div class="line-card-main" style="width: 100%;">
                        <div>
                            <p class="line-number">${routeId}</p>
                            <p class="line-subtitle">Viaje: ${tripId}</p>
                        </div>
                    </div>
                    <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">${estacionesHTML || '<p class="line-meta">No hay estaciones listadas.</p>'}</div>
                </button>
                <button type="button" class="favorite-toggle ${isFav ? 'is-active' : ''}" data-card-action="favorite" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="position: absolute; right: 16px; top: 16px;">
                    ${isFav ? '★' : '☆'}
                </button>
            </article>
        `;
    }).join('');

    container.innerHTML = cardsHTML;
}