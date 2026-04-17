const API_HOST = "https://datosabiertos-transporte-apis.buenosaires.gob.ar";
const CLIENT_ID = "8251a8610a63446c9c090f6d04edc491";
const CLIENT_SECRET = "b754F8057Ad54DA3a81eD95261d4A7EB";

function buildUrl(transportType, endpoint, params = {}) {
  const url = new URL(`${API_HOST}/${transportType}/${endpoint}`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('client_secret', CLIENT_SECRET);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

export async function fetchTransportData(transportType, endpoint, params = {}) {
  const url = buildUrl(transportType, endpoint, params);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

export async function getVehiclePositions() {
  return await fetchTransportData('colectivos', 'vehiclePositionsSimple');
}

export async function getArribosPorLinea(lineaId) {
  return await fetchTransportData('colectivos', `lineas/${lineaId}/arribos`);
}

// Nueva función para Subtes (Devuelve JSON con próximos arribos)
export async function getSubtesForecast() {
  return await fetchTransportData('subtes', 'forecastGTFS');
}
