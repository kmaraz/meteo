import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildForecastShareUrl,
  forecastLocationFromUrl,
  forecastViewForAction,
  forecastViewFromUrl,
  getDefaultLocation,
  initialForecastLocation,
  locationFromMapPoint,
  mapPointFromLocation,
  moonLitPath,
  saveDefaultLocation,
  visibleForecastDetailRows,
} from "../app/website/forecast-controls.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("default location storage", () => {
  it("returns fallback location when storage is empty or invalid", () => {
    const fallback = { locationName: "Fallback", lat: "48.21", lon: "16.97" };

    assert.deepEqual(getDefaultLocation(memoryStorage(), fallback), fallback);
    assert.deepEqual(getDefaultLocation(memoryStorage({ "meteo.defaultLocation": "x" }), fallback), fallback);
  });

  it("saves and reloads the current forecast location", () => {
    const storage = memoryStorage();
    const forecast = {
      meta: {
        locationName: "Bratislava, Slovensko",
        requested: {
          latitude: 48.14816,
          longitude: 17.10674,
        },
      },
    };

    const saved = saveDefaultLocation(storage, forecast);

    assert.deepEqual(saved, {
      locationName: "Bratislava, Slovensko",
      lat: "48.14816",
      lon: "17.10674",
    });
    assert.deepEqual(getDefaultLocation(storage, null), saved);
  });
});

describe("forecast action views", () => {
  it("maps toolbar actions to forecast view modes", () => {
    assert.equal(forecastViewForAction("center-midnight"), "midnight");
    assert.equal(forecastViewForAction("center-midday"), "midday");
    assert.equal(forecastViewForAction("set-default"), null);
    assert.equal(forecastViewForAction("unknown"), null);
  });

  it("reads forecast view mode from URL parameters", () => {
    assert.equal(forecastViewFromUrl(new URLSearchParams("view=midnight")), "midnight");
    assert.equal(forecastViewFromUrl(new URLSearchParams("view=midday")), "midday");
    assert.equal(forecastViewFromUrl(new URLSearchParams("view=night")), "night");
    assert.equal(forecastViewFromUrl(new URLSearchParams("view=current")), "current");
    assert.equal(forecastViewFromUrl(new URLSearchParams("view=unknown")), "current");
    assert.equal(forecastViewFromUrl(new URLSearchParams()), "current");
  });
});

describe("forecast URL state", () => {
  it("reads shared forecast location from URL coordinates", () => {
    const fallback = { locationName: "Fallback", lat: "48.21", lon: "16.97" };
    const location = forecastLocationFromUrl(new URLSearchParams("lat=49.001&lon=20.002"), fallback);

    assert.deepEqual(location, {
      locationName: "49.001, 20.002",
      lat: "49.001",
      lon: "20.002",
    });
  });

  it("falls back when shared URL coordinates are invalid", () => {
    const fallback = { locationName: "Fallback", lat: "48.21", lon: "16.97" };

    assert.deepEqual(forecastLocationFromUrl(new URLSearchParams("lat=91&lon=20"), fallback), fallback);
    assert.deepEqual(forecastLocationFromUrl(new URLSearchParams("lat=49"), fallback), fallback);
  });

  it("does not select a startup location when URL coordinates are absent", () => {
    assert.equal(forecastLocationFromUrl(new URLSearchParams()), null);
  });

  it("uses a saved default location when a shared URL has no coordinates", () => {
    const storage = memoryStorage({
      "meteo.defaultLocation": JSON.stringify({
        locationName: "Stored default",
        lat: "48.25125",
        lon: "16.95946",
      }),
    });

    assert.deepEqual(initialForecastLocation(new URLSearchParams(), storage), {
      locationName: "Stored default",
      lat: "48.25125",
      lon: "16.95946",
    });
  });

  it("prefers shared URL coordinates over a saved default location", () => {
    const storage = memoryStorage({
      "meteo.defaultLocation": JSON.stringify({
        locationName: "Stored default",
        lat: "48.25125",
        lon: "16.95946",
      }),
    });

    assert.deepEqual(initialForecastLocation(new URLSearchParams("lat=49.001&lon=20.002"), storage), {
      locationName: "49.001, 20.002",
      lat: "49.001",
      lon: "20.002",
    });
  });

  it("builds a share URL with location, model, and view state", () => {
    const url = buildForecastShareUrl("https://www.maraz.sk/meteo/?old=1#forecast", {
      lat: "48.21",
      lon: "16.97",
      model: "icon_d2",
      view: "night",
    });

    assert.equal(
      url,
      "https://www.maraz.sk/meteo/?lat=48.21&lon=16.97&model=icon_d2&view=night#forecast",
    );
  });
});

describe("map point forecast location", () => {
  it("formats selected map coordinates for forecast lookup", () => {
    assert.deepEqual(locationFromMapPoint({ lat: 48.1481642, lng: 17.106741 }), {
      locationName: "48.14816, 17.10674",
      lat: "48.14816",
      lon: "17.10674",
    });
  });

  it("uses valid forecast coordinates as a map point", () => {
    assert.deepEqual(mapPointFromLocation({ lat: "48.14816", lon: "17.10674" }), {
      lat: 48.14816,
      lng: 17.10674,
    });
  });

  it("falls back when forecast coordinates cannot be shown on a map", () => {
    assert.deepEqual(
      mapPointFromLocation({ lat: "91", lon: "17" }, { lat: "48.21", lon: "16.97" }),
      { lat: 48.21, lng: 16.97 },
    );
  });
});

describe("forecast detail row visibility", () => {
  it("hides low-value rows from rendering without removing source data", () => {
    const rows = [
      { label: "Cloud Cover" },
      { label: "Pressure (hPa)" },
      { label: "Chance of Frost" },
      { label: "Precipitation Type" },
      { label: "Wind Speed (m/s)" },
    ];

    assert.deepEqual(
      visibleForecastDetailRows(rows).map((row) => row.label),
      ["Cloud Cover", "Wind Speed (m/s)"],
    );
    assert.equal(rows.length, 5);
  });
});

describe("moon phase icon path", () => {
  it("mirrors the illuminated side for waxing and waning phases", () => {
    assert.equal(moonLitPath({ illumination: 0, waxing: true }), "");
    assert.match(moonLitPath({ illumination: 50, waxing: true }), /A 32 32 0 0 1/);
    assert.match(moonLitPath({ illumination: 50, waxing: false }), /A 32 32 0 0 0/);
    assert.match(moonLitPath({ illumination: 93, waxing: false }), /87\.04/);
  });
});
