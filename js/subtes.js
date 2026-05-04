import { getSubtesActivos } from './api.js';

function getLineaColor(linea) {
    const colors = { 'A': '00a4e4', 'B': 'e30613', 'C': '0065a4', 'D': '008069', 'E': '6c2b6d', 'H': 'f3c300' };
    return colors[linea?.toUpperCase()] || '999999';
}

function normalizeSubteLineLabel(value = '') {
    const cleanValue = String(value || '')
        .replace(/linea/ig, '')
        .replace(/_/g, ' ')
        .trim();
    const match = cleanValue.match(/[A-H]/i);
    return match ? match[0].toUpperCase() : cleanValue.toUpperCase();
}

function formatSubteDestination(value = '') {
    const words = String(value || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const lowerWords = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'a', 'al']);

    return words
        .map((word, index) => {
            if (index > 0 && lowerWords.has(word)) {
                return word;
            }

            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

export async function loadAndRenderSubtesActivos() {
    const container = document.getElementById('subtesActivosList');
    if (!container) return;

    try {
        const activos = await getSubtesActivos();
        if (!activos || activos.length === 0) {
            container.innerHTML = '<p class="empty">No hay formaciones reportando posición ahora.</p>';
            return;
        }

        const topActivos = activos.slice(0, 6); // Mostramos los primeros 6 para no saturar la pantalla

        container.innerHTML = topActivos.map(subte => {
            const color = getLineaColor(subte.linea);
            const estado = subte.detenidoEn ? `Detenido en ${subte.detenidoEn}` : `Próx. parada: ${subte.proximaParada}`;
            const tiempoText = subte.tiempoLlegada === 0 ? 'Llegando' : `En ${subte.tiempoLlegada} min`;
            const lineLabel = normalizeSubteLineLabel(subte.linea);
            const destinationLabel = formatSubteDestination(subte.destino);

            return `
                <button type="button" class="status-item subte-active-card" data-active-subte-id="${subte.id}" data-active-subte-line="${subte.linea}" data-active-subte-color="${color}" data-active-subte-dest="${subte.destino}" style="--subte-line-color: #${color};">
                    <div class="subte-active-card-main">
                        <p class="status-title">Linea ${lineLabel} a ${destinationLabel}</p>
                        <p class="line-meta">${estado}</p>
                    </div>
                    <span class="status-chip subte-active-chip">${tiempoText}</span>
                </button>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando subtes activos:', error);
        container.innerHTML = '<p class="empty">No se pudo cargar la información en vivo.</p>';
    }
}

export async function openSubtesView(navigateTo) {
    const subtesActivosList = document.getElementById('subtesActivosList');
    if (subtesActivosList) {
        subtesActivosList.innerHTML = '<p class="empty">Buscando formaciones activas...</p>';
    }

    navigateTo('subtes');
    loadAndRenderSubtesActivos();
}

export function bindSubtesControls({ navigateTo }) {
    const subtesBackBtn = document.getElementById('subtesBackBtn');
    subtesBackBtn?.addEventListener('click', () => navigateTo('home'));
}
