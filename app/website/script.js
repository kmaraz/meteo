import {
  forecastViewForAction,
  getDefaultLocation,
  moonLitPath,
  saveDefaultLocation,
} from "./forecast-controls.js";

const defaultLocation = {
  locationName: "Devínska Nová Ves, Okres Bratislava IV, Slovakia",
  lat: "48.21",
  lon: "16.97",
};

let forecastData = null;
let expandedDayIndex = 0;
let currentLocation = null;
let currentView = "current";
let saveButtonResetTimer = null;

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
  return day.detailRows
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

function renderForecast(nextExpandedIndex = expandedDayIndex) {
  if (!forecastData) return;
  expandedDayIndex = Math.max(0, Math.min(nextExpandedIndex, forecastData.days.length - 1));
  const target = document.querySelector("#forecast");
  target.innerHTML = forecastData.days
    .map((day, index) => {
      const expanded = index === expandedDayIndex;
      return `
        <article class="forecast-day ${expanded ? "expanded" : "compact"}" data-day-index="${index}">
          <button class="day-date" type="button" aria-expanded="${expanded}">
            <span class="day-name">${day.name}</span>
            <span class="day-number">${day.date}</span>
          </button>
          <div class="moon-panel">
            ${renderMoonDisc(day.moon, index)}
            <span>
              <span class="moon-phase">${day.moon.phase}</span>
              <span class="moon-percent">${day.moon.illumination}%</span>
              <span class="moon-rise">sun ${day.sun.rise} &nbsp; set ${day.sun.set}</span>
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
  document.querySelector("#forecast-title").textContent =
    `Forecast for ${meta.locationName} (${meta.requested.latitude},${meta.requested.longitude})`;
  document.querySelector("#forecast-meta").textContent =
    `Generated: ${generated}. Forecast: ${meta.forecastFrom} to ${meta.forecastTo}. Timezone: ${meta.timezone}.`;
  document.querySelector("#source-badge").innerHTML =
    `<span aria-hidden="true">live</span> Forecast source: <strong>${meta.source}</strong>. Model: <strong>${meta.model}</strong>. Resolved grid: <strong>${meta.resolved.latitude}, ${meta.resolved.longitude}</strong>.`;
  setStatus("Powered by Open-Meteo Weather API");
}

async function loadForecast({ lat, lon, locationName }, options = {}) {
  const view = options.view || currentView;
  setStatus(`Loading ${forecastViewLabel(view)} forecast...`);
  document.querySelector("#forecast").setAttribute("aria-busy", "true");
  const url = new URL("/api/forecast", window.location.origin);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("locationName", locationName);
  url.searchParams.set("view", view);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Forecast request failed with ${response.status}`);
  }

  forecastData = await response.json();
  currentLocation = {
    lat: String(lat),
    lon: String(lon),
    locationName,
  };
  currentView = forecastData.meta.view || view;
  expandedDayIndex = 0;
  updateForecastMeta();
  renderForecast(0);
  updateActionButtons();
  document.querySelector(".forecast-shell").scrollLeft = 0;
  document.querySelector("#forecast").setAttribute("aria-busy", "false");
}

async function geocodeSlovakLocation(name) {
  const url = new URL("/api/geocode", window.location.origin);
  url.searchParams.set("name", name);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Geocoding request failed with ${response.status}`);
  }
  const data = await response.json();
  if (!data.results.length) {
    throw new Error(`No Slovak location found for "${name}"`);
  }
  return data.results[0];
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
  await loadForecast(currentLocation, { view });
  setStatus(`Centered forecast on ${forecastViewLabel(view)}`);
}

function forecastViewLabel(view) {
  if (view === "midnight") return "midnight";
  if (view === "midday") return "midday";
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
  document.querySelector("#address").value = location.locationName;
}

document.querySelector("#forecast").addEventListener("click", (event) => {
  const button = event.target.closest(".day-date");
  if (!button) return;
  const day = button.closest(".forecast-day");
  renderForecast(Number(day.dataset.dayIndex));
});

document.querySelector("#forecast-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = document.querySelector("#address").value.trim();
  const latitude = document.querySelector("#latitude");
  const longitude = document.querySelector("#longitude");

  try {
    if (address) {
      const location = await geocodeSlovakLocation(address);
      latitude.value = location.latitude;
      longitude.value = location.longitude;
      await loadForecast(
        {
          lat: location.latitude,
          lon: location.longitude,
          locationName: location.label,
        },
        { view: "current" },
      );
      return;
    }

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

const initialLocation = getDefaultLocation(window.localStorage, defaultLocation);
currentLocation = initialLocation;
applyLocationInputs(initialLocation);

loadForecast(initialLocation, { view: "current" }).catch((error) => {
  setStatus(error.message);
  document.querySelector("#forecast").setAttribute("aria-busy", "false");
});
