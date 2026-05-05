import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchForecastData, fetchReverseGeocodedLocation } from "../app/website/client-api.js";

function hourlyValues(value) {
  return Array(48).fill(value);
}

function sampleOpenMeteoResponse() {
  const times = [];
  for (const day of ["2026-05-04", "2026-05-05"]) {
    for (let hour = 0; hour < 24; hour += 1) {
      times.push(`${day}T${String(hour).padStart(2, "0")}:00`);
    }
  }

  return {
    latitude: 48.2,
    longitude: 16.98,
    elevation: 162,
    timezone: "Europe/Bratislava",
    timezone_abbreviation: "CEST",
    hourly: {
      time: times,
      temperature_2m: hourlyValues(12),
      apparent_temperature: hourlyValues(11),
      relative_humidity_2m: hourlyValues(60),
      dew_point_2m: hourlyValues(7),
      precipitation: hourlyValues(0),
      precipitation_probability: hourlyValues(0),
      precipitation_type: hourlyValues(0),
      weather_code: hourlyValues(0),
      cloud_cover: hourlyValues(20),
      cloud_cover_low: hourlyValues(0),
      cloud_cover_mid: hourlyValues(0),
      cloud_cover_high: hourlyValues(20),
      visibility: hourlyValues(10000),
      wind_speed_10m: hourlyValues(8),
      wind_direction_10m: hourlyValues(140),
      pressure_msl: hourlyValues(1017),
    },
    daily: {
      time: ["2026-05-04", "2026-05-05"],
      sunrise: ["2026-05-04T05:28", "2026-05-05T05:27"],
      sunset: ["2026-05-04T20:09", "2026-05-05T20:10"],
      daylight_duration: [52852, 53000],
    },
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

describe("fetchForecastData", () => {
  it("falls back to direct Open-Meteo calls when the local API is not present", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url.toString());
      if (url.pathname === "/meteo/api/forecast") {
        return jsonResponse({ message: "not found" }, 404);
      }
      return jsonResponse(sampleOpenMeteoResponse());
    };

    const forecast = await fetchForecastData(
      {
        lat: "48.21",
        lon: "16.97",
        locationName: "Devínska Nová Ves",
        view: "midday",
      },
      {
        baseUrl: "https://www.maraz.sk/meteo/",
        fetchImpl,
      },
    );

    assert.equal(requestedUrls[0], "https://www.maraz.sk/meteo/api/forecast?lat=48.21&lon=16.97&locationName=Dev%C3%ADnska+Nov%C3%A1+Ves&view=midday");
    assert.equal(new URL(requestedUrls[1]).origin, "https://api.open-meteo.com");
    assert.equal(forecast.meta.view, "midday");
    assert.equal(forecast.meta.locationName, "Devínska Nová Ves");
    assert.deepEqual(forecast.hours.slice(0, 4), ["12", "13", "14", "15"]);
  });

  it("uses the selected forecast model for the local API and static Open-Meteo fallback", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url.toString());
      if (url.pathname === "/meteo/api/forecast") {
        return jsonResponse({ message: "not found" }, 404);
      }
      return jsonResponse(sampleOpenMeteoResponse());
    };

    const forecast = await fetchForecastData(
      {
        lat: "48.21",
        lon: "16.97",
        locationName: "Devínska Nová Ves",
        view: "current",
        model: "geosphere_arome_austria",
      },
      {
        baseUrl: "https://www.maraz.sk/meteo/",
        fetchImpl,
      },
    );

    assert.equal(new URL(requestedUrls[0]).searchParams.get("model"), "geosphere_arome_austria");
    assert.equal(new URL(requestedUrls[1]).searchParams.get("models"), "geosphere_arome_austria");
    assert.equal(forecast.meta.model, "geosphere_arome_austria");
    assert.equal(forecast.meta.modelLabel, "GeoSphere AROME Austria");
  });

  it("falls back to direct Open-Meteo when the local API ignores the selected model", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url.toString());
      if (url.pathname === "/api/forecast") {
        return jsonResponse({
          meta: {
            model: "best_match",
          },
        });
      }
      return jsonResponse(sampleOpenMeteoResponse());
    };

    const forecast = await fetchForecastData(
      {
        lat: "48.21",
        lon: "16.97",
        locationName: "Devínska Nová Ves",
        view: "current",
        model: "icon_d2",
      },
      {
        baseUrl: "http://localhost:4173/",
        fetchImpl,
      },
    );

    assert.equal(new URL(requestedUrls[0]).searchParams.get("model"), "icon_d2");
    assert.equal(new URL(requestedUrls[1]).searchParams.get("models"), "icon_d2");
    assert.equal(forecast.meta.model, "icon_d2");
    assert.equal(forecast.meta.modelLabel, "DWD ICON D2");
  });
});

describe("fetchReverseGeocodedLocation", () => {
  it("falls back to direct Nominatim calls when the local API is not present", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url.toString());
      if (url.pathname === "/meteo/api/reverse-geocode") {
        return jsonResponse({ message: "not found" }, 404);
      }
      return jsonResponse({
        name: "Devínske Jazero",
        display_name: "Devínske Jazero, Devínska Nová Ves, okres Bratislava IV, Bratislavský kraj, Slovensko",
        address: {
          hamlet: "Devínske Jazero",
          suburb: "Devínska Nová Ves",
        },
      });
    };

    const location = await fetchReverseGeocodedLocation(
      { lat: "48.25125", lon: "16.95946" },
      {
        baseUrl: "https://www.maraz.sk/meteo/",
        fetchImpl,
      },
    );

    assert.equal(requestedUrls[0], "https://www.maraz.sk/meteo/api/reverse-geocode?lat=48.25125&lon=16.95946");
    assert.equal(new URL(requestedUrls[1]).origin, "https://nominatim.openstreetmap.org");
    assert.equal(location.label, "Devínske Jazero, Devínska Nová Ves");
  });

  it("falls back to BigDataCloud when Nominatim rejects direct reverse geocoding", async () => {
    const requestedUrls = [];
    const fetchImpl = async (url) => {
      requestedUrls.push(url.toString());
      if (url.pathname === "/meteo/api/reverse-geocode") {
        return jsonResponse({ message: "not found" }, 404);
      }
      if (url.origin === "https://nominatim.openstreetmap.org") {
        return jsonResponse({ message: "too many requests" }, 429);
      }
      return jsonResponse({
        locality: "Devínska Nová Ves",
        city: "Bratislava",
        principalSubdivision: "Bratislavský kraj",
        countryName: "Slovensko",
      });
    };

    const location = await fetchReverseGeocodedLocation(
      { lat: "48.21", lon: "16.97" },
      {
        baseUrl: "https://www.maraz.sk/meteo/",
        fetchImpl,
      },
    );

    assert.equal(requestedUrls[0], "https://www.maraz.sk/meteo/api/reverse-geocode?lat=48.21&lon=16.97");
    assert.equal(new URL(requestedUrls[1]).origin, "https://nominatim.openstreetmap.org");
    assert.equal(new URL(requestedUrls[2]).origin, "https://api.bigdatacloud.net");
    assert.equal(location.label, "Devínska Nová Ves, Bratislava");
  });
});
