import { fetchForecastData, fetchReverseGeocodedLocation } from "./client-api.js?v=20260505-best-night";
import {
  buildForecastShareUrl,
  forecastViewForAction,
  forecastViewFromUrl,
  initialForecastLocation,
  locationFromMapPoint,
  mapPointFromLocation,
  moonLitPath,
  nextExpandedForecastDay,
  saveDefaultLocation,
  visibleForecastDetailRows,
} from "./forecast-controls.js?v=20260505-best-night";
import { FORECAST_MODELS, forecastModelLabel, normalizeForecastModel } from "./open-meteo.js?v=20260505-best-night";

const defaultLocation = {
  locationName: "Map start",
  lat: "48.21",
  lon: "16.97",
};

let forecastData = null;
let expandedDayIndex = 0;
let currentLocation = null;
let currentView = "current";
let currentModel = "best_match";
let highlightedBestNightIndex = null;
let saveButtonResetTimer = null;
let mapPicker = null;
let mapMarker = null;
let selectedMapLocation = null;

const mapTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const mapTileOptions = {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const cloudColors = [
  "#558cc8",
  "#5e92cb",
  "#6697cd",
  "#6e9dd0",
  "#77a3d3",
  "#80a9d6",
  "#88aed8",
  "#90b4db",
  "#99bade",
  "#a2c0e1",
  "#aac5e3",
  "#b2cbe6",
  "#bbd1e9",
  "#c4d7ec",
  "#ccdcee",
  "#d4e2f1",
  "#dde8f4",
  "#e6eef7",
  "#eef3f9",
  "#f6f9fc",
  "#ffffff",
];

function cloudColor(value) {
  if (value === "") return "#ffffff";
  const clearPercent = 100 - Number(value);
  const bucket = Math.max(0, Math.min(20, Math.round(clearPercent / 5)));
  return cloudColors[bucket];
}

function cellClass(row, index) {
  if (row.type === "cloud") return "detail-cell cloud-cell";
  if (row.type === "none") return "detail-cell none";
  if (row.type === "wind") return `detail-cell wind ${row.classes[index]}`;
  return `detail-cell ${row.classes[index]}`;
}

function cellStyle(row, index) {
  if (row.type !== "cloud") return "";
  return `background:${cloudColor(row.values[index])}`;
}

function renderHours(day) {
  return forecastData.hours
    .map((hour, index) => {
      const current = currentColumnClass(day, index);
      const ariaCurrent = current ? ' aria-current="time"' : "";
      return `<span class="hour-cell ${day.hours[index] || "bad"}${current}"${ariaCurrent}>${hour}</span>`;
    })
    .join("");
}

function renderDetailRows(day) {
  return visibleForecastDetailRows(day.detailRows)
    .map((row) => {
      const tall = row.type === "wind" ? " tall" : "";
      const values = row.values
        .map(
          (value, index) =>
            `<span class="${cellClass(row, index)}${currentColumnClass(day, index)}" style="${cellStyle(row, index)}">${value}</span>`,
        )
        .join("");

      return `
        <div class="detail-row">
          <span class="detail-label">${row.label}</span>
          <div class="detail-cells${tall}">${values}</div>
        </div>
      `;
    })
    .join("");
}

function currentColumnClass(day, index) {
  return day.currentHourIndex === index ? " current-column" : "";
}

function renderDaylight(day) {
  const lightSlots = day.lightSlots || Array.from({ length: forecastData.hours.length }, () => "night");
  return lightSlots
    .map((slot, index) => `<span class="light-slot ${slot}${currentColumnClass(day, index)}"></span>`)
    .join("");
}

function renderMoonDisc(moon, index) {
  const gradientId = `moon-light-${index}`;
  const litPath = moonLitPath(moon);
  const litShape =
    moon.illumination >= 99
      ? `<circle cx="32" cy="32" r="31.5" fill="url(#${gradientId})"></circle>`
      : litPath
        ? `<path d="${litPath}" fill="url(#${gradientId})"></path>`
        : "";

  return `
    <svg class="moon-disc" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${gradientId}" cx="34%" cy="32%" r="74%">
          <stop offset="0%" stop-color="#ffffff"></stop>
          <stop offset="58%" stop-color="#eef1f1"></stop>
          <stop offset="100%" stop-color="#cfd7d9"></stop>
        </radialGradient>
      </defs>
      <circle class="moon-shadow-fill" cx="32" cy="32" r="31.5"></circle>
      ${litShape}
      <circle class="moon-rim" cx="32" cy="32" r="31.5"></circle>
    </svg>
  `;
}

function renderAstroSummary(astro, highlighted) {
  if (!astro) return "";
  const label = highlighted ? "Best night" : "Astro";
  return `
    <span class="astro-score astro-score--${astro.grade}">
      <span class="astro-score-label">${label}</span>
      <strong>${astro.score}</strong>
      <span>${astro.bestWindow}</span>
      <span>${astro.averageCloud}% clouds</span>
    </span>
  `;
}

function renderForecast(nextExpandedIndex = expandedDayIndex) {
  if (!forecastData) return;
  expandedDayIndex =
    nextExpandedIndex < 0 ? -1 : Math.max(0, Math.min(nextExpandedIndex, forecastData.days.length - 1));
  const target = document.querySelector("#forecast");
  target.innerHTML = forecastData.days
    .map((day, index) => {
      const expanded = index === expandedDayIndex;
      const bestNight = index === highlightedBestNightIndex;
      return `
        <article class="forecast-day ${expanded ? "expanded" : "compact"}${bestNight ? " best-night" : ""}" data-day-index="${index}">
          <button class="day-date" type="button" aria-expanded="${expanded}">
            <span class="day-name">${day.name}</span>
            <span class="day-number">${day.date}</span>
            ${bestNight ? '<span class="best-night-pill">Best</span>' : ""}
          </button>
          <div class="moon-panel">
            ${renderMoonDisc(day.moon, index)}
            <span>
              <span class="moon-phase">${day.moon.phase}</span>
              <span class="moon-percent">${day.moon.illumination}%</span>
              <span class="moon-rise">sun ${day.sun.rise} &nbsp; set ${day.sun.set}</span>
              ${renderAstroSummary(day.astro, bestNight)}
            </span>
          </div>
          <div class="hour-block">
            <div class="hour-grid">${renderHours(day)}</div>
            <div class="daylight" style="background:${day.daylightGradient}" title="Sunrise ${day.sun.rise}, sunset ${day.sun.set}, daylight ${day.sun.daylightHours}h">${renderDaylight(day)}</div>
          </div>
          ${expanded ? `<div class="detail">${renderDetailRows(day)}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

function updateForecastMeta() {
  const meta = forecastData.meta;
  const generated = new Date(meta.generatedAt).toLocaleString("sk-SK", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  setForecastTitle(`Forecast for ${meta.locationName} (${meta.requested.latitude},${meta.requested.longitude})`);
  document.querySelector("#forecast-meta").textContent =
    `Generated: ${generated}. Forecast: ${meta.forecastFrom} to ${meta.forecastTo}. Timezone: ${meta.timezone}.`;
  setStatus("Powered by Open-Meteo Weather API");
}

function setForecastTitle(title, options = {}) {
  const target = document.querySelector("#forecast-title");
  target.textContent = title;
  target.classList.toggle("loading-state", Boolean(options.loading));
}

function showNoLocationSelected() {
  setForecastTitle("No location selected");
  document.querySelector("#forecast-meta").textContent = "Enter coordinates or select a point on the map.";
  setStatus("No forecast loaded");
}

async function loadForecast({ lat, lon, locationName }, options = {}) {
  const view = options.view || currentView;
  const model = normalizeForecastModel(options.model || currentModel);
  setStatus(`Loading ${forecastViewLabel(view)} forecast with ${forecastModelLabel(model)}...`);
  document.querySelector("#forecast").setAttribute("aria-busy", "true");

  const [forecast, reverseLocation] = await Promise.all([
    fetchForecastData({ lat, lon, locationName, view, model }),
    fetchReverseGeocodedLocation({ lat, lon }).catch(() => null),
  ]);
  forecastData = forecast;
  const resolvedLocationName = reverseLocation?.label || forecastData.meta.locationName || locationName;
  forecastData.meta.locationName = resolvedLocationName;
  currentLocation = {
    lat: String(lat),
    lon: String(lon),
    locationName: resolvedLocationName,
  };
  currentView = forecastData.meta.view || view;
  currentModel = forecastData.meta.model || model;
  expandedDayIndex = 0;
  highlightedBestNightIndex = null;
  updateForecastMeta();
  renderForecast(0);
  updateActionButtons();
  syncModelSelect();
  syncShareUrl();
  document.querySelector(".forecast-shell").scrollLeft = 0;
  document.querySelector("#forecast").setAttribute("aria-busy", "false");
}

function setStatus(message) {
  document.querySelector("#forecast-status").textContent = message;
}

function setCurrentForecastAsDefault() {
  if (!forecastData) {
    setStatus("Load a forecast before saving a default location");
    return;
  }

  const saved = saveDefaultLocation(window.localStorage, forecastData);
  setStatus(`Default location saved: ${saved.locationName} (${saved.lat}, ${saved.lon})`);
}

function markDefaultButtonSaved(button) {
  if (!button) return;
  const originalLabel = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = originalLabel;
  button.textContent = "Default Location Saved";
  button.classList.add("is-saved");
  button.setAttribute("aria-pressed", "true");
  clearTimeout(saveButtonResetTimer);
  saveButtonResetTimer = setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("is-saved");
    button.setAttribute("aria-pressed", "false");
  }, 1600);
}

async function switchForecastView(view) {
  if (!currentLocation) return;
  await loadForecast(currentLocation, { view, model: currentModel });
  setStatus(`Centered forecast on ${forecastViewLabel(view)}`);
}

async function pickBestNight() {
  const location = locationFromInputs(currentLocation);
  if (!location) {
    setStatus("Enter coordinates or select a point before picking the best night");
    return;
  }

  await loadForecast(location, { view: "night", model: currentModel });
  const best = forecastData.bestNight;
  if (!best) {
    setStatus("No dark forecast window found in the available forecast");
    return;
  }

  highlightedBestNightIndex = best.dayIndex;
  renderForecast(best.dayIndex);
  const day = forecastData.days[best.dayIndex];
  setStatus(
    `Best night: ${day.name} ${day.id}, score ${best.score}/100, ${best.bestWindow}, ${best.averageCloud}% average clouds, ${best.confidenceLabel}`,
  );
  document.querySelector(".forecast-day.best-night")?.scrollIntoView({ block: "nearest" });
}

function forecastViewLabel(view) {
  if (view === "midnight") return "midnight";
  if (view === "midday") return "midday";
  if (view === "night") return "night";
  return "current hour";
}

function updateActionButtons() {
  document.querySelectorAll("[data-forecast-action]").forEach((button) => {
    const view = forecastViewForAction(button.dataset.forecastAction);
    if (!view) return;
    const active = view === currentView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function applyLocationInputs(location) {
  document.querySelector("#latitude").value = location.lat;
  document.querySelector("#longitude").value = location.lon;
}

function locationFromInputs(fallback = null) {
  const lat = document.querySelector("#latitude").value.trim();
  const lon = document.querySelector("#longitude").value.trim();
  if (lat && lon) {
    return {
      lat,
      lon,
      locationName: `${lat}, ${lon}`,
    };
  }
  return fallback;
}

function renderModelSelect() {
  const select = document.querySelector("#model-select");
  const groups = new Map();

  FORECAST_MODELS.forEach((model) => {
    if (!groups.has(model.group)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = model.group;
      groups.set(model.group, optgroup);
      select.append(optgroup);
    }

    const option = document.createElement("option");
    option.value = model.value;
    option.textContent = model.label;
    groups.get(model.group).append(option);
  });

  syncModelSelect();
}

function syncModelSelect() {
  const select = document.querySelector("#model-select");
  select.value = currentModel;
  select.title = forecastModelLabel(currentModel);
}

function syncShareUrl() {
  if (!currentLocation) return;
  const shareUrl = buildForecastShareUrl(window.location.href, {
    ...currentLocation,
    model: currentModel,
    view: currentView,
  });
  window.history.replaceState(null, "", shareUrl);
}

function initializeMapPicker() {
  if (mapPicker || !window.L) return;

  mapPicker = window.L.map("map-picker", {
    zoomControl: true,
    attributionControl: true,
  });
  window.L.tileLayer(mapTileUrl, mapTileOptions).addTo(mapPicker);
  mapPicker.on("click", (event) => {
    setMapSelection(event.latlng);
  });
}

function currentMapCenter() {
  return mapPointFromLocation(
    {
      lat: document.querySelector("#latitude").value || currentLocation?.lat,
      lon: document.querySelector("#longitude").value || currentLocation?.lon,
    },
    defaultLocation,
  );
}

function openMapPicker() {
  if (!window.L) {
    setStatus("Map picker is unavailable. Check the map library connection.");
    return;
  }

  const dialog = document.querySelector("#map-dialog");
  dialog.hidden = false;
  document.body.classList.add("map-dialog-open");
  initializeMapPicker();

  const center = currentMapCenter();
  const currentPoint = currentSelectedMapPoint();
  if (currentPoint) {
    setMapSelection(currentPoint);
  } else {
    clearMapSelection("Click on the map to select a point");
  }
  mapPicker.setView([center.lat, center.lng], mapPicker.getZoom() || 10);
  requestAnimationFrame(() => {
    mapPicker.invalidateSize();
    document.querySelector("#map-picker").focus();
  });
}

function closeMapPicker() {
  document.querySelector("#map-dialog").hidden = true;
  document.body.classList.remove("map-dialog-open");
  document.querySelector("#open-map-picker").focus();
}

function currentSelectedMapPoint() {
  return mapPointFromLocation({
    lat: document.querySelector("#latitude").value || currentLocation?.lat,
    lon: document.querySelector("#longitude").value || currentLocation?.lon,
  });
}

function clearMapSelection(message = "No point selected") {
  selectedMapLocation = null;
  if (mapMarker) {
    mapMarker.remove();
    mapMarker = null;
  }
  document.querySelector("#map-selected-coordinates").textContent = message;
  document.querySelector("#use-map-picker").disabled = true;
}

function setMapSelection(point) {
  selectedMapLocation = locationFromMapPoint(point);
  const latlng = [Number(selectedMapLocation.lat), Number(selectedMapLocation.lon)];
  if (!mapMarker) {
    mapMarker = window.L.marker(latlng).addTo(mapPicker);
  } else {
    mapMarker.setLatLng(latlng);
  }
  document.querySelector("#map-selected-coordinates").textContent =
    `${selectedMapLocation.lat}, ${selectedMapLocation.lon}`;
  document.querySelector("#use-map-picker").disabled = false;
}

async function useSelectedMapLocation() {
  if (!selectedMapLocation) return;
  applyLocationInputs(selectedMapLocation);
  document.querySelector("#map-dialog").hidden = true;
  document.body.classList.remove("map-dialog-open");

  try {
    await loadForecast(selectedMapLocation, { view: "current", model: currentModel });
  } catch (error) {
    setStatus(error.message);
    document.querySelector("#forecast").setAttribute("aria-busy", "false");
  }
}

document.querySelector("#forecast").addEventListener("click", (event) => {
  const button = event.target.closest(".day-date");
  if (!button) return;
  const day = button.closest(".forecast-day");
  renderForecast(nextExpandedForecastDay(expandedDayIndex, Number(day.dataset.dayIndex)));
});

document.querySelector("#forecast-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const latitude = document.querySelector("#latitude");
  const longitude = document.querySelector("#longitude");

  try {
    await loadForecast(
      {
        lat: latitude.value.trim(),
        lon: longitude.value.trim(),
        locationName: `${latitude.value.trim()}, ${longitude.value.trim()}`,
      },
      { view: "current" },
    );
  } catch (error) {
    setStatus(error.message);
    document.querySelector("#forecast").setAttribute("aria-busy", "false");
  }
});

document.querySelector("#pick-best-night").addEventListener("click", async () => {
  try {
    await pickBestNight();
  } catch (error) {
    setStatus(error.message);
    document.querySelector("#forecast").setAttribute("aria-busy", "false");
  }
});
document.querySelector("#open-map-picker").addEventListener("click", openMapPicker);
document.querySelector("#close-map-picker").addEventListener("click", closeMapPicker);
document.querySelector("#cancel-map-picker").addEventListener("click", closeMapPicker);
document.querySelector("#use-map-picker").addEventListener("click", useSelectedMapLocation);
document.querySelector("#map-dialog").addEventListener("click", (event) => {
  if (event.target.id === "map-dialog") {
    closeMapPicker();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#map-dialog").hidden) {
    closeMapPicker();
  }
});

document.querySelector("#model-select").addEventListener("change", async (event) => {
  currentModel = normalizeForecastModel(event.target.value);
  if (!currentLocation) return;

  try {
    await loadForecast(currentLocation, { view: currentView, model: currentModel });
    setStatus(`Forecast model changed to ${forecastModelLabel(currentModel)}`);
  } catch (error) {
    setStatus(error.message);
    document.querySelector("#forecast").setAttribute("aria-busy", "false");
  }
});

document.querySelector(".actions").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-forecast-action]");
  const action = button?.dataset.forecastAction;
  const view = forecastViewForAction(action);
  try {
    if (view) {
      await switchForecastView(view);
    }
    if (action === "set-default") {
      setCurrentForecastAsDefault();
      markDefaultButtonSaved(button);
    }
  } catch (error) {
    setStatus(error.message);
    document.querySelector("#forecast").setAttribute("aria-busy", "false");
  }
});

const initialSearchParams = new URLSearchParams(window.location.search);
const initialLocation = initialForecastLocation(initialSearchParams, window.localStorage);
currentView = forecastViewFromUrl(initialSearchParams);
currentModel = normalizeForecastModel(initialSearchParams.get("model") || currentModel);
renderModelSelect();

if (initialLocation) {
  currentLocation = initialLocation;
  applyLocationInputs(initialLocation);
  loadForecast(initialLocation, { view: currentView, model: currentModel }).catch((error) => {
    setStatus(error.message);
    document.querySelector("#forecast").setAttribute("aria-busy", "false");
  });
} else {
  showNoLocationSelected();
}
