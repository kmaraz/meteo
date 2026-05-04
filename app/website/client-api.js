import {
  buildGeocodingUrl,
  buildOpenMeteoUrl,
  normalizeGeocodingResponse,
  normalizeOpenMeteoForecast,
  normalizeForecastModel,
} from "./open-meteo.js?v=20260504-map-picker";

export async function fetchForecastData(
  { lat, lon, locationName, view, model },
  { baseUrl = window.location.href, fetchImpl = fetch } = {},
) {
  const selectedModel = normalizeForecastModel(model);
  const hasExplicitModel = model !== undefined && model !== null && model !== "";
  const backendUrl = buildBackendUrl("api/forecast", baseUrl, {
    lat,
    lon,
    locationName,
    view,
    model: hasExplicitModel ? selectedModel : undefined,
  });
  try {
    const forecast = await fetchJson(backendUrl, fetchImpl);
    if (!hasExplicitModel || forecast.meta?.model === selectedModel) {
      return forecast;
    }
  } catch (error) {
    if (!canUseStaticFallback(error)) {
      throw error;
    }
  }

  const openMeteo = await fetchJson(buildOpenMeteoUrl({ lat, lon, model: selectedModel }), fetchImpl);
  return normalizeOpenMeteoForecast(openMeteo, { lat, lon, locationName, view, model: selectedModel });
}

export async function fetchSlovakGeocoding(name, { baseUrl = window.location.href, fetchImpl = fetch } = {}) {
  const backendUrl = buildBackendUrl("api/geocode", baseUrl, { name });
  try {
    return await fetchJson(backendUrl, fetchImpl);
  } catch (error) {
    if (!canUseStaticFallback(error)) {
      throw error;
    }
  }

  const geocoding = await fetchJson(buildGeocodingUrl(name), fetchImpl);
  return normalizeGeocodingResponse(geocoding);
}

function buildBackendUrl(path, baseUrl, params) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, value);
  }
  return url;
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || `Request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function canUseStaticFallback(error) {
  return error.status === 404;
}
