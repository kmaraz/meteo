import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildGeocodingUrl,
  buildOpenMeteoUrl,
  normalizeGeocodingResponse,
  normalizeOpenMeteoForecast,
  validateCoordinate,
} from "./open-meteo.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const STATIC_ROOT = resolve(__dirname, "../website");
const DEFAULT_PORT = 4173;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
]);

export function createAppServer({ fetchImpl = fetch } = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/api/forecast") {
        await handleForecast(url, response, fetchImpl);
        return;
      }
      if (url.pathname === "/api/geocode") {
        await handleGeocode(url, response, fetchImpl);
        return;
      }
      await serveStatic(url, response);
    } catch (error) {
      const status = error.statusCode || (error instanceof TypeError ? 400 : 500);
      sendJson(response, status, {
        error: true,
        message: error.message || "Unexpected server error",
      });
    }
  });
}

async function handleForecast(url, response, fetchImpl) {
  const lat = validateCoordinate(url.searchParams.get("lat"), "lat", -90, 90);
  const lon = validateCoordinate(url.searchParams.get("lon"), "lon", -180, 180);
  const locationName = url.searchParams.get("locationName") || "Selected location";
  const view = url.searchParams.get("view") || "current";
  const forecastUrl = buildOpenMeteoUrl({ lat, lon });
  const openMeteo = await fetchJson(forecastUrl, fetchImpl);
  sendJson(response, 200, normalizeOpenMeteoForecast(openMeteo, { lat, lon, locationName, view }));
}

async function handleGeocode(url, response, fetchImpl) {
  const name = url.searchParams.get("name")?.trim();
  if (!name || name.length < 2) {
    const error = new TypeError("name must contain at least 2 characters");
    error.statusCode = 400;
    throw error;
  }

  const geocodingUrl = buildGeocodingUrl(name);
  const geocoding = await fetchJson(geocodingUrl, fetchImpl);
  sendJson(response, 200, normalizeGeocodingResponse(geocoding));
}

async function fetchJson(url, fetchImpl) {
  const key = url.toString();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`Open-Meteo request failed with ${response.status}`);
      error.statusCode = 502;
      throw error;
    }
    const data = await response.json();
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function serveStatic(url, response) {
  const path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(STATIC_ROOT, path));
  if (relative(STATIC_ROOT, filePath).startsWith("..")) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": MIME_TYPES.get(extname(filePath)) || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function sendText(response, status, body) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  createAppServer().listen(port, () => {
    console.log(`Serving http://localhost:${port}`);
  });
}
