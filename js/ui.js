
import { getFavoriteItems, isFavoriteItem } from './storage.js';
import { generateTripStopListHTML } from './subtes.js';

export function renderSubtes(data, containerId, staticData = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Soportamos tanto 'entity' estándar como 'Entity' del mock
    const entities = data.entity || data.Entity || [];
    const routes = staticData?.routes || [];
    const trips = staticData?.trips || [];

    if (routes.length === 0) {
        container.innerHTML = '<p class="empty">Cargando rutas de subte...</p>';
        return;
    }

    const favs = getFavoriteItems();

    const cardsHTML = routes.map(route => {
        const routeEntities = entities.filter(e => {
            const eRouteId = e.Linea?.Route_Id || e.trip_update?.trip?.route_id || e.trip?.route_id;
            return eRouteId === route.id;
        });

        if (routeEntities.length === 0) {
            return `
                <article class="line-card transport-card" data-route-id="${route.id}" style="border-left: 4px solid #${route.color};">
                    <div class="transport-card-main" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%; text-align: left; background: transparent; border: none;">
                        <div class="line-card-main" style="width: 100%;">
                            <div>
                                <p class="line-number" style="color: #${route.color};">Línea ${route.short_name}</p>
                                <p class="line-subtitle">${route.long_name}</p>
                            </div>
                        </div>
                        <p class="line-meta">Sin trenes circulando ahora</p>
                        <button type="button" class="secondary-btn line-action" data-card-action="line-detail" data-route-id="${route.id}" style="margin-top: 8px;">Detalles</button>
                    </div>
                </article>
            `;
        }

        return routeEntities.map(item => {
            const linea = item.Linea || {};
            const trip = item.trip_update?.trip || item.trip || {};
            const tripId = linea.Trip_Id || trip.trip_id || item.id || item.ID || 'Desconocido';
            
            const favoriteId = `subtes:${String(route.id).toLowerCase()}:${String(tripId).toLowerCase()}`;
            const isFav = favs.some(f => f.favoriteId === favoriteId);

            // Usamos el destino enriquecido que ya trae el "Hacia "
            const headsign = linea.headsign || trip.trip_headsign || 'Destino desconocido';

            const estaciones = item.trip_update?.stop_time_update || item.stop_time_update || linea.Estaciones || [];

            const estacionesHTML = estaciones.map(estacion => {
                const stopName = estacion.stop_name || estacion.stop_id;
                const arrivalDelay = estacion.arrival?.delay || 0;
                const arrivalTimeUnix = estacion.arrival?.time;
                let timeStr = 'Sin tiempo';
                
                if (arrivalTimeUnix) {
                    const dt = new Date(arrivalTimeUnix * 1000);
                    timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                // Cálculo del delay en minutos para formato "+X min"
                const delayMinutes = Math.round(arrivalDelay / 60);
                const delayStr = delayMinutes > 0 ? ` <strong class="text-danger">(+${delayMinutes} min)</strong>` : '';

                return `<p class="line-meta">• ${stopName}: <strong>${timeStr}</strong>${delayStr}</p>`;
            }).join('');

            return `
                <article class="line-card transport-card" data-trip-id="${tripId}" data-route-id="${route.id}" data-source="subtes" style="border-left: 4px solid #${route.color}; position: relative;">
                    <button type="button" class="transport-card-main" data-card-action="open" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; cursor: pointer; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left;">
                        <div class="line-card-main" style="width: 100%;">
                            <div>
                                <p class="line-number" style="color: #${route.color};">Línea ${route.short_name}</p>
                                <p class="line-subtitle">Destino: ${headsign}</p>
                            </div>
                        </div>
                        <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">${estacionesHTML || '<p class="line-meta">No hay estaciones listadas.</p>'}</div>
                    </button>
                    <div style="padding: 0 16px 16px;">
                        <button type="button" class="secondary-btn line-action" data-card-action="line-detail" data-route-id="${route.id}">Detalles</button>
                    </div>
                    <button type="button" class="favorite-toggle ${isFav ? 'is-active' : ''}" data-card-action="favorite" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="position: absolute; right: 16px; top: 16px;">
                        ${isFav ? '★' : '☆'}
                    </button>
                </article>
            `;
        }).join('');
    }).join('');

    container.innerHTML = cardsHTML;
}

export function getItemTripId(item) {
  return item?._ui_id || item?.id || item?.trip?.trip_id || item?.trip_id || item?.vehicle?.vehicle?.id || item?.vehicle?.id || '';
}

export function renderFavoriteToggleButton(item, source) {
  const favoriteActive = isFavoriteItem(item, source);
  return `
    <button type="button" class="favorite-toggle ${favoriteActive ? 'is-active' : ''}" data-card-action="favorite" aria-pressed="${favoriteActive}" aria-label="${favoriteActive ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
      ${favoriteActive ? '★' : '☆'}
    </button>
  `;
}

export function renderTransportCard({ item, source, title, subtitle, metaLines = [], routeLine = '' }) {
  const uniqueId = getItemTripId(item) || `${source}-${Math.random().toString(16).slice(2)}`;

  return `
    <article class="line-card transport-card" data-trip-id="${uniqueId}" data-source="${source}">
      <button type="button" class="transport-card-main" data-card-action="open">
        <div class="line-card-main">
          <div>
            <p class="line-number">${title}</p>
            <p class="line-subtitle">${subtitle}</p>
          </div>
        </div>
        ${routeLine ? `<p class="line-route">${routeLine}</p>` : ''}
        ${metaLines.map(line => `<p class="line-meta">${line}</p>`).join('')}
      </button>
      ${renderFavoriteToggleButton(item, source)}
    </article>
  `;
}

export function renderFavoriteCard(record) {
  const favoriteData = record?.data || {};
  const title = record?.title || 'Favorito';
  const subtitle = record?.subtitle || 'Guardado en favoritos';
  const routeName = favoriteData?.route_short_name || favoriteData?.route_id || favoriteData?.routeId || favoriteData?.trip?.route_id || favoriteData?.trip?.routeId || favoriteData?.linea?.route_Id || favoriteData?.linea?.route_id || 'Sin línea';
  const vehicle = favoriteData?.vehicle || favoriteData?.Vehicle || {};
  const lat = vehicle.position?.latitude;
  const lon = vehicle.position?.longitude;

  return `
    <article class="status-item favorite-item" data-favorite-id="${record.favoriteId}">
      <button type="button" class="favorite-item-main" data-card-action="open-favorite">
        <p class="status-title">${title}</p>
        <p class="line-subtitle">${subtitle}</p>
        <p class="line-meta">${routeName}${lat !== undefined && lon !== undefined ? ` • Lat ${lat.toFixed(4)} • Lon ${lon.toFixed(4)}` : ''}</p>
      </button>
      <div class="favorite-item-actions">
        <button type="button" class="secondary-btn" data-card-action="remove-favorite">Quitar</button>
      </div>
    </article>
  `;
}

export function renderFavoritesView() {
  const favoritesSection = document.getElementById('view-favoritos');
  if (!favoritesSection) return;
  const favoriteItems = getFavoriteItems();

  favoritesSection.innerHTML = `
    <div class="hero-card">
      <div class="hero-icon" aria-hidden="true">⭐</div>
      <h2>Favoritos</h2>
      <p class="hero-text">Guardá tus líneas y paradas más usadas para acceder rápido.</p>
      ${favoriteItems.length === 0
      ? `
          <div class="empty-state">
            <p class="status-title">Aún no hay favoritos</p>
            <p class="line-subtitle">Abrí una línea, revisá su detalle y marcala como favorita.</p>
            <button type="button" class="primary-btn favorite-cta" data-favorites-action="browse-colectivos">Ver colectivos</button>
          </div>
        `
      : `
          <div id="favoritesList" class="status-list favorites-list">
            ${favoriteItems.map(renderFavoriteCard).join('')}
          </div>
        `}
    </div>
  `;
}

function updatePaginationControls(prefix, currentPage, totalItems, pageSize) {
  const prev10Btn = document.getElementById(`${prefix}Prev10Btn`);
  const prevBtn = document.getElementById(`${prefix}PrevBtn`);
  const nextBtn = document.getElementById(`${prefix}NextBtn`);
  const next10Btn = document.getElementById(`${prefix}Next10Btn`);
  const pageLabel = document.getElementById(`${prefix}PageLabel`);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (prev10Btn) prev10Btn.disabled = currentPage <= 1;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (next10Btn) next10Btn.disabled = currentPage >= totalPages;
  if (pageLabel) pageLabel.textContent = `${currentPage} de ${totalPages}`;
}

export function renderColectivosLines(data, page = 1) {
  const listContainer = document.getElementById('colectivosList');
  if (!listContainer) return;

  const COLECTIVOS_PAGE_SIZE = 10;
  if (!Array.isArray(data) || data.length === 0) {
    listContainer.innerHTML = '<p class="empty">No se encontraron líneas de colectivos.</p>';
    updatePaginationControls('colectivos', page, 0, COLECTIVOS_PAGE_SIZE);
    return;
  }

  const startIndex = (page - 1) * COLECTIVOS_PAGE_SIZE;
  const pageData = data.slice(startIndex, startIndex + COLECTIVOS_PAGE_SIZE);

  listContainer.innerHTML = pageData
    .map((item, index) => {
      const uniqueId = item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `colectivo-${index}`;
      item._ui_id = uniqueId;
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;

      const routeId = item.route_id || item.routeId || item.route_short_name || 'N/A';
      const isFav = isFavoriteItem(item, 'colectivos');

      const estacionesHTML = `
        <p class="line-route">Viaje ${item.trip?.trip_id || item.id || 'N/A'} • ${serviceLabel}</p>
        <p class="line-meta">Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}</p>
      `;

      return `
        <article class="line-card transport-card color-placeholder" data-trip-id="${uniqueId}" data-route-id="${routeId}" data-source="colectivos" style="position: relative;">
            <button type="button" class="transport-card-main" data-card-action="open" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; cursor: pointer; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left;">
                <div class="line-card-main" style="width: 100%;">
                    <div>
                        <p class="line-number">Línea ${item.route_short_name || 'N/A'}</p>
                        <p class="line-subtitle">${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}</p>
                    </div>
                </div>
                <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">${estacionesHTML}</div>
            </button>
            <div style="padding: 0 16px 16px;">
                <button type="button" class="secondary-btn line-action" data-card-action="line-detail" data-route-id="${routeId}">Detalles</button>
            </div>
            <button type="button" class="favorite-toggle ${isFav ? 'is-active' : ''}" data-card-action="favorite" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="position: absolute; right: 16px; top: 16px;">
                ${isFav ? '★' : '☆'}
            </button>
        </article>
      `;
    })
    .join('');

  updatePaginationControls('colectivos', page, data.length, COLECTIVOS_PAGE_SIZE);
}

export function renderSoloColectivosLines(data, page = 1) {
  const listContainer = document.getElementById('soloColectivosList');
  if (!listContainer) return;

  const SOLO_COLECTIVOS_PAGE_SIZE = 10;
  if (!Array.isArray(data) || data.length === 0) {
    listContainer.innerHTML = '<p class="empty">No se encontraron líneas de colectivos.</p>';
    updatePaginationControls('soloColectivos', page, 0, SOLO_COLECTIVOS_PAGE_SIZE);
    return;
  }

  const startIndex = (page - 1) * SOLO_COLECTIVOS_PAGE_SIZE;
  const pageData = data.slice(startIndex, startIndex + SOLO_COLECTIVOS_PAGE_SIZE);

  listContainer.innerHTML = pageData
    .map((item, index) => {
      const uniqueId = item.id || item.trip?.trip_id || item.trip_id || item.vehicle?.vehicle?.id || `solo-colectivo-${index}`;
      item._ui_id = uniqueId;
      const directionLabel = item.trip?.direction_id === '1' || item.trip?.direction_id === 1 ? 'vuelta' : 'ida';
      const serviceLabel = item.trip?.service_id === '2' || item.trip?.service_id === 2
        ? 'horario fin de semana'
        : item.trip?.service_id === '1' || item.trip?.service_id === 1
          ? 'días hábiles'
          : `servicio ${item.trip?.service_id || 'N/A'}`;

      const routeId = item.route_id || item.routeId || item.route_short_name || 'N/A';
      const isFav = isFavoriteItem(item, 'solo-colectivos');

      const estacionesHTML = `
        <p class="line-route">Viaje ${item.trip?.trip_id || item.id || 'N/A'} • ${serviceLabel}</p>
        <p class="line-meta">Posición: Lat ${item.vehicle?.position?.latitude?.toFixed(4) || 'N/A'} • Lon ${item.vehicle?.position?.longitude?.toFixed(4) || 'N/A'}</p>
      `;

      return `
        <article class="line-card transport-card color-placeholder" data-trip-id="${uniqueId}" data-route-id="${routeId}" data-source="solo-colectivos" style="position: relative;">
            <button type="button" class="transport-card-main" data-card-action="open" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; cursor: pointer; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left;">
                <div class="line-card-main" style="width: 100%;">
                    <div>
                        <p class="line-number">Línea ${item.route_short_name || 'N/A'}</p>
                        <p class="line-subtitle">${item.trip?.trip_headsign || 'Sin destino'} · ${directionLabel}</p>
                    </div>
                </div>
                <div style="width: 100%; display: flex; flex-direction: column; gap: 4px;">${estacionesHTML}</div>
            </button>
            <div style="padding: 0 16px 16px;">
                <button type="button" class="secondary-btn line-action" data-card-action="line-detail" data-route-id="${routeId}">Detalles</button>
            </div>
            <button type="button" class="favorite-toggle ${isFav ? 'is-active' : ''}" data-card-action="favorite" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="position: absolute; right: 16px; top: 16px;">
                ${isFav ? '★' : '☆'}
            </button>
        </article>
      `;
    })
    .join('');

  updatePaginationControls('soloColectivos', page, data.length, SOLO_COLECTIVOS_PAGE_SIZE);
}

export function renderSubtesLines(data, page = 1, staticSubteData = null) {
  let normalizedData = [];
  if (Array.isArray(data)) normalizedData = data;
  else if (data && Array.isArray(data.entity)) normalizedData = data.entity;
  else if (data && Array.isArray(data.Entity)) normalizedData = data.Entity;

  // Aumentamos el pageSize a 50 para que muestre todos los arribos de todas las líneas en una vista
  const SUBTES_PAGE_SIZE = 50;
  const startIndex = (page - 1) * SUBTES_PAGE_SIZE;
  const pageData = normalizedData.slice(startIndex, startIndex + SUBTES_PAGE_SIZE);
  
  renderSubtes({ Entity: pageData }, 'subtesList', staticSubteData);
  updatePaginationControls('subtes', page, normalizedData.length, SUBTES_PAGE_SIZE);
}

export function renderSearchResults(data, page = 1) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  const BUSCAR_PAGE_SIZE = 10;
  if (!Array.isArray(data) || data.length === 0) {
    resultsContainer.innerHTML = '<p class="empty">No se encontraron resultados.</p>';
    updatePaginationControls('buscar', page, 0, BUSCAR_PAGE_SIZE);
    return;
  }

  const startIndex = (page - 1) * BUSCAR_PAGE_SIZE;
  const pageData = data.slice(startIndex, startIndex + BUSCAR_PAGE_SIZE);

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

    return renderTransportCard({
      item,
      source: 'buscar',
      title: routeName,
      subtitle: 'Colectivo · Datos de API',
      routeLine: routeLongName,
      metaLines: [
        uniqueId ? `ID: ${uniqueId}` : '',
        serviceId ? `Service ID: ${serviceId}` : '',
        directionId ? `Direction ID: ${directionId}` : '',
        vehicleId ? `Vehicle ID: ${vehicleId}` : '',
        meta,
      ].filter(Boolean),
    });
  }).join('');

  updatePaginationControls('buscar', page, data.length, BUSCAR_PAGE_SIZE);
}

export function renderLineDetails(data, source = 'detalle', staticSubteData) {
  const container = document.getElementById('detalleContent');
  if (!container) return;

  // Renderizado a nivel línea (Ruta entera de subte filtrada)
  if (data?.isRouteLevel) {
    const routeId = data.routeId;
    const routeInfo = staticSubteData?.routes?.find(r => r.id === routeId) || { short_name: routeId, long_name: '', color: 'ccc' };
    const routeEntities = (data.entities || []).filter(e => {
        const eRouteId = e.Linea?.Route_Id || e.trip_update?.trip?.route_id || e.trip?.route_id;
        return eRouteId === routeId;
    });

    const activeTrainsHTML = routeEntities.length === 0 
      ? '<p class="line-meta">Sin trenes circulando ahora</p>'
      : routeEntities.map(item => {
          const tripId = item.Linea?.Trip_Id || item.trip_update?.trip?.trip_id || item.id || 'Desconocido';
          const headsign = item.Linea?.headsign || item.trip_update?.trip?.trip_headsign || 'Destino desconocido';
          const estaciones = item.trip_update?.stop_time_update || item.Linea?.Estaciones || [];
          const nextStop = estaciones[0];
          const stopName = nextStop?.stop_name || nextStop?.stop_id || 'Desconocido';
          const delay = nextStop?.arrival?.delay || 0;
          const time = nextStop?.arrival?.time ? new Date(nextStop.arrival.time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
          
          return `
            <div style="border-left: 3px solid #${routeInfo.color}; padding-left: 8px; margin-bottom: 12px;">
              <p class="status-title" style="font-size: 1rem;">Viaje ${tripId}</p>
              <p class="line-subtitle">${headsign}</p>
              ${time ? `<p class="line-meta">Próxima parada: ${stopName} a las ${time} ${delay > 0 ? `(+${Math.round(delay/60)} min)` : ''}</p>` : ''}
            </div>
          `;
        }).join('');

    container.innerHTML = `
      <div class="detail-actions">
        <button type="button" class="secondary-btn" disabled>Línea Completa</button>
      </div>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; border-top: 4px solid #${routeInfo.color};">
        <p class="status-title" style="font-size: 1.25rem; color: #${routeInfo.color};">Línea ${routeInfo.short_name}</p>
        <p class="line-subtitle">${routeInfo.long_name}</p>
      </article>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; width: 100%;">
        <p class="status-title">Trenes en circulación</p>
        ${activeTrainsHTML}
      </article>
    `;
    return;
  }

  // Detectar si es un viaje individual de subte (mock o API en tiempo real)
  const isSubte = source === 'subtes' || data?.Linea || data?.trip_update?.trip?.route_id?.startsWith('Linea');
  if (isSubte) {
    const linea = data?.Linea || {};
    const tripUpdate = data?.trip_update || {};
    const trip = tripUpdate.trip || data?.trip || {};

    const routeId = linea.Route_Id || trip.route_id || data?.route_id || 'Subte';
    const tripId = linea.Trip_Id || trip.trip_id || data?.id || 'Desconocido';
    const headsign = linea.headsign || trip.trip_headsign || 'Desconocido';
    
    const routeInfo = staticSubteData?.routes?.find(r => r.id === routeId) || { short_name: routeId.replace('Linea', ''), long_name: '', color: 'ccc' };
    const realTimeStops = tripUpdate.stop_time_update || linea.Estaciones || [];

    const stopListHTML = generateTripStopListHTML(tripId, staticSubteData, realTimeStops);
    const favoriteActive = isFavoriteItem(data, source);

    container.innerHTML = `
      <div class="detail-actions">
        <button type="button" class="secondary-btn ${favoriteActive ? 'favorite-active' : ''}" data-card-action="favorite-detail" aria-pressed="${favoriteActive}">${favoriteActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>
      </div>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; border-top: 4px solid #${routeInfo.color};">
        <p class="status-title" style="font-size: 1.5rem; color: #${routeInfo.color}; font-weight: bold;">Línea ${routeInfo.short_name}</p>
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
  const favoriteActive = isFavoriteItem(data, source);

  container.innerHTML = `
    <div class="detail-actions">
      <button type="button" class="secondary-btn ${favoriteActive ? 'favorite-active' : ''}" data-card-action="favorite-detail" aria-pressed="${favoriteActive}">${favoriteActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>
    </div>
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