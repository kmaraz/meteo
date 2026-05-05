import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FORECAST_MODELS,
  buildBigDataCloudReverseGeocodingUrl,
  buildGeocodingUrl,
  buildOpenMeteoUrl,
  buildReverseGeocodingUrl,
  normalizeOpenMeteoForecast,
  normalizeForecastModel,
  normalizeBigDataCloudReverseGeocodingResponse,
  normalizeReverseGeocodingResponse,
} from "../app/website/open-meteo.js";

const hourlyVariables = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "precipitation_probability",
  "precipitation_type",
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "pressure_msl",
];

function hourlyValues(firstDay, secondDay) {
  return [...Array(24).fill(firstDay), ...Array(24).fill(secondDay)];
}

function sampleOpenMeteoResponse() {
  const times = [];
  for (const day of ["2026-05-03", "2026-05-04"]) {
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
      temperature_2m: hourlyValues(11, 18),
      apparent_temperature: hourlyValues(10, 17),
      relative_humidity_2m: hourlyValues(72, 48),
      dew_point_2m: hourlyValues(7, 9),
      precipitation: hourlyValues(0, 0.3),
      precipitation_probability: hourlyValues(0, 40),
      precipitation_type: hourlyValues(0, 1),
      weather_code: hourlyValues(0, 61),
      cloud_cover: hourlyValues(10, 80),
      cloud_cover_low: hourlyValues(0, 60),
      cloud_cover_mid: hourlyValues(5, 40),
      cloud_cover_high: hourlyValues(10, 90),
      visibility: hourlyValues(10000, 4500),
      wind_speed_10m: hourlyValues(9, 22),
      wind_direction_10m: hourlyValues(140, 250),
      pressure_msl: hourlyValues(1017, 1012),
    },
    daily: {
      time: ["2026-05-03", "2026-05-04"],
      sunrise: ["2026-05-03T05:29", "2026-05-04T05:28"],
      sunset: ["2026-05-03T20:07", "2026-05-04T20:09"],
      daylight_duration: [52673, 52852],
    },
  };
}

function sampleHourIndexedResponse() {
  const times = [];
  for (const day of ["2026-05-04", "2026-05-05"]) {
    for (let hour = 0; hour < 24; hour += 1) {
      times.push(`${day}T${String(hour).padStart(2, "0")}:00`);
    }
  }

  const byHour = times.map((time) => Number(time.slice(11, 13)));

  return {
    ...sampleOpenMeteoResponse(),
    hourly: {
      time: times,
      temperature_2m: byHour,
      apparent_temperature: byHour,
      relative_humidity_2m: Array(48).fill(70),
      dew_point_2m: byHour,
      precipitation: Array(48).fill(0),
      precipitation_probability: Array(48).fill(0),
      precipitation_type: Array(48).fill(0),
      weather_code: Array(48).fill(0),
      cloud_cover: byHour,
      cloud_cover_low: byHour,
      cloud_cover_mid: byHour,
      cloud_cover_high: byHour,
      visibility: Array(48).fill(10000),
      wind_speed_10m: Array(48).fill(9),
      wind_direction_10m: Array(48).fill(140),
      pressure_msl: Array(48).fill(1017),
    },
    daily: {
      time: ["2026-05-04", "2026-05-05"],
      sunrise: ["2026-05-04T05:28", "2026-05-05T05:27"],
      sunset: ["2026-05-04T20:09", "2026-05-05T20:10"],
      daylight_duration: [52852, 53000],
    },
  };
}

describe("buildOpenMeteoUrl", () => {
  it("builds the Open-Meteo forecast request needed by the Clear Outside grid", () => {
    const url = buildOpenMeteoUrl({ lat: 48.21, lon: 16.97 });

    assert.equal(url.origin, "https://api.open-meteo.com");
    assert.equal(url.pathname, "/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "48.21");
    assert.equal(url.searchParams.get("longitude"), "16.97");
    assert.equal(url.searchParams.get("timezone"), "Europe/Bratislava");
    assert.equal(url.searchParams.get("forecast_days"), "16");
    assert.equal(url.searchParams.get("models"), "best_match");

    const requestedHourly = url.searchParams.get("hourly").split(",");
    assert.deepEqual(requestedHourly, hourlyVariables);
    assert.equal(url.searchParams.get("daily"), "sunrise,sunset,daylight_duration");
  });

  it("allows selecting an explicit Slovakia-suitable forecast model", () => {
    const url = buildOpenMeteoUrl({ lat: 48.21, lon: 16.97, model: "icon_d2" });

    assert.equal(url.searchParams.get("models"), "icon_d2");
  });
});

describe("forecast models", () => {
  it("exposes Slovak-region and global baseline models for the UI selector", () => {
    const modelValues = FORECAST_MODELS.map((model) => model.value);

    assert.deepEqual(
      ["best_match", "icon_d2", "geosphere_arome_austria", "ecmwf_ifs", "gfs_global"].map((value) =>
        modelValues.includes(value),
      ),
      [true, true, true, true, true],
    );
  });

  it("normalizes unknown model values to best_match", () => {
    assert.equal(normalizeForecastModel("not-a-model"), "best_match");
    assert.equal(normalizeForecastModel("ecmwf_ifs"), "ecmwf_ifs");
  });
});

describe("buildGeocodingUrl", () => {
  it("limits place search to Slovakia and Slovak labels", () => {
    const url = buildGeocodingUrl("Devínska Nová Ves");

    assert.equal(url.origin, "https://geocoding-api.open-meteo.com");
    assert.equal(url.pathname, "/v1/search");
    assert.equal(url.searchParams.get("name"), "Devínska Nová Ves");
    assert.equal(url.searchParams.get("countryCode"), "SK");
    assert.equal(url.searchParams.get("language"), "sk");
    assert.equal(url.searchParams.get("count"), "5");
  });
});

describe("reverse geocoding", () => {
  it("builds a Slovak-language Nominatim reverse geocoding request", () => {
    const url = buildReverseGeocodingUrl({ lat: 48.25125, lon: 16.95946 });

    assert.equal(url.origin, "https://nominatim.openstreetmap.org");
    assert.equal(url.pathname, "/reverse");
    assert.equal(url.searchParams.get("format"), "jsonv2");
    assert.equal(url.searchParams.get("lat"), "48.25125");
    assert.equal(url.searchParams.get("lon"), "16.95946");
    assert.equal(url.searchParams.get("zoom"), "14");
    assert.equal(url.searchParams.get("addressdetails"), "1");
    assert.equal(url.searchParams.get("accept-language"), "sk");
  });

  it("normalizes Nominatim address parts into a short forecast label", () => {
    const normalized = normalizeReverseGeocodingResponse({
      name: "Devínske Jazero",
      display_name: "Devínske Jazero, Devínska Nová Ves, okres Bratislava IV, Bratislavský kraj, Slovensko",
      address: {
        hamlet: "Devínske Jazero",
        suburb: "Devínska Nová Ves",
        state_district: "okres Bratislava IV",
        country: "Slovensko",
      },
    });

    assert.equal(normalized.label, "Devínske Jazero, Devínska Nová Ves");
    assert.equal(normalized.displayName, "Devínske Jazero, Devínska Nová Ves, okres Bratislava IV, Bratislavský kraj, Slovensko");
  });

  it("builds and normalizes the BigDataCloud reverse geocoding fallback", () => {
    const url = buildBigDataCloudReverseGeocodingUrl({ lat: 48.21, lon: 16.97 });

    assert.equal(url.origin, "https://api.bigdatacloud.net");
    assert.equal(url.pathname, "/data/reverse-geocode-client");
    assert.equal(url.searchParams.get("latitude"), "48.21");
    assert.equal(url.searchParams.get("longitude"), "16.97");
    assert.equal(url.searchParams.get("localityLanguage"), "sk");

    const normalized = normalizeBigDataCloudReverseGeocodingResponse({
      locality: "Devínska Nová Ves",
      city: "Bratislava",
      principalSubdivision: "Bratislavský kraj",
      countryName: "Slovensko",
    });

    assert.equal(normalized.label, "Devínska Nová Ves, Bratislava");
    assert.equal(normalized.displayName, "Devínska Nová Ves, Bratislava, Bratislavský kraj, Slovensko");
  });
});

describe("normalizeOpenMeteoForecast", () => {
  it("maps hourly Open-Meteo data into 22-21 observing-day rows", () => {
    const normalized = normalizeOpenMeteoForecast(sampleOpenMeteoResponse(), {
      lat: 48.21,
      lon: 16.97,
      locationName: "Devínska Nová Ves",
      model: "icon_eu",
      maxDays: 1,
      view: "night",
    });

    assert.equal(normalized.meta.locationName, "Devínska Nová Ves");
    assert.equal(normalized.meta.model, "icon_eu");
    assert.equal(normalized.meta.modelLabel, "DWD ICON EU");
    assert.equal(normalized.meta.requested.latitude, 48.21);
    assert.equal(normalized.meta.resolved.longitude, 16.98);
    assert.equal(normalized.meta.timezone, "Europe/Bratislava");
    assert.deepEqual(normalized.hours, [
      "22",
      "23",
      "00",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
    ]);

    assert.equal(normalized.days.length, 1);
    assert.equal(normalized.days[0].name, "Sunday");
    assert.equal(normalized.days[0].date, "3");
    assert.equal(normalized.days[0].hours.length, 24);
    assert.deepEqual(normalized.days[0].hours.slice(0, 2), ["good", "good"]);
    assert.deepEqual(normalized.days[0].hours.slice(2, 5), ["bad", "bad", "bad"]);
    assert.equal(normalized.days[0].sun.rise, "05:29");
    assert.equal(normalized.days[0].sun.set, "20:07");
    assert.equal(typeof normalized.days[0].moon.phaseValue, "number");
    assert.equal(typeof normalized.days[0].moon.waxing, "boolean");

    const rows = new Map(normalized.days[0].detailRows.map((row) => [row.label, row]));
    assert.deepEqual(rows.get("Total Clouds (% Sky Obscured)").values.slice(0, 4), [10, 10, 80, 80]);
    assert.deepEqual(rows.get("Low Clouds (% Sky Obscured)").values.slice(0, 4), [0, 0, 60, 60]);
    assert.deepEqual(rows.get("Visibility (km)").values.slice(0, 4), [10, 10, 4.5, 4.5]);
    assert.deepEqual(rows.get("Wind Speed/Direction (km/h)").values.slice(0, 4), [9, 9, 22, 22]);
    assert.deepEqual(rows.get("Wind Speed/Direction (km/h)").classes.slice(0, 4), [
      "south-east good",
      "south-east good",
      "west-south-west ok",
      "west-south-west ok",
    ]);
    assert.deepEqual(rows.get("Pressure (hPa)").values.slice(0, 4), [1017, 1017, 1012, 1012]);
  });

  it("starts the current view at the current local hour and marks that column", () => {
    const normalized = normalizeOpenMeteoForecast(sampleHourIndexedResponse(), {
      lat: 48.21,
      lon: 16.97,
      locationName: "Devínska Nová Ves",
      maxDays: 1,
      view: "current",
      now: "2026-05-04T13:25:00.000Z",
    });

    assert.equal(normalized.meta.view, "current");
    assert.equal(normalized.meta.currentHour, "15");
    assert.deepEqual(normalized.hours.slice(0, 5), ["15", "16", "17", "18", "19"]);
    assert.equal(normalized.days[0].currentHourIndex, 0);
    assert.match(normalized.days[0].daylightGradient, /^linear-gradient\(to right, /);
    assert.deepEqual(normalized.days[0].lightSlots.slice(0, 8), [
      "day",
      "day",
      "day",
      "day",
      "day",
      "dusk",
      "night",
      "night",
    ]);

    const rows = new Map(normalized.days[0].detailRows.map((row) => [row.label, row]));
    assert.deepEqual(rows.get("Total Clouds (% Sky Obscured)").values.slice(0, 5), [15, 16, 17, 18, 19]);
  });

  it("supports midnight and midday views while preserving the current-hour column", () => {
    const midnight = normalizeOpenMeteoForecast(sampleHourIndexedResponse(), {
      lat: 48.21,
      lon: 16.97,
      locationName: "Devínska Nová Ves",
      maxDays: 1,
      view: "midnight",
      now: "2026-05-04T13:25:00.000Z",
    });
    const midday = normalizeOpenMeteoForecast(sampleHourIndexedResponse(), {
      lat: 48.21,
      lon: 16.97,
      locationName: "Devínska Nová Ves",
      maxDays: 1,
      view: "midday",
      now: "2026-05-04T13:25:00.000Z",
    });

    assert.deepEqual(midnight.hours.slice(0, 4), ["00", "01", "02", "03"]);
    assert.equal(midnight.days[0].currentHourIndex, 15);
    assert.match(midnight.days[0].daylightGradient, /#000000/);
    assert.match(midnight.days[0].daylightGradient, /#fffe88/i);
    assert.deepEqual(midnight.days[0].lightSlots.slice(0, 8), [
      "night",
      "night",
      "night",
      "night",
      "night",
      "dawn",
      "day",
      "day",
    ]);
    assert.deepEqual(midday.hours.slice(0, 4), ["12", "13", "14", "15"]);
    assert.equal(midday.days[0].currentHourIndex, 3);
    assert.notEqual(midday.days[0].daylightGradient, midnight.days[0].daylightGradient);
    assert.equal(midday.days[0].lightSlots[8], "dusk");
    assert.equal(midday.days[0].lightSlots[17], "dawn");
  });

  it("scores astrophotography nights using dark clear forecast hours", () => {
    const normalized = normalizeOpenMeteoForecast(sampleAstroNightResponse(), {
      lat: 48.21,
      lon: 16.97,
      locationName: "Devínska Nová Ves",
      maxDays: 3,
      view: "night",
      now: "2026-01-10T12:00:00.000Z",
    });

    assert.equal(normalized.days.length, 3);
    assert.equal(normalized.bestNight.dayIndex, 1);
    assert.ok(normalized.days[1].astro.score > normalized.days[0].astro.score);
    assert.ok(normalized.days[1].astro.score > normalized.days[2].astro.score);
    assert.ok(normalized.days[1].astro.darkHours >= 6);
    assert.ok(normalized.days[1].astro.goodDarkHours >= 6);
    assert.ok(normalized.days[1].astro.averageCloud <= 10);
    assert.match(normalized.days[1].astro.bestWindow, /^22-0[0-9]$/);
  });
});

function sampleAstroNightResponse() {
  const dates = ["2026-01-10", "2026-01-11", "2026-01-12", "2026-01-13"];
  const times = dates.flatMap((date) =>
    Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, "0")}:00`),
  );
  const isBestNight = (time) => time >= "2026-01-11T22:00" && time <= "2026-01-12T05:00";
  const isPoorNight = (time) => time >= "2026-01-12T22:00" && time <= "2026-01-13T05:00";
  const cloudCover = times.map((time) => (isBestNight(time) ? 5 : isPoorNight(time) ? 95 : 70));
  const lowCloudCover = times.map((time) => (isBestNight(time) ? 0 : isPoorNight(time) ? 80 : 55));

  return {
    latitude: 48.2,
    longitude: 16.98,
    elevation: 162,
    timezone: "Europe/Bratislava",
    timezone_abbreviation: "CET",
    utc_offset_seconds: 3600,
    hourly: {
      time: times,
      temperature_2m: Array(times.length).fill(1),
      apparent_temperature: Array(times.length).fill(-1),
      relative_humidity_2m: Array(times.length).fill(60),
      dew_point_2m: Array(times.length).fill(-3),
      precipitation: Array(times.length).fill(0),
      precipitation_probability: Array(times.length).fill(0),
      precipitation_type: Array(times.length).fill(0),
      weather_code: Array(times.length).fill(0),
      cloud_cover: cloudCover,
      cloud_cover_low: lowCloudCover,
      cloud_cover_mid: cloudCover,
      cloud_cover_high: cloudCover,
      visibility: Array(times.length).fill(12000),
      wind_speed_10m: Array(times.length).fill(6),
      wind_direction_10m: Array(times.length).fill(140),
      pressure_msl: Array(times.length).fill(1020),
    },
    daily: {
      time: dates,
      sunrise: dates.map((date) => `${date}T08:00`),
      sunset: dates.map((date) => `${date}T16:10`),
      daylight_duration: Array(dates.length).fill(29400),
    },
  };
}
