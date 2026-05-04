export const DEFAULT_LOCATION_STORAGE_KEY = "meteo.defaultLocation";
const ACTION_VIEWS = new Map([
  ["center-midnight", "midnight"],
  ["center-midday", "midday"],
]);

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

function formatSvgNumber(value) {
  return String(Math.round(value * 100) / 100);
}
