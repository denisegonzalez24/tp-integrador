let favoriteItems = [];
let ctx = {};

const FAVORITE_NOTE_MAX_LENGTH = 120;

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function initFavoritesModule(context) {
    ctx = context || {};
    const storedFavorites = ctx.loadData?.(ctx.storageKey);
    favoriteItems = Array.isArray(storedFavorites) ? storedFavorites.map(normalizeStoredFavoriteRecord) : [];
    persistFavoriteItems();
}

function persistFavoriteItems() {
    ctx.saveData?.(ctx.storageKey, favoriteItems);
}

function normalizeStoredFavoriteRecord(record) {
    if (record?.source !== 'subtes' || record?.preferences?.customName) {
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

function getFavoriteItemId(data, source) {
    if (source === 'buscar') {
        return `buscar:${String(data?.id_estacion || data?.id || 'estacion').trim().toLowerCase()}`;
    }

    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const vehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || vehicle.trip || data?.trip || {};
    const routeName = String(data?.linea || data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'sin-linea').trim().toLowerCase();
    const tripId = String(data?.ramal_id || trip.trip_id || trip.tripId || data?.trip_id || data?.tripId || data?.id || '').trim().toLowerCase();
    const vehicleId = String(data?.id_vehiculo || vehicle.vehicle?.id || vehicle.id || '').trim().toLowerCase();

    return `${source}:${routeName}:${tripId || vehicleId || 'item'}`;
}

export function isFavoriteItem(data, source) {
    const favoriteId = getFavoriteItemId(data, source);
    return favoriteItems.some(item => item.favoriteId === favoriteId);
}

function getPriorityLabel(priority) {
    const labels = {
        1: 'Alta',
        2: 'Media',
        3: 'Baja',
    };

    return labels[Number(priority)] || '';
}

function normalizeFavoritePreferences(formData) {
    const priority = Number(formData.get('priority'));
    const tag = String(formData.get('tag') || '').trim();
    const customName = String(formData.get('customName') || '').trim();
    const note = String(formData.get('note') || '').trim();
    const errors = [];

    if (!Number.isFinite(priority) || priority <= 0) {
        errors.push('Elegi una prioridad valida.');
    }

    if (!tag) {
        errors.push('Elegi una etiqueta.');
    }

    if (note.length > FAVORITE_NOTE_MAX_LENGTH) {
        errors.push(`La nota no puede superar ${FAVORITE_NOTE_MAX_LENGTH} caracteres.`);
    }

    return {
        errors,
        preferences: {
            priority,
            priorityLabel: getPriorityLabel(priority),
            tag,
            customName,
            note,
        },
    };
}

function showFavoriteConfirmation() {
    document.querySelector('.favorite-confirmation-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'favorite-confirmation-toast';
    toast.textContent = 'Favorito guardado';
    document.body.appendChild(toast);

    window.setTimeout(() => toast.remove(), 2200);
}

function closeFavoritePreferencesForm() {
    document.querySelector('.favorite-form-backdrop')?.remove();
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

function buildFavoriteRecord(data, source, preferences = null) {
    if (source === 'buscar') {
        return {
            favoriteId: getFavoriteItemId(data, source),
            source,
            savedAt: new Date().toISOString(),
            title: preferences?.customName || `Estacion ${data?.nombre || 'sin nombre'}`,
            subtitle: `Linea ${ctx.getStationLineFromRamales?.(data?.incluida_en_ramales || []) || 'Tren'}`,
            preferences,
            data,
        };
    }

    const tripUpdate = data?.trip_update || data?.tripUpdate || {};
    const tripVehicle = data?.vehicle || data?.Vehicle || {};
    const trip = tripUpdate.trip || tripVehicle.trip || data?.trip || {};
    const routeShortName = data?.linea || data?.route_short_name || data?.route_id || data?.routeId || trip.route_id || trip.routeId || data?.linea?.route_Id || data?.linea?.route_id || 'Sin linea';
    const routeLongName = data?.route_long_name || trip.route_long_name || trip.routeLongName || '';
    const headsign = data?.ramal_destino || trip.trip_headsign || trip.tripHeadsign || data?.trip?.trip_headsign || 'Sin destino';
    const favoriteId = getFavoriteItemId(data, source);
    const subteStationName = getSubteStationName(data);

    return {
        favoriteId,
        source,
        savedAt: new Date().toISOString(),
        title: preferences?.customName || (source === 'subtes' ? (subteStationName || `Subte ${String(routeShortName).replace(/linea/i, '').replace(/_/g, ' ').trim()}`) : `Linea ${routeShortName}`),
        subtitle: routeLongName || headsign,
        preferences,
        data,
    };
}

function openFavoritePreferencesForm(data, source, favoriteId) {
    closeFavoritePreferencesForm();

    const backdrop = document.createElement('div');
    backdrop.className = 'favorite-form-backdrop';
    backdrop.innerHTML = `
        <form class="favorite-form" novalidate>
            <div>
                <p class="status-title">Personalizar favorito</p>
                <p class="line-meta">Completa los datos para guardar esta entrada.</p>
            </div>

            <label class="favorite-form-field">
                <span>Prioridad</span>
                <select name="priority" required>
                    <option value="">Seleccionar</option>
                    <option value="1">Alta</option>
                    <option value="2">Media</option>
                    <option value="3">Baja</option>
                </select>
            </label>

            <label class="favorite-form-field">
                <span>Etiqueta</span>
                <select name="tag" required>
                    <option value="">Seleccionar</option>
                    <option value="Casa">Casa</option>
                    <option value="Trabajo">Trabajo</option>
                    <option value="Estudio">Estudio</option>
                    <option value="Gym">Gym</option>
                    <option value="Otro">Otro</option>
                </select>
            </label>

            <label class="favorite-form-field">
                <span>Nombre personalizado</span>
                <input name="customName" type="text" maxlength="40" placeholder="Ej: Viaje a la oficina">
            </label>

            <label class="favorite-form-field">
                <span>Nota personal</span>
                <textarea name="note" maxlength="${FAVORITE_NOTE_MAX_LENGTH}" rows="3" placeholder="Opcional"></textarea>
            </label>

            <p class="favorite-form-error" aria-live="polite"></p>

            <div class="favorite-form-actions">
                <button type="button" class="secondary-btn" data-favorite-form-action="cancel">Cancelar</button>
                <button type="submit" class="primary-btn">Guardar</button>
            </div>
        </form>
    `;

    document.body.appendChild(backdrop);

    const form = backdrop.querySelector('.favorite-form');
    const error = backdrop.querySelector('.favorite-form-error');
    const note = backdrop.querySelector('[name="note"]');

    note?.addEventListener('input', () => {
        if (note.value.length > FAVORITE_NOTE_MAX_LENGTH) {
            note.value = note.value.slice(0, FAVORITE_NOTE_MAX_LENGTH);
        }
    });

    backdrop.addEventListener('click', event => {
        if (event.target === backdrop || event.target.closest('[data-favorite-form-action="cancel"]')) {
            closeFavoritePreferencesForm();
        }
    });

    form?.addEventListener('submit', event => {
        event.preventDefault();

        const { errors, preferences } = normalizeFavoritePreferences(new FormData(form));
        if (errors.length > 0) {
            error.textContent = errors[0];
            return;
        }

        favoriteItems = [
            buildFavoriteRecord(data, source, preferences),
            ...favoriteItems.filter(item => item.favoriteId !== favoriteId),
        ];

        persistFavoriteItems();
        closeFavoritePreferencesForm();
        showFavoriteConfirmation();
        ctx.onFavoritesChanged?.();
    });
}

export function toggleFavoriteItem(data, source) {
    const favoriteId = getFavoriteItemId(data, source);
    const existingIndex = favoriteItems.findIndex(item => item.favoriteId === favoriteId);

    if (existingIndex >= 0) {
        favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
        persistFavoriteItems();
        ctx.onFavoritesChanged?.();
        return;
    }

    openFavoritePreferencesForm(data, source, favoriteId);
}

export function removeFavoriteItem(favoriteId) {
    favoriteItems = favoriteItems.filter(item => item.favoriteId !== favoriteId);
    persistFavoriteItems();
    ctx.onFavoritesChanged?.();
}

function renderPreferences(record) {
    const preferences = record?.preferences || {};
    if (!preferences.priority || !preferences.tag) {
        return '';
    }

    const tagIcon = getTagIcon(preferences.tag);
    const note = preferences.note ? `<p class="line-meta favorite-note">Nota: ${escapeHTML(preferences.note)}</p>` : '';

    return `
        <div class="favorite-preferences">
            <span class="favorite-tag">${tagIcon ? `<span aria-hidden="true">${tagIcon}</span>` : ''}${escapeHTML(preferences.tag)}</span>
            <span class="favorite-priority">Prioridad: ${escapeHTML(preferences.priorityLabel || preferences.priority)}</span>
        </div>
        ${note}
    `;
}

function getTagIcon(tag) {
    const icons = {
        Casa: '⌂',
        Trabajo: '▣',
        Estudio: '✎',
        Gym: '◆',
        Otro: '•',
    };

    return icons[tag] || '';
}

function getFavoriteTransportType(record) {
    if (record?.source === 'buscar') {
        return 'Tren';
    }

    if (record?.source === 'subtes') {
        return 'Subte';
    }

    return 'Colectivo';
}

function getFavoriteTransportName(record) {
    const data = record?.data || {};

    if (record?.source === 'buscar') {
        return data?.nombre || record?.subtitle || 'Estacion de tren';
    }

    if (record?.source === 'subtes') {
        return getSubteStationName(data) || record?.subtitle || 'Estacion de subte';
    }

    return data?.linea
        ? `Linea ${data.linea}`
        : data?.route_short_name
            ? `Linea ${data.route_short_name}`
            : 'Colectivo';
}

function renderFavoriteCard(record) {
    const favoriteData = record?.data || {};
    const title = record?.title || 'Favorito';
    const subtitle = record?.subtitle || 'Guardado en favoritos';
    const preferencesHTML = renderPreferences(record);

    const transportType = getFavoriteTransportType(record);
    const transportName = getFavoriteTransportName(record);

    return `
    <article class="status-item favorite-item" data-favorite-id="${escapeHTML(record.favoriteId)}">
      <button type="button" class="favorite-item-main" data-card-action="open-favorite">
        <p class="status-title">${escapeHTML(title)}</p>
        <p class="line-subtitle">${escapeHTML(transportType)} - ${escapeHTML(transportName)}</p>
        ${preferencesHTML}
      </button>
      <div class="favorite-item-actions">
        <button type="button" class="history-clear-icon favorite-remove-icon" data-card-action="remove-favorite" aria-label="Quitar favorito"><span class="trash-icon" aria-hidden="true"></span></button>
      </div>
    </article>
  `;
}

export function renderFavoritesView() {
    const favoritesSection = document.getElementById('view-favoritos');
    if (!favoritesSection) return;

    favoritesSection.innerHTML = `
    <div class="hero-card">
      <div class="hero-icon favorites-hero-icon" aria-hidden="true">&#9733;</div>
      <h2>Favoritos</h2>
      <p class="hero-text">Guarda tus lineas y paradas mas usadas para acceder rapido.</p>
      <button type="button" class="link-button back-button" data-favorites-action="go-home">← Volver</button>
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
