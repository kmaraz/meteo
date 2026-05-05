import {
  buildBigDataCloudReverseGeocodingUrl,
  buildGeocodingUrl,
  buildOpenMeteoUrl,
  buildReverseGeocodingUrl,
  normalizeBigDataCloudReverseGeocodingResponse,
  normalizeGeocodingResponse,
  normalizeOpenMeteoForecast,
  normalizeForecastModel,
  normalizeReverseGeocodingResponse,
} from "./open-meteo.js?v=20260505-reverse-geocode-fallback";

const reverseGeocodingCache = new Map();

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

export async function fetchReverseGeocodedLocation(
  { lat, lon },
  { baseUrl = window.location.href, fetchImpl = fetch } = {},
) {
  const cacheKey = reverseGeocodingCacheKey(lat, lon);
  if (reverseGeocodingCache.has(cacheKey)) {
    return reverseGeocodingCache.get(cacheKey);
  }

  const backendUrl = buildBackendUrl("api/reverse-geocode", baseUrl, { lat, lon });
  try {
    const location = await fetchJson(backendUrl, fetchImpl);
    reverseGeocodingCache.set(cacheKey, location);
    return location;
  } catch (error) {
    if (!canUseReverseGeocodingFallback(error)) {
      throw error;
    }
  }

  const location = await fetchExternalReverseGeocodedLocation({ lat, lon }, fetchImpl);
  reverseGeocodingCache.set(cacheKey, location);
  return location;
}

async function fetchExternalReverseGeocodedLocation({ lat, lon }, fetchImpl) {
  try {
    const reverseGeocoding = await fetchJson(buildReverseGeocodingUrl({ lat, lon }), fetchImpl);
    return normalizeReverseGeocodingResponse(reverseGeocoding, `${lat}, ${lon}`);
  } catch {
    const reverseGeocoding = await fetchJson(buildBigDataCloudReverseGeocodingUrl({ lat, lon }), fetchImpl);
    return normalizeBigDataCloudReverseGeocodingResponse(reverseGeocoding, `${lat}, ${lon}`);
  }
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

function canUseReverseGeocodingFallback(error) {
  return error.status === 404 || error.status >= 500;
}

function reverseGeocodingCacheKey(lat, lon) {
  return `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
}
