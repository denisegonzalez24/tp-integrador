<<<<<<< HEAD
// Función para cargar todos los JSONs estáticos necesarios
export async function fetchStaticSubteData() {
  try {
    const [routesRes, tripsRes, stopsRes, stopTimesRes] = await Promise.all([
      fetch('./data/subtes/routes.json'),
      fetch('./data/subtes/trips.json'),
      fetch('./data/subtes/stops.json'),
      fetch('./data/subtes/stop_times.json')
    ]);

    return {
      routes: await routesRes.json(),
      trips: await tripsRes.json(),
      stops: await stopsRes.json(),
      stopTimes: await stopTimesRes.json()
    };
  } catch (error) {
    console.error('Error cargando los datos estáticos de subtes:', error);
    return null;
  }
}

// Lógica principal para enriquecer el JSON en tiempo real con datos estáticos
export function enrichSubteRealTimeData(mockData, staticData) {
  if (!staticData || !mockData) return mockData;

  const entities = mockData.Entity || mockData.entity;
  if (!entities) return mockData;

  const { trips, stops, routes } = staticData;

  // Hacemos una copia profunda (deep clone) para no mutar el mock original accidentalmente
  const enrichedData = JSON.parse(JSON.stringify(mockData));
  const enrichedEntities = enrichedData.Entity || enrichedData.entity;

  enrichedEntities.forEach(entity => {
    // Formato Mock
    if (entity.Linea) {
      const linea = entity.Linea;
      const tripId = linea.Trip_Id;
      const routeId = linea.Route_Id;

      const routeInfo = routes?.find(r => r.id === routeId);
      if (routeInfo) linea.color = routeInfo.color;

      if (Array.isArray(linea.Estaciones)) {
        linea.Estaciones.forEach(estacion => {
          const baseStopId = estacion.stop_id.replace(/[NSns]$/, '');
          const stopInfo = stops.find(s => String(s.id) === String(baseStopId));
          if (stopInfo) estacion.stop_name = stopInfo.name;
        });
      }

      const tripInfo = trips.find(t => tripId.includes(t.trip_id) || tripId.startsWith(t.trip_id));
      if (tripInfo) {
        linea.headsign = `Hacia ${tripInfo.headsign}`;
      } else if (Array.isArray(linea.Estaciones) && linea.Estaciones.length > 0) {
        const lastStop = linea.Estaciones[linea.Estaciones.length - 1];
        linea.headsign = `Hacia ${lastStop.stop_name || lastStop.stop_id}`;
      } else {
        linea.headsign = 'Destino desconocido';
      }
    }

    // Formato API (GTFS-RT estándar)
    if (entity.trip_update) {
      const tripUpdate = entity.trip_update;
      const trip = tripUpdate.trip || {};
      
      if (trip.route_id) {
        const routeInfo = routes?.find(r => r.id === trip.route_id);
        if (routeInfo) trip.color = routeInfo.color;
      }

      if (Array.isArray(tripUpdate.stop_time_update)) {
        tripUpdate.stop_time_update.forEach(estacion => {
          if (estacion.stop_id) {
            const baseStopId = estacion.stop_id.replace(/[NSns]$/, '');
            const stopInfo = stops.find(s => String(s.id) === String(baseStopId));
            if (stopInfo) estacion.stop_name = stopInfo.name;
          }
        });
      }

      if (trip.trip_id) {
        const tripInfo = trips.find(t => trip.trip_id.includes(t.trip_id) || trip.trip_id.startsWith(t.trip_id));
        if (tripInfo) {
          trip.trip_headsign = `Hacia ${tripInfo.headsign}`;
        } else if (Array.isArray(tripUpdate.stop_time_update) && tripUpdate.stop_time_update.length > 0) {
          const lastStop = tripUpdate.stop_time_update[tripUpdate.stop_time_update.length - 1];
          trip.trip_headsign = `Hacia ${lastStop.stop_name || lastStop.stop_id}`;
        } else {
          trip.trip_headsign = 'Destino desconocido';
        }
      }
    }
  });

  return enrichedData;
}

// Función para generar una lista HTML de paradas de un viaje específico
export function generateTripStopListHTML(tripId, staticData, realTimeStops = []) {
  if (!staticData || !staticData.stopTimes || !staticData.stops) return '';

  const { stopTimes, stops } = staticData;
  
  // 1. Extraemos la primera letra del tripId (Línea) y buscamos el viaje 01 de referencia
  // Ej: de 'LineaB_B13' o 'B13_S' extrae 'B', y busca 'B01'
  const match = tripId.match(/(?:Linea)?([A-H])/i);
  const lineLetter = match ? match[1].toUpperCase() : 'A';
  const referenceTripId = `${lineLetter}01`;

  let trip = stopTimes.find(t => t.trip_id === referenceTripId || t.trip_id.includes(referenceTripId));

  if (!trip) {
    trip = stopTimes.find(t => t.trip_id.startsWith(lineLetter));
  }

  if (!trip || !trip.stops) {
    return '<p class="line-meta">No se encontraron paradas estáticas para este viaje.</p>';
  }

  const nextRealTimeStop = realTimeStops.length > 0 ? realTimeStops[0] : null;
  const nextStopIdBase = nextRealTimeStop ? (nextRealTimeStop.stop_id || '').replace(/[NSns]$/, '') : null;
  const nextStopIndex = trip.stops.findIndex(st => st.stop_id.replace(/[NSns]$/, '') === nextStopIdBase);

  // 2. Mapeamos las paradas cruzando con stops.json y generamos los <li>
  const listItemsHTML = trip.stops.map((stopTime, index) => {
    const baseStopId = stopTime.stop_id.replace(/[NSns]$/, '');
    const stopInfo = stops.find(s => String(s.id) === String(baseStopId));
    const stopName = stopInfo ? stopInfo.name : stopTime.stop_id;

    const isCurrent = index === nextStopIndex;
    const isPassed = nextStopIndex !== -1 && index < nextStopIndex;
    
    const icon = isCurrent ? ' 🚇 <strong style="color: #0056b3;">(Próxima)</strong>' : '';
    const rtStop = realTimeStops.find(rts => (rts.stop_id || '').replace(/[NSns]$/, '') === baseStopId);
    
    let timeHTML = `Programado: ${stopTime.arrival}`;
    let itemStyle = 'padding-left: 11px; margin-bottom: 8px; border-left: 3px solid transparent;';
    
    if (isCurrent) {
        itemStyle = 'background: #f0f8ff; padding: 8px; border-radius: 6px; border-left: 3px solid #0056b3; margin-bottom: 8px;';
    } else if (isPassed) {
        itemStyle = 'padding-left: 11px; margin-bottom: 8px; opacity: 0.5; border-left: 3px solid transparent;';
        timeHTML = `Completada (${stopTime.arrival})`;
    }

    if (rtStop && rtStop.arrival?.time) {
        const rtTime = new Date(rtStop.arrival.time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const delayMinutes = Math.round((rtStop.arrival.delay || 0) / 60);
        const delayStr = delayMinutes > 0 ? ` <strong class="text-danger">(+${delayMinutes} min)</strong>` : '';
        timeHTML = `Estimado: <strong>${rtTime}</strong>${delayStr}`;
    }

    return `
      <li style="${itemStyle}">
        <p style="margin: 0; font-size: 1rem; font-weight: 500; color: ${isPassed ? '#888' : 'inherit'};">${stopName}${icon}</p>
        <p style="margin: 0; font-size: 0.85rem; color: #555;">${timeHTML}</p>
      </li>
    `;
  }).join('');

  return `<ul class="stop-times-list" style="list-style: none; padding: 0; margin: 0;">${listItemsHTML}</ul>`;
}
=======
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
>>>>>>> upstream/prueba-trenes
