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
  if (!staticData || !mockData || !mockData.Entity) return mockData;

  const { trips, stops } = staticData;

  // Hacemos una copia profunda (deep clone) para no mutar el mock original accidentalmente
  const enrichedData = JSON.parse(JSON.stringify(mockData));

  enrichedData.Entity.forEach(entity => {
    const linea = entity.Linea || {};
    const tripId = linea.Trip_Id;

    // 1. Encontrar la cabecera / dirección en trips.json
    const tripInfo = trips.find(t => t.trip_id === tripId);
    linea.headsign = tripInfo ? tripInfo.headsign : 'Destino desconocido';

    // 2. Traducir stop_id a nombres legibles
    if (Array.isArray(linea.Estaciones)) {
      linea.Estaciones.forEach(estacion => {
        const baseStopId = estacion.stop_id.replace(/[NSns]$/, ''); // Removemos 'N' o 'S'
        const stopInfo = stops.find(s => String(s.id) === String(baseStopId));
        if (stopInfo) {
          estacion.stop_name = stopInfo.name;
        }
      });
    }
  });

  return enrichedData;
}

// Función para generar una lista HTML de paradas de un viaje específico
export function generateTripStopListHTML(tripId, staticData) {
  if (!staticData || !staticData.stopTimes || !staticData.stops) return '';

  const { stopTimes, stops } = staticData;
  
  // 1. Buscamos el viaje específico por su trip_id (ej: "A11")
  const trip = stopTimes.find(t => t.trip_id === tripId);

  if (!trip || !trip.stops) {
    return '<p>No se encontraron paradas para este viaje.</p>';
  }

  // 2. Mapeamos las paradas cruzando con stops.json y generamos los <li>
  const listItemsHTML = trip.stops.map(stopTime => {
    const baseStopId = stopTime.stop_id.replace(/[NSns]$/, ''); // Quitamos la letra de sentido
    const stopInfo = stops.find(s => String(s.id) === String(baseStopId));
    const stopName = stopInfo ? stopInfo.name : stopTime.stop_id;

    return `<li><strong>${stopName}</strong> - Llegada: ${stopTime.arrival}</li>`;
  }).join('');

  return `<ul class="stop-times-list">${listItemsHTML}</ul>`;
}