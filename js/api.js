const API_HOST = "https://datosabiertos-transporte-apis.buenosaires.gob.ar";
const SUBTES_API_HOST = "https://apitransporte.buenosaires.gob.ar";
const CLIENT_ID = "8251a8610a63446c9c090f6d04edc491";
const CLIENT_SECRET = "b754F8057Ad54DA3a81eD95261d4A7EB";
const TRENES_API_HOST = "https://ariedro.dev/api-trenes";

// ✅ Tu enlace público de ngrok (Actualízalo aquí cada vez que reinicies)
export const NGROK_HOST = "https://ad63-2802-8010-653a-d800-464a-ca8-758d-1da.ngrok-free.app";

function buildUrl(transportType, endpoint, params = {}) {
  const host = transportType === 'subtes' ? SUBTES_API_HOST : API_HOST;
  const url = new URL(`${host}/${transportType}/${endpoint}`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('client_secret', CLIENT_SECRET);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  // Usamos un proxy CORS público para evitar el bloqueo del navegador al consultar subtes
  if (transportType === 'subtes') {
    return `https://corsproxy.io/?${encodeURIComponent(url.toString())}`;
  }

  return url.toString();
}

export async function fetchTransportData(transportType, endpoint, params = {}) {
  const url = buildUrl(transportType, endpoint, params);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`[API] Respuesta de ${transportType}/${endpoint}:`, data);
  return data;
}

async function fetchTransportDataWithRetry(transportType, endpoint, params = {}, retryOptions = {}) {
  const {
    retries = 2,
    delayMs = 500,
  } = retryOptions;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchTransportData(transportType, endpoint, params);
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function getVehiclePositions() {
  const data = await fetchMyBackend('colectivos');
  return data.colectivos || [];
}

export async function getVehiclePositionsDetailed(params = {}) {
  return await fetchTransportData('colectivos', 'vehiclePositions', { json: 1, ...params });
}

export async function getArribosPorLinea(lineaId) {
  return await fetchTransportData('colectivos', `lineas/${lineaId}/arribos`);
}

// Nueva función para obtener el tiempo real de una línea de colectivo particular
export async function getColectivosRealTime(routeId, agencyId) {
  return await getVehiclePositionsDetailed({ route_id: routeId, agency_id: agencyId });
}

// Nueva función para Subtes (Devuelve JSON con próximos arribos)
export async function getSubtesForecast() {
  return await fetchMyBackend('subtes/forecast');
}

// Nueva función para obtener las formaciones activas y resumidas desde tu backend
export async function getSubtesActivos() {
  return await fetchMyBackend('subtes');
}

// Nueva función para obtener el recorrido de un subte activo
export async function getSubteRecorrido(id) {
  return await fetchMyBackend(`subtes/recorrido/${id}`);
}

export async function getSubtesServiceAlerts(params = {}) {
  try {
    return await fetchMyBackend('subtes/alertas');
  } catch (error) {
    console.warn('Fallo el proxy de alertas de subtes. Probando endpoint oficial una vez:', error);
    return await fetchTransportData('subtes', 'serviceAlerts', { json: 1, ...params });
  }
}

export async function getColectivosServiceAlerts(params = {}) {
  try {
    return await fetchMyBackend('colectivos/alertas');
  } catch (error) {
    console.warn('Fallo el proxy de alertas de colectivos. Probando endpoint oficial una vez:', error);
    return await fetchTransportData('colectivos', 'serviceAlerts', { json: 1, ...params });
  }
}

function buildTrenesUrl(path, params = {}) {
  const url = new URL(`${TRENES_API_HOST}/${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function fetchTrenesData(path, params = {}) {
  const url = buildTrenesUrl(path, params);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

export async function getTrainStationsByName(nombre) {
  return await fetchTrenesData('infraestructura/estaciones', { nombre });
}

export async function getTrainStationsByRamal(idRamal) {
  return await fetchTrenesData('infraestructura/estaciones', { idRamal });
}

export async function getTrainArrivalsByStation(idEstacion, cantidad = 5, sentido = null) {
  return await fetchTrenesData(`arribos/estacion/${idEstacion}`, { cantidad, sentido });
}

export async function getTrainRamales() {
  return await fetchTrenesData('infraestructura/ramales', {});
}

// ✅ Nueva función base para consultar a tu propio servidor
export async function getTrainGerencias() {
  return await fetchTrenesData('infraestructura/gerencias', {});
}

export async function fetchMyBackend(endpoint) {
  const response = await fetch(`${NGROK_HOST}/api/${endpoint}`);
  if (!response.ok) {
    throw new Error(`Error en mi servidor local: ${response.status}`);
  }
  return await response.json();
}

// Nueva función para Subtes RT: Convierte el feed a JSON manejable
export async function getSubtesRealTime(params = {}) {
  return await fetchMyBackend('subtes/forecast');
}
