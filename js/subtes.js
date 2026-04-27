// js/subtes.js
const SUBTES_DATA_PATH = './data/subtes/subtes_full.json';

let subtesCache = null;

/**
 * Carga las rutas completas y los itinerarios de subtes.
 */
export async function fetchSubtesData() {
    if (subtesCache) return subtesCache;
    try {
        const response = await fetch(SUBTES_DATA_PATH);
        if (!response.ok) throw new Error("No se pudo cargar subtes_full.json");
        subtesCache = await response.json();
        return subtesCache;
    } catch (error) {
        console.error("Error en subtes.js:", error);
        return [];
    }
}

export function getSubtesRoutes() {
    return subtesCache || [];
}

export function getParadasBySubteRoute(routeId) {
    const route = (subtesCache || []).find(r => r.route_id === routeId);
    return route ? route.paradas : [];
}
