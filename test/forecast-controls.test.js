import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  forecastViewForAction,
  getDefaultLocation,
  moonLitPath,
  saveDefaultLocation,
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
});

describe("moon phase icon path", () => {
  it("mirrors the illuminated side for waxing and waning phases", () => {
    assert.equal(moonLitPath({ illumination: 0, waxing: true }), "");
    assert.match(moonLitPath({ illumination: 50, waxing: true }), /A 32 32 0 0 1/);
    assert.match(moonLitPath({ illumination: 50, waxing: false }), /A 32 32 0 0 0/);
    assert.match(moonLitPath({ illumination: 93, waxing: false }), /87\.04/);
  });
});
