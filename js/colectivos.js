// js/colectivos.js
const ROUTES_DATA_PATH = './data/colectivos/routes.json';
const ITINERARIOS_DATA_PATH = './data/colectivos/itinerarios.json';
const AGENCIAS_DATA_PATH = './data/colectivos/agencias.json';

let routesCache = null;
let itinerariosCache = null;
let agenciasCache = null;

/**
 * Carga las rutas y los itinerarios de colectivos si no están en memoria.
 */
export async function fetchColectivosData() {
    if (routesCache && itinerariosCache && agenciasCache) return { routes: routesCache, itinerarios: itinerariosCache, agencias: agenciasCache };
    try {
        const [routesRes, itinerariosRes, agenciasRes] = await Promise.all([
            fetch(ROUTES_DATA_PATH),
            fetch(ITINERARIOS_DATA_PATH),
            fetch(AGENCIAS_DATA_PATH)
        ]);
        if (!routesRes.ok || !itinerariosRes.ok || !agenciasRes.ok) throw new Error("No se pudieron cargar los datos estáticos de colectivos");
        
        routesCache = await routesRes.json();
        itinerariosCache = await itinerariosRes.json();
        agenciasCache = await agenciasRes.json();
        return { routes: routesCache, itinerarios: itinerariosCache, agencias: agenciasCache };
    } catch (error) {
        console.error("Error en colectivos.js:", error);
        return { routes: [], itinerarios: {}, agencias: { agencias: [] } };
    }
}

export function getColectivosRoutes() {
    return routesCache || [];
}

/**
 * Obtiene las paradas de una línea específica.
 */
export function getParadasByRoute(routeId) {
    return itinerariosCache ? itinerariosCache[routeId] : null;
}

export function getAgencyIdByRoute(routeId) {
    if (!routesCache || !agenciasCache || !agenciasCache.agencias) return null;
    const route = routesCache.find(r => String(r.route_id) === String(routeId));
    if (!route) return null;
    const agency = agenciasCache.agencias.find(a => a.lineas_asociadas.includes(String(route.route_short_name)));
    return agency ? agency.agency_id : null;
}