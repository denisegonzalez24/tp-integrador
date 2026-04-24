let favoriteItems = [];
let ctx = {};

export function initFavoritesModule(context) {
    ctx = context || {};
    const storedFavorites = ctx.loadData?.(ctx.storageKey);
    favoriteItems = Array.isArray(storedFavorites) ? storedFavorites : [];
}

function persistFavoriteItems() {
    ctx.saveData?.(ctx.storageKey, favoriteItems);
}

function getFavoriteItemId(data, source) {
    if (source === 'buscar') {
        return `buscar:${String(data?.id_estacion || data?.id || 'estacion').trim().toLowerCase()}`;
    }

    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const vehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
    const routeName = String(data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'sin-linea').trim().toLowerCase();
    const tripId = String(trip.trip_id || trip.tripId || data?.trip_id || data?.tripId || data?.id || '').trim().toLowerCase();
    const vehicleId = String(vehicle.vehicle?.id || vehicle.id || '').trim().toLowerCase();

    return `${source}:${routeName}:${tripId || vehicleId || 'item'}`;
}

export function isFavoriteItem(data, source) {
    const favoriteId = getFavoriteItemId(data, source);
    return favoriteItems.some(item => item.favoriteId === favoriteId);
}

function buildFavoriteRecord(data, source) {
    if (source === 'buscar') {
        return {
            favoriteId: getFavoriteItemId(data, source),
            source,
            savedAt: new Date().toISOString(),
            title: `Estacion ${data?.nombre || 'sin nombre'}`,
            subtitle: `Linea ${ctx.getStationLineFromRamales?.(data?.incluida_en_ramales || []) || 'Tren'}`,
            data,
        };
    }

    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const tripVehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || tripVehicle.trip || data?.trip || {};
    const routeShortName = data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'Sin linea';
    const routeLongName = data?.route_long_name || trip.route_long_name || trip.routeLongName || '';
    const headsign = trip.trip_headsign || trip.tripHeadsign || data?.trip?.trip_headsign || 'Sin destino';
    const favoriteId = getFavoriteItemId(data, source);

    return {
        favoriteId,
        source,
        savedAt: new Date().toISOString(),
        title: source === 'subtes' ? `Subte ${String(routeShortName).replace(/l[ií]nea/i, '').replace(/_/g, ' ').trim()}` : `Linea ${routeShortName}`,
        subtitle: routeLongName || headsign,
        data,
    };
}

export function toggleFavoriteItem(data, source) {
    const favoriteId = getFavoriteItemId(data, source);
    const existingIndex = favoriteItems.findIndex(item => item.favoriteId === favoriteId);

    if (existingIndex >= 0) {
        favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
    } else {
        favoriteItems = [buildFavoriteRecord(data, source), ...favoriteItems];
    }

    persistFavoriteItems();
    ctx.onFavoritesChanged?.();
}

export function removeFavoriteItem(favoriteId) {
    favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
    persistFavoriteItems();
    ctx.onFavoritesChanged?.();
}

function renderFavoriteCard(record) {
    const favoriteData = record?.data || {};
    const title = record?.title || 'Favorito';
    const subtitle = record?.subtitle || 'Guardado en favoritos';

    if (record?.source === 'buscar') {
        const lat = favoriteData?.latitud;
        const lon = favoriteData?.longitud;
        return `
      <article class="status-item favorite-item" data-favorite-id="${record.favoriteId}">
        <button type="button" class="favorite-item-main" data-card-action="open-favorite">
          <p class="status-title">${title}</p>
          <p class="line-subtitle">${subtitle}</p>
          <p class="line-meta">ID estacion: ${favoriteData?.id_estacion || 'N/A'}${lat && lon ? ` - Lat ${lat} - Lon ${lon}` : ''}</p>
        </button>
        <div class="favorite-item-actions">
          <button type="button" class="secondary-btn" data-card-action="remove-favorite">Quitar</button>
        </div>
      </article>
    `;
    }

    const routeName = favoriteData?.route_short_name || favoriteData?.route_id || favoriteData?.routeId || favoriteData?.trip?.route_id || favoriteData?.trip?.routeId || favoriteData?.linea?.route_Id || favoriteData?.linea?.route_id || 'Sin linea';
    const vehicle = favoriteData?.vehicle || favoriteData?.Vehicle || {};
    const lat = vehicle.position?.latitude;
    const lon = vehicle.position?.longitude;

    return `
    <article class="status-item favorite-item" data-favorite-id="${record.favoriteId}">
      <button type="button" class="favorite-item-main" data-card-action="open-favorite">
        <p class="status-title">${title}</p>
        <p class="line-subtitle">${subtitle}</p>
        <p class="line-meta">${routeName}${lat !== undefined && lon !== undefined ? ` - Lat ${lat.toFixed(4)} - Lon ${lon.toFixed(4)}` : ''}</p>
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

    favoritesSection.innerHTML = `
    <div class="hero-card">
      <div class="hero-icon" aria-hidden="true">⭐</div>
      <h2>Favoritos</h2>
      <p class="hero-text">Guarda tus lineas y paradas mas usadas para acceder rapido.</p>
      <button type="button" class="link-button" data-favorites-action="go-home">← Volver al inicio</button>
      ${favoriteItems.length === 0
            ? `
          <div class="empty-state">
            <p class="status-title">Aun no hay favoritos</p>
            <p class="line-subtitle">Abri una linea, revisa su detalle y marcala como favorita.</p>
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

export function handleFavoritesClick(event) {
    const actionButton = event.target.closest('[data-card-action]');
    if (!actionButton) {
        return false;
    }

    const favoriteCard = event.target.closest('[data-favorite-id]');
    if (!favoriteCard) {
        return false;
    }

    const favoriteRecord = favoriteItems.find(item => item.favoriteId === favoriteCard.dataset.favoriteId);
    if (!favoriteRecord) {
        return false;
    }

    const action = actionButton.dataset.cardAction;

    if (action === 'open-favorite') {
        if (favoriteRecord.source === 'buscar') {
            const stationId = favoriteRecord.data?.id_estacion || favoriteRecord.data?.id;
            if (stationId) {
                ctx.openStationDetail?.(stationId, favoriteRecord.data);
            }
        } else {
            ctx.openTransportDetail?.(favoriteRecord.data, favoriteRecord.source || 'favoritos');
        }
        return true;
    }

    if (action === 'remove-favorite') {
        removeFavoriteItem(favoriteRecord.favoriteId);
        return true;
    }

    return false;
}

export function getFavoriteItems() {
    return favoriteItems;
}
