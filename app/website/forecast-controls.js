export const DEFAULT_LOCATION_STORAGE_KEY = "meteo.defaultLocation";
const ACTION_VIEWS = new Map([
  ["center-midnight", "midnight"],
  ["center-midday", "midday"],
]);
const URL_VIEWS = new Set(["current", "midnight", "midday", "night"]);
const HIDDEN_DETAIL_ROW_LABELS = new Set(["Pressure (hPa)", "Chance of Frost", "Precipitation Type"]);

export function getDefaultLocation(storage, fallback) {
  try {
    const value = JSON.parse(storage.getItem(DEFAULT_LOCATION_STORAGE_KEY));
    if (isLocation(value)) {
      return value;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function saveDefaultLocation(storage, forecastData) {
  const location = {
    locationName: forecastData.meta.locationName,
    lat: String(forecastData.meta.requested.latitude),
    lon: String(forecastData.meta.requested.longitude),
  };
  storage.setItem(DEFAULT_LOCATION_STORAGE_KEY, JSON.stringify(location));
  return location;
}

export function forecastViewForAction(action) {
  return ACTION_VIEWS.get(action) || null;
}

export function forecastViewFromUrl(searchParams) {
  const view = searchParams.get("view");
  return URL_VIEWS.has(view) ? view : "current";
}

export function nextExpandedForecastDay(currentIndex, selectedIndex) {
  return currentIndex === selectedIndex ? -1 : selectedIndex;
}

export function forecastLocationFromUrl(searchParams, fallback) {
  const lat = coordinateFromUrl(searchParams.get("lat"), -90, 90);
  const lon = coordinateFromUrl(searchParams.get("lon"), -180, 180);
  if (!lat || !lon) {
    return fallback ?? null;
  }

  return { locationName: `${lat}, ${lon}`, lat, lon };
}

export function initialForecastLocation(searchParams, storage) {
  return forecastLocationFromUrl(searchParams) || getDefaultLocation(storage, null);
}

export function buildForecastShareUrl(baseUrl, { lat, lon, model, view }) {
  const url = new URL(baseUrl);
  url.search = "";
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("model", String(model));
  url.searchParams.set("view", URL_VIEWS.has(view) ? view : "current");
  return url.toString();
}

export function locationFromMapPoint(point) {
  const lat = formatMapCoordinate(point.lat);
  const lon = formatMapCoordinate(point.lng ?? point.lon);
  return {
    locationName: `${lat}, ${lon}`,
    lat,
    lon,
  };
}

export function mapPointFromLocation(location, fallback = null) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lon ?? location?.lng);
  if (isMapCoordinate(lat, -90, 90) && isMapCoordinate(lng, -180, 180)) {
    return { lat, lng };
  }
  return fallback ? mapPointFromLocation(fallback) : null;
}

export function visibleForecastDetailRows(rows) {
  return rows.filter((row) => !HIDDEN_DETAIL_ROW_LABELS.has(row.label));
}

export function moonLitPath({ illumination, waxing }) {
  const lit = Math.max(0, Math.min(Number(illumination) / 100, 1));
  if (lit <= 0.01) {
    return "";
  }

  const controlX = waxing ? 32 + (1 - 2 * lit) * 64 : 32 + (2 * lit - 1) * 64;
  const arcSweep = waxing ? 1 : 0;
  const formattedControlX = formatSvgNumber(controlX);

  return [
    "M 32 0",
    `A 32 32 0 0 ${arcSweep} 32 64`,
    `C ${formattedControlX} 64 ${formattedControlX} 0 32 0`,
    "Z",
  ].join(" ");
}

function isLocation(value) {
  return Boolean(
    value &&
      typeof value.locationName === "string" &&
      typeof value.lat === "string" &&
      typeof value.lon === "string" &&
      Number.isFinite(Number(value.lat)) &&
      Number.isFinite(Number(value.lon)),
  );
}

function coordinateFromUrl(value, min, max) {
  const coordinate = value?.trim();
  if (!coordinate) return null;
  const number = Number(coordinate);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return coordinate;
}

function formatMapCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("Invalid map coordinate");
  }
  return number.toFixed(5);
}

function isMapCoordinate(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function formatSvgNumber(value) {
  return String(Math.round(value * 100) / 100);
}
