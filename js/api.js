const BASE_URL = "https://datosabiertos-transporte-apis.buenosaires.gob.ar/colectivos";
const CLIENT_ID = "8251a8610a63446c9c090f6d04edc491";
const CLIENT_SECRET = "b754F8057Ad54DA3a81eD95261d4A7EB";

function buildUrl(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('client_secret', CLIENT_SECRET);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

export async function fetchTransportData(endpoint, params = {}) {
  const url = buildUrl(endpoint, params);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

export async function getVehiclePositions() {
  return await fetchTransportData('vehiclePositionsSimple');
}

export async function getArribosPorLinea(lineaId) {
  return await fetchTransportData(`lineas/${lineaId}/arribos`);
}
