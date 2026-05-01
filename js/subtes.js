import { getSubtesActivos } from './api.js';

function getLineaColor(linea) {
    const colors = { 'A': '00a4e4', 'B': 'e30613', 'C': '0065a4', 'D': '008069', 'E': '6c2b6d', 'H': 'f3c300' };
    return colors[linea?.toUpperCase()] || '999999';
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
            
            return `
                <button type="button" class="status-item" data-active-subte-id="${subte.id}" data-active-subte-line="${subte.linea}" data-active-subte-color="${color}" data-active-subte-dest="${subte.destino}" style="border-top: none; border-right: none; border-bottom: none; border-left: 4px solid #${color}; width: 100%; text-align: left; cursor: pointer; font-family: inherit; background: transparent;">
                    <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <p class="status-title">Línea ${subte.linea} a ${subte.destino}</p>
                            <span class="status-chip" style="background-color: #${color}; color: white; border: none;">${tiempoText}</span>
                        </div>
                        <p class="line-meta">${estado}</p>
                    </div>
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
