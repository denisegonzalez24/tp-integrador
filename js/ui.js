
import { getFavoriteItems, isFavoriteItem } from './storage.js';

export function renderSubtes(routes, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!routes || routes.length === 0) {
        container.innerHTML = '<p class="empty">No se encontraron líneas de subtes.</p>';
        return;
    }

    container.innerHTML = routes.map(route => {
        const isFav = isFavoriteItem(route, 'subtes');
        return `
            <article class="line-card transport-card color-placeholder" data-trip-id="${route.route_id}" data-route-id="${route.route_id}" data-source="subtes" style="position: relative; border-left: 5px solid #${route.route_color};">
                <button type="button" class="transport-card-main" data-card-action="line-detail" data-trip-id="${route.route_id}" data-route-id="${route.route_id}" data-type="subte" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; cursor: pointer; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left;">
                    <div class="line-card-main" style="width: 100%;">
                        <div>
                            <p class="line-number" style="color: #${route.route_text_color}; background-color: #${route.route_color}; padding: 2px 8px; border-radius: 4px; display: inline-block;">Línea ${route.route_short_name}</p>
                            <p class="line-subtitle">${route.route_long_name}</p>
                        </div>
                    </div>
                    <p class="line-meta">Frecuencia estimada: ${Math.round(route.headway_secs / 60)} min</p>
                </button>
                <div style="padding: 0 16px 16px;">
                    <button type="button" class="secondary-btn line-action" data-card-action="line-detail" data-trip-id="${route.route_id}" data-route-id="${route.route_id}" data-type="subte">Detalles</button>
                </div>
                <button type="button" class="favorite-toggle ${isFav ? 'is-active' : ''}" data-card-action="favorite" data-trip-id="${route.route_id}" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="position: absolute; right: 16px; top: 16px;">
                    ${isFav ? '★' : '☆'}
                </button>
            </article>
        `;
    }).join('');
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

// En js/ui.js
export function renderColectivos(routes, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // Limpiamos

    if (!routes || routes.length === 0) {
        container.innerHTML = '<p class="empty">No se encontraron rutas de colectivos.</p>';
        return;
    }

    container.innerHTML = routes.map(route => {
        const isFav = isFavoriteItem(route, 'colectivos');
        return `
            <article class="line-card transport-card color-placeholder" data-trip-id="${route.route_id}" data-route-id="${route.route_id}" data-source="colectivos" style="position: relative; border-left: 5px solid #${route.route_color || '00b37e'};">
                <button type="button" class="transport-card-main" data-card-action="line-detail" data-trip-id="${route.route_id}" data-route-id="${route.route_id}" data-type="colectivo" style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; cursor: pointer; border: none; background: transparent; font-family: inherit; width: 100%; text-align: left;">
                    <div class="line-card-main" style="width: 100%;">
                        <div>
                            <p class="line-number">Línea ${route.route_short_name}</p>
                            <p class="line-subtitle">${route.route_long_name || 'Ramales varios'}</p>
                        </div>
                    </div>
                </button>
                <div style="padding: 0 16px 16px;">
                    <button type="button" class="secondary-btn line-action" data-card-action="line-detail" data-trip-id="${route.route_id}" data-route-id="${route.route_id}" data-type="colectivo">Detalles</button>
                </div>
                <button type="button" class="favorite-toggle ${isFav ? 'is-active' : ''}" data-card-action="favorite" data-trip-id="${route.route_id}" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="position: absolute; right: 16px; top: 16px;">
                    ${isFav ? '★' : '☆'}
                </button>
            </article>
        `;
    }).join('');
}

export function renderColectivosLines(data, page = 1) {
  const listContainer = document.getElementById('colectivosList');
  if (!listContainer) return;

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
  // Removido tras la actualización de alta fidelidad estática
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
  const detalleHero = document.getElementById('detalleHero');
  const detalleTitle = document.getElementById('detalleTitle');
  const detalleSubtitle = document.getElementById('detalleSubtitle');

  if (!container) return;

  // Limpiar el contenido anterior para asegurar una carga limpia
  container.innerHTML = '';

  // Renderizado a nivel línea (Ruta entera de colectivo estática)
  if (data?.isStaticColectivo) {
    const { routeId, paradas, routeInfo, realTimeActive } = data;
    const routeName = routeInfo?.route_short_name || routeId;
    const routeLongName = routeInfo?.route_long_name || 'Recorrido';
    
    if (detalleHero) {
        detalleHero.style.backgroundColor = '#00b37e';
        detalleHero.style.color = '#ffffff';
    }
    if (detalleTitle) detalleTitle.textContent = `Línea ${routeName}`;
    if (detalleSubtitle) detalleSubtitle.textContent = `Colectivo · ${routeLongName}`;

    const paradasHTML = (!paradas || paradas.length === 0)
      ? '<p class="line-meta">No hay paradas registradas para esta línea.</p>'
      : `<div class="train-stops-list">` + paradas.map(p => {
          const stopName = p.stop_name || p;
          const stopTime = p.time ? `<p class="line-meta">Hora estimada: <strong>${p.time}</strong></p>` : '';
          return `
          <article class="train-stop-item" style="padding-left: 11px; margin-bottom: 8px; border-left: 3px solid #00b37e;">
              <p class="status-title" style="font-size: 0.95rem;">🚌 ${stopName}</p>
              ${stopTime}
          </article>
        `}).join('') + `</div>`;

    let activeList = [];
    if (Array.isArray(realTimeActive)) activeList = realTimeActive;
    else if (realTimeActive?.entity) activeList = realTimeActive.entity;
    else if (realTimeActive?.Entity) activeList = realTimeActive.Entity;

    let realTimeHTML = '<p class="line-meta">No hay unidades reportando posición en este momento</p>';
    if (activeList && activeList.length > 0) {
      realTimeHTML = `<div class="train-stops-list">` + activeList.map(unit => {
        const lat = unit.vehicle?.position?.latitude;
        const lon = unit.vehicle?.position?.longitude;
        const vId = unit.vehicle?.vehicle?.id || 'Desconocido';
        return `
          <article class="train-stop-item" style="padding-left: 11px; margin-bottom: 8px; border-left: 3px solid #00b37e;">
              <p class="status-title" style="font-size: 0.95rem;">📍 Unidad ${vId}</p>
              <p class="line-meta">Lat: ${lat?.toFixed(4)} | Lon: ${lon?.toFixed(4)}</p>
          </article>
        `;
      }).join('') + `</div>`;
    }

    container.innerHTML = `
      <div class="detail-actions">
        <button type="button" class="secondary-btn" disabled>Recorrido Completo</button>
      </div>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; width: 100%;">
        <p class="status-title">Unidades en Tiempo Real</p>
        ${realTimeHTML}
      </article>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; width: 100%;">
        <p class="status-title">Itinerario y Paradas</p>
        ${paradasHTML}
      </article>
    `;
    return;
  }

  // Renderizado a nivel línea (Ruta entera de subte estática)
  if (data?.isStaticSubte) {
    const { routeId, paradas, routeInfo } = data;
    const routeName = routeInfo?.route_short_name || routeId;
    const routeLongName = routeInfo?.route_long_name || 'Recorrido';
    const color = routeInfo?.route_color || 'ccc';
    const textColor = routeInfo?.route_text_color || 'ffffff';
    
    if (detalleHero) {
        detalleHero.style.backgroundColor = `#${color}`;
        detalleHero.style.color = `#${textColor}`;
    }
    if (detalleTitle) detalleTitle.textContent = `Línea ${routeName}`;
    if (detalleSubtitle) detalleSubtitle.textContent = `Subte · ${routeLongName}`;

    const paradasHTML = (!paradas || paradas.length === 0)
      ? '<p class="line-meta">No hay paradas registradas para esta línea.</p>'
      : `<div class="train-stops-list">` + paradas.map(p => `
          <article class="train-stop-item" style="padding-left: 11px; margin-bottom: 8px; border-left: 3px solid #${color};">
              <p class="status-title" style="font-size: 0.95rem;">🚇 ${p.stop_name || p}</p>
          </article>
        `).join('') + `</div>`;

    const favoriteActive = isFavoriteItem(data, source);

    container.innerHTML = `
      <div class="detail-actions">
        <button type="button" class="secondary-btn ${favoriteActive ? 'favorite-active' : ''}" data-card-action="favorite-detail" aria-pressed="${favoriteActive}">${favoriteActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>
      </div>
      <article class="status-item" style="flex-direction: column; align-items: flex-start; gap: 8px; width: 100%;">
        <p class="status-title">Recorrido y Paradas</p>
        ${paradasHTML}
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

  if (detalleHero) {
      detalleHero.style.backgroundColor = ''; // Restablecer al color por defecto de CSS
      detalleHero.style.color = ''; // Restablecer al color por defecto de CSS
  }
  if (detalleTitle) detalleTitle.textContent = `Línea ${displayRoute === 'Sin línea' ? 'Sin línea' : displayRoute}`;
  if (detalleSubtitle) detalleSubtitle.textContent = `${tripHeadsign}${directionLabel ? ` · ${directionLabel}` : ''}`;

  container.innerHTML = `
    <div class="detail-actions">
      <button type="button" class="secondary-btn ${favoriteActive ? 'favorite-active' : ''}" data-card-action="favorite-detail" aria-pressed="${favoriteActive}">${favoriteActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>
    </div>
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