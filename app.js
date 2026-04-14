const BASE_URL = "https://datosabiertos-transporte-apis.buenosaires.gob.ar/colectivos";
const CLIENT_ID = "8251a8610a63446c9c090f6d04edc491";
const CLIENT_SECRET = "b754F8057Ad54DA3a81eD95261d4A7EB";

let loadButton;
let resultsContainer;
let errorContainer;
let statusContainer;

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    loadComponent("navMount", "./components/nav.html"),
    loadComponent("footerMount", "./components/footer.html")
  ]);

  bindElements();
  setupNavigation();

  if (loadButton) {
    loadButton.addEventListener("click", handleLoadLines);
  }
});

async function handleLoadLines() {
  setLoading(true);
  clearMessages();

  try {
    const data = await fetchVehicles();
    const lines = extractLines(data);
    renderLines(lines);

    if (statusContainer) {
      statusContainer.textContent = `Se encontraron ${lines.length} lineas unicas.`;
    }
  } catch (error) {
    renderLines([]);

    if (errorContainer) {
      errorContainer.textContent = error.message || "No fue posible cargar las lineas.";
    }
  } finally {
    setLoading(false);
  }
}

async function fetchVehicles() {
  const endpoints = [
    `${BASE_URL}/vehiclePositionsSimple?client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`,
    `${BASE_URL}/vehiclePositions?json=1&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status} al consultar la API.`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Fallaron ambos endpoints de la API.");
}

function extractLines(data) {
  const items = getVehicleItems(data);
  const uniqueLines = new Set();

  for (const item of items) {
    const lineName = normalizeLine(item);

    if (lineName) {
      uniqueLines.add(lineName);
    }
  }

  return Array.from(uniqueLines).sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
  );
}

function getVehicleItems(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.entity)) {
    return data.entity;
  }

  if (Array.isArray(data?.vehicles)) {
    return data.vehicles;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function normalizeLine(item) {
  const routeShortName =
    item?.route_short_name ??
    item?.trip?.route_short_name ??
    item?.vehicle?.trip?.route_short_name ??
    item?.trip_update?.trip?.route_short_name;

  if (isValidValue(routeShortName)) {
    return String(routeShortName).trim();
  }

  const routeId =
    item?._trip?._route_id ??
    item?.trip?._route_id ??
    item?.trip?.route_id ??
    item?.route_id ??
    item?.vehicle?.trip?.route_id ??
    item?.vehicle?.trip?._route_id ??
    item?.trip_update?.trip?.route_id;

  if (isValidValue(routeId)) {
    return String(routeId).trim();
  }

  return null;
}

function isValidValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function renderLines(lines) {
  if (!resultsContainer) {
    return;
  }

  resultsContainer.innerHTML = "";

  if (!lines.length) {
    resultsContainer.innerHTML = '<p class="empty">No se encontraron lineas validas en la respuesta.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const line of lines) {
    const card = document.createElement("article");
    card.className = "line-card";
    card.textContent = `Linea ${line}`;
    fragment.appendChild(card);
  }

  resultsContainer.appendChild(fragment);
}

function clearMessages() {
  if (errorContainer) {
    errorContainer.textContent = "";
  }

  if (statusContainer) {
    statusContainer.textContent = "";
  }
}

function setLoading(isLoading) {
  if (!loadButton) {
    return;
  }

  loadButton.disabled = isLoading;
  loadButton.textContent = isLoading ? "Cargando..." : "Cargar lineas";

  if (isLoading && statusContainer) {
    statusContainer.textContent = "Consultando API de transporte...";
  }
}

async function loadComponent(mountId, filePath) {
  const mountNode = document.getElementById(mountId);

  if (!mountNode) {
    return;
  }

  try {
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`No se pudo cargar ${filePath}.`);
    }

    mountNode.innerHTML = await response.text();
  } catch (error) {
    console.error(error);
  }
}

function bindElements() {
  loadButton = document.getElementById("loadButton");
  resultsContainer = document.getElementById("results");
  errorContainer = document.getElementById("error");
  statusContainer = document.getElementById("status");
}

function setupNavigation() {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("navMenu");

  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}
