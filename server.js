const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 

const app = express();
const PORT = process.env.PORT || 3000; // Usa el puerto de la nube, o el 3000 en tu PC local

app.use(cors()); // Habilita peticiones desde tu index.html

app.get('/api/subtes', async (req, res) => {
    const CLIENT_ID = '8251a8610a63446c9c090f6d04edc491';
    const CLIENT_SECRET = 'b754F8057Ad54DA3a81eD95261d4A7EB';
    const API_URL = `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`La API de BA respondió con error ${response.status}: ${errorText}`);
        }

        // Leemos directamente el texto de la respuesta
        const textoRespuesta = await response.text();

        // Verificamos si la API envió un HTML de error inesperado (ej. mantenimiento)
        if (textoRespuesta.trim().startsWith('<')) {
            throw new Error('La API devolvió una página HTML en lugar de datos del subte.');
        }

        // Convertimos el texto a JSON
        const feed = JSON.parse(textoRespuesta);
        
        const subtesActivos = [];
        
        // Usamos el timestamp que nos da la API para evitar desfasajes con la hora de tu PC
        const currentTime = feed.Header && feed.Header.timestamp ? feed.Header.timestamp : Math.floor(Date.now() / 1000);
        const entidades = feed.Entity || [];

        entidades.forEach((entity) => {
            // Verificamos que exista la información de la Línea y sus Estaciones
            if (entity.Linea && entity.Linea.Estaciones && entity.Linea.Estaciones.length > 0) {
                const linea = entity.Linea;
                // Extraemos el nombre limpiando la palabra "Linea" (ej. "LineaA" pasa a ser "A")
                const routeId = (linea.Route_Id || '').replace(/Line|Linea/g, '').trim();
                
                const estaciones = linea.Estaciones;
                // El destino final del tren es la última estación de su recorrido
                const destinoFinal = estaciones[estaciones.length - 1].stop_name;

                // Buscamos la próxima estación a la que está por arribar
                const proximaEstacion = estaciones.find(est => est.arrival && est.arrival.time >= currentTime) || estaciones[0];
                
                if (proximaEstacion && proximaEstacion.arrival && proximaEstacion.arrival.time) {
                    const arrivalTime = proximaEstacion.arrival.time;
                    const minutesToArrival = Math.round((arrivalTime - currentTime) / 60);

                    if (minutesToArrival >= 0) {
                        const delaySeconds = proximaEstacion.arrival.delay || 0;
                        
                        // Verificamos si el tren está actualmente detenido en alguna estación (el tiempo actual está entre su llegada y su salida)
                        const estacionActual = estaciones.find(est => est.arrival && est.departure && currentTime >= est.arrival.time && currentTime <= est.departure.time);

                        subtesActivos.push({
                            id: entity.ID,
                            linea: routeId,
                            destino: destinoFinal, // ¡Aquí ya se mostrará "San Pedrito", "Plaza de Mayo", etc!
                            tiempoLlegada: minutesToArrival,
                            demora: delaySeconds,
                            proximaParada: proximaEstacion.stop_name,
                            detenidoEn: estacionActual ? estacionActual.stop_name : null
                        });
                    }
                }
            }
        });

        // Ordenamos por tiempo de llegada (los más próximos primero)
        subtesActivos.sort((a, b) => a.tiempoLlegada - b.tiempoLlegada);

        res.json(subtesActivos);
    } catch (error) {
        console.error('La API oficial falló. Devolviendo datos simulados. Detalle:', error.message);
        
        // Fallback: Datos simulados para no interrumpir el desarrollo mientras la API está caída
        const subtesSimulados = [
            { id: 'LineaA_A11', linea: 'A', destino: 'San Pedrito (Simulado)', tiempoLlegada: 2, demora: 120, proximaParada: 'Acoyte', detenidoEn: null },
            { id: 'LineaB_B11', linea: 'B', destino: 'Juan Manuel de Rosas (Simulado)', tiempoLlegada: 0, demora: 0, proximaParada: 'Pasteur', detenidoEn: 'Pasteur' }, // Tren detenido
            { id: 'sim_c', linea: 'C', destino: 'Constitución (Simulado)', tiempoLlegada: 1, demora: 60, proximaParada: 'Independencia', detenidoEn: null },
            { id: 'LineaD_D11', linea: 'D', destino: 'Congreso de Tucumán (Simulado)', tiempoLlegada: 0, demora: 0, proximaParada: 'Olleros', detenidoEn: 'Olleros' }, // Tren detenido
            { id: 'LineaE_E11', linea: 'E', destino: 'Plaza de los Virreyes (Simulado)', tiempoLlegada: 3, demora: 240, proximaParada: 'Boedo', detenidoEn: null },
            { id: 'sim_h', linea: 'H', destino: 'Hospitales (Simulado)', tiempoLlegada: 7, demora: 0, proximaParada: 'Parque Patricios', detenidoEn: null }
        ];
        res.json(subtesSimulados);
    }
});

// NUEVO ENDPOINT: Obtener el recorrido completo de una formación específica por su ID
app.get('/api/subtes/recorrido/:id', async (req, res) => {
    const idFormacion = req.params.id; // Extraemos el ID de la URL (ej. "LineaA_A11")
    const CLIENT_ID = '8251a8610a63446c9c090f6d04edc491';
    const CLIENT_SECRET = 'b754F8057Ad54DA3a81eD95261d4A7EB';
    const API_URL = `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`La API de BA respondió con error ${response.status}: ${errorText}`);
        }

        const textoRespuesta = await response.text();
        if (textoRespuesta.trim().startsWith('<')) {
            throw new Error('La API devolvió una página HTML en lugar de datos.');
        }

        const feed = JSON.parse(textoRespuesta);
        const entidades = feed.Entity || [];

        // Buscamos el tren específico cuyo ID coincide con el que enviamos
        const trenEncontrado = entidades.find((entity) => entity.ID === idFormacion);

        if (trenEncontrado) {
            // Si lo encuentra, devuelve todo el objeto (con las paradas, demoras, etc.)
            res.json(trenEncontrado);
        } else {
            // Si el tren ya terminó su recorrido o el ID no existe, enviamos un error 404
            res.status(404).json({ error: 'Formación no encontrada, finalizó su recorrido o no está en servicio.' });
        }

    } catch (error) {
        console.error(`Error al buscar el recorrido del tren ${idFormacion}:`, error.message);
        // Si la API está caída, no tenemos forma de saber el recorrido real, enviamos error
        res.status(500).json({ error: 'Servicio no disponible temporalmente.', detalle: error.message });
    }
});

// NUEVO ENDPOINT: Proxy completo para el feed de subtes (usado para el detalle de la estación)
app.get('/api/subtes/forecast', async (req, res) => {
    const CLIENT_ID = '8251a8610a63446c9c090f6d04edc491';
    const CLIENT_SECRET = 'b754F8057Ad54DA3a81eD95261d4A7EB';
    const API_URL = `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;

    try {
        const response = await fetch(API_URL);
        const textoRespuesta = await response.text();
        if (textoRespuesta.trim().startsWith('<')) throw new Error('API devolvió HTML');
        res.json(JSON.parse(textoRespuesta));
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener el feed completo de subtes' });
    }
});

// NUEVO ENDPOINT: Proxy para las alertas de subtes
app.get('/api/subtes/alertas', async (req, res) => {
    const CLIENT_ID = '8251a8610a63446c9c090f6d04edc491';
    const CLIENT_SECRET = 'b754F8057Ad54DA3a81eD95261d4A7EB';
    const API_URL = `https://apitransporte.buenosaires.gob.ar/subtes/serviceAlerts?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&json=1`;

    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener las alertas' });
    }
});

// Proxy para las alertas de colectivos
app.get('/api/colectivos/alertas', async (req, res) => {
    const CLIENT_ID = '8251a8610a63446c9c090f6d04edc491';
    const CLIENT_SECRET = 'b754F8057Ad54DA3a81eD95261d4A7EB';
    const API_URL = `https://apitransporte.buenosaires.gob.ar/colectivos/serviceAlerts?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&json=1`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`La API de colectivos respondio con error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error al obtener alertas de colectivos:', error.message);
        res.status(500).json({ error: 'No se pudieron obtener las alertas de colectivos' });
    }
});

// NUEVO ENDPOINT: Obtener posiciones de los colectivos filtrados por route_id
app.get('/api/colectivos', async (req, res) => {
    const CLIENT_ID = '8251a8610a63446c9c090f6d04edc491';
    const CLIENT_SECRET = 'b754F8057Ad54DA3a81eD95261d4A7EB';
    const API_URL = `https://apitransporte.buenosaires.gob.ar/colectivos/vehiclePositionsSimple?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error al conectar con la API de colectivos');

        const datos = await response.json();
        const todosLosColectivos = [];
        
        // Con el formato confirmado, iteramos directamente sobre el array de respuesta
        const listaVehiculos = Array.isArray(datos) ? datos : [];

        // --- DEBUG: Verificamos qué está llegando de la API ---
        console.log(`📥 La API respondió con un total de ${listaVehiculos.length} colectivos circulando.`);
        if (listaVehiculos.length > 0) {
            console.log("🔍 Ejemplo del primer colectivo recibido:", listaVehiculos[0]);
        }

        listaVehiculos.forEach(vehiculo => {
            const routeId = String(vehiculo.route_id);

            todosLosColectivos.push({
                id_vehiculo: vehiculo.id,
                ramal_id: routeId,
                linea: vehiculo.route_short_name,
                ramal_destino: vehiculo.trip_headsign,
                latitud: vehiculo.latitude,
                longitud: vehiculo.longitude,
                velocidad: vehiculo.speed
            });
        });

        res.json({ total_encontrados: todosLosColectivos.length, colectivos: todosLosColectivos });
    } catch (error) {
        console.error('Error procesando colectivos:', error.message);
        res.status(500).json({ error: 'No se pudieron obtener los datos de colectivos' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
