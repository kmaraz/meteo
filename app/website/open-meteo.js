const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_REVERSE_GEOCODING_URL = "https://nominatim.openstreetmap.org/reverse";
const DEFAULT_TIMEZONE = "Europe/Bratislava";
const DEFAULT_MODEL = "best_match";
export const FORECAST_MODELS = [
  { group: "Automatic", value: "best_match", label: "Best Match" },
  { group: "Central Europe", value: "icon_d2", label: "DWD ICON D2" },
  { group: "Central Europe", value: "geosphere_arome_austria", label: "GeoSphere AROME Austria" },
  { group: "Central Europe", value: "knmi_harmonie_arome_europe", label: "KNMI HARMONIE-AROME Europe" },
  { group: "Central Europe", value: "dmi_harmonie_arome_europe", label: "DMI HARMONIE-AROME Europe" },
  { group: "Europe", value: "icon_seamless", label: "DWD ICON Seamless" },
  { group: "Europe", value: "icon_eu", label: "DWD ICON EU" },
  { group: "Europe", value: "geosphere_seamless", label: "GeoSphere Seamless" },
  { group: "Europe", value: "meteofrance_seamless", label: "Meteo-France Seamless" },
  { group: "Europe", value: "meteofrance_arpege_europe", label: "Meteo-France ARPEGE Europe" },
  { group: "Europe", value: "meteofrance_arpege_world", label: "Meteo-France ARPEGE World" },
  { group: "Europe", value: "knmi_seamless", label: "KNMI Seamless" },
  { group: "Europe", value: "dmi_seamless", label: "DMI Seamless" },
  { group: "Europe", value: "ukmo_seamless", label: "UKMO Seamless" },
  { group: "Global baseline", value: "ecmwf_ifs", label: "ECMWF IFS HRES 9 km" },
  { group: "Global baseline", value: "ecmwf_ifs025", label: "ECMWF IFS 0.25" },
  { group: "Global baseline", value: "ecmwf_aifs025", label: "ECMWF AIFS 0.25" },
  { group: "Global baseline", value: "gfs_seamless", label: "NOAA GFS Seamless" },
  { group: "Global baseline", value: "gfs_global", label: "NOAA GFS Global" },
  { group: "Global baseline", value: "gfs_graphcast025", label: "NOAA GFS GraphCast" },
  { group: "Global baseline", value: "ukmo_global_deterministic_10km", label: "UKMO Global 10 km" },
];
const FORECAST_MODEL_BY_VALUE = new Map(FORECAST_MODELS.map((model) => [model.value, model]));
const VIEW_START_HOURS = new Map([
  ["midnight", 0],
  ["midday", 12],
  ["night", 22],
]);

export const HOURS = [
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
];

const HOURLY_VARIABLES = [
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

const DAILY_VARIABLES = ["sunrise", "sunset", "daylight_duration"];

const PRECIPITATION_TYPES = new Map([
  [0, ""],
  [1, "Rain"],
  [3, "Freezing rain"],
  [5, "Snow"],
  [6, "Wet snow"],
  [7, "Rain/snow"],
  [8, "Ice pellets"],
  [12, "Freezing drizzle"],
]);

const COMPASS_CLASSES = [
  "north",
  "north-north-east",
  "north-east",
  "east-north-east",
  "east",
  "east-south-east",
  "south-east",
  "south-south-east",
  "south",
  "south-south-west",
  "south-west",
  "west-south-west",
  "west",
  "west-north-west",
  "north-west",
  "north-north-west",
];

const SUN_COLORS = {
  night: "#000000",
  darkTwilight: "#2B5695",
  twilight: "#4B7BC0",
  horizon: "#F0B076",
  day: "#FFFE88",
  transit: "#F0707F",
};

export function buildOpenMeteoUrl({ lat, lon, timezone = DEFAULT_TIMEZONE, model = DEFAULT_MODEL }) {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", formatCoordinate(lat));
  url.searchParams.set("longitude", formatCoordinate(lon));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("forecast_days", "8");
  url.searchParams.set("models", normalizeForecastModel(model));
  url.searchParams.set("hourly", HOURLY_VARIABLES.join(","));
  url.searchParams.set("daily", DAILY_VARIABLES.join(","));
  return url;
}

export function buildGeocodingUrl(name) {
  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.searchParams.set("name", name.trim());
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "sk");
  url.searchParams.set("countryCode", "SK");
  return url;
}

export function buildReverseGeocodingUrl({ lat, lon }) {
  const url = new URL(NOMINATIM_REVERSE_GEOCODING_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", formatCoordinate(lat));
  url.searchParams.set("lon", formatCoordinate(lon));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "sk");
  return url;
}

export function normalizeOpenMeteoForecast(response, options) {
  const timezone = response.timezone || DEFAULT_TIMEZONE;
  const maxDays = options.maxDays ?? 7;
  const current = currentDateHour(options.now || new Date(), timezone);
  const view = normalizeForecastView(options.view);
  const model = normalizeForecastModel(options.model);
  const startHour = view === "current" ? current.hour : VIEW_START_HOURS.get(view);
  const hourlyIndex = buildHourlyIndex(response.hourly);
  const days = response.daily.time.slice(0, maxDays).map((date) => {
    const { slots, slotKeys } = buildObservingSlots(date, hourlyIndex, startHour);
    const currentHourIndex = slotKeys.indexOf(current.key);
    return {
      id: date,
      name: weekdayName(date, timezone),
      date: String(Number(date.slice(8, 10))),
      currentHourIndex,
      lightSlots: lightSlots(slotKeys, response.daily),
      daylightGradient: daylightGradient(slotKeys, response.daily),
      moon: approximateMoon(date),
      sun: dailySun(response.daily, date),
      hours: slots.map((slot) => observingClass(slot)),
      detailRows: detailRows(slots),
    };
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "Open-Meteo",
      model,
      modelLabel: forecastModelLabel(model),
      locationName: options.locationName || "Selected location",
      requested: {
        latitude: Number(options.lat),
        longitude: Number(options.lon),
      },
      resolved: {
        latitude: response.latitude,
        longitude: response.longitude,
        elevation: response.elevation,
      },
      timezone,
      timezoneAbbreviation: response.timezone_abbreviation,
      view,
      currentDate: current.date,
      currentHour: padHour(current.hour),
      forecastFrom: days[0]?.id,
      forecastTo: days.at(-1)?.id,
    },
    hours: hourSequence(startHour),
    days,
  };
}

export function normalizeForecastModel(model) {
  const value = String(model || DEFAULT_MODEL).trim();
  return FORECAST_MODEL_BY_VALUE.has(value) ? value : DEFAULT_MODEL;
}

export function forecastModelLabel(model) {
  return FORECAST_MODEL_BY_VALUE.get(normalizeForecastModel(model)).label;
}

export function normalizeGeocodingResponse(response) {
  return {
    results: (response.results || []).map((result) => ({
      id: result.id,
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      elevation: result.elevation,
      country: result.country,
      countryCode: result.country_code,
      admin1: result.admin1,
      admin2: result.admin2,
      timezone: result.timezone,
      label: [result.name, result.admin2, result.admin1, result.country].filter(Boolean).join(", "),
    })),
  };
}

export function normalizeReverseGeocodingResponse(response, fallbackLabel = "") {
  const address = response.address || {};
  const primary = firstPresent(
    address.amenity,
    address.tourism,
    address.attraction,
    address.hamlet,
    address.neighbourhood,
    address.suburb,
    address.village,
    address.town,
    address.city,
    address.municipality,
    response.name,
    address.road,
  );
  const parent = firstDifferent(
    primary,
    address.suburb,
    address.village,
    address.town,
    address.city,
    address.municipality,
    address.state_district,
  );
  const label = [primary, parent].filter(Boolean).join(", ") || shortDisplayName(response.display_name) || fallbackLabel;

  return {
    label,
    name: response.name || primary || "",
    displayName: response.display_name || "",
    address,
  };
}

export function validateCoordinate(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new TypeError(`${name} must be a number between ${min} and ${max}`);
  }
  return number;
}

function formatCoordinate(value) {
  return String(Number(value));
}

function firstPresent(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function firstDifferent(primary, ...values) {
  return values.find((value) => typeof value === "string" && value.trim() && value.trim() !== primary)?.trim() || "";
}

function shortDisplayName(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function buildHourlyIndex(hourly) {
  const index = new Map();
  hourly.time.forEach((time, position) => {
    index.set(time, readHour(hourly, position));
  });
  return index;
}

function readHour(hourly, position) {
  return Object.fromEntries(
    HOURLY_VARIABLES.map((variable) => [variable, hourly[variable]?.[position] ?? null]),
  );
}

function buildObservingSlots(date, hourlyIndex, startHour = 22) {
  const slots = [];
  const slotKeys = [];
  for (let offset = 0; offset < 24; offset += 1) {
    const hour = (startHour + offset) % 24;
    const slotDate = addDays(date, Math.floor((startHour + offset) / 24));
    const key = `${slotDate}T${padHour(hour)}:00`;
    slotKeys.push(key);
    slots.push(hourlyIndex.get(key) || emptyHour());
  }
  return { slots, slotKeys };
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function emptyHour() {
  return Object.fromEntries(HOURLY_VARIABLES.map((variable) => [variable, null]));
}

function lightSlots(slotKeys, daily) {
  return slotKeys.map((key) => lightSlot(key, daily));
}

function daylightGradient(slotKeys, daily) {
  const start = localMinuteFromSlotKey(slotKeys[0]);
  const end = start + 24 * 60;
  const rawStops = sunGradientStops(daily).sort((left, right) => left.minute - right.minute);
  const visibleStops = rawStops.filter((stop) => stop.minute > start && stop.minute < end);
  const stops = [
    { minute: start, color: colorAtMinute(start, rawStops) },
    ...visibleStops,
    { minute: end, color: colorAtMinute(end, rawStops) },
  ];

  return `linear-gradient(to right, ${stops
    .map((stop) => `${stop.color} ${formatPercent(((stop.minute - start) / (24 * 60)) * 100)}%`)
    .join(", ")})`;
}

function sunGradientStops(daily) {
  return daily.time.flatMap((date, position) => {
    if (!daily.sunrise[position] || !daily.sunset[position]) {
      return [];
    }

    const rise = localMinuteFromDateTime(daily.sunrise[position]);
    const set = localMinuteFromDateTime(daily.sunset[position]);
    const transit = rise + (set - rise) / 2;

    return [
      { minute: rise - 150, color: SUN_COLORS.night },
      { minute: rise - 135, color: SUN_COLORS.darkTwilight },
      { minute: rise - 95, color: SUN_COLORS.darkTwilight },
      { minute: rise - 80, color: SUN_COLORS.twilight },
      { minute: rise - 50, color: SUN_COLORS.twilight },
      { minute: rise - 35, color: SUN_COLORS.horizon },
      { minute: rise - 15, color: SUN_COLORS.horizon },
      { minute: rise, color: SUN_COLORS.day },
      { minute: transit - 14.4, color: SUN_COLORS.day },
      { minute: transit, color: SUN_COLORS.transit },
      { minute: transit + 14.4, color: SUN_COLORS.day },
      { minute: set, color: SUN_COLORS.day },
      { minute: set + 15, color: SUN_COLORS.horizon },
      { minute: set + 35, color: SUN_COLORS.horizon },
      { minute: set + 50, color: SUN_COLORS.twilight },
      { minute: set + 80, color: SUN_COLORS.twilight },
      { minute: set + 95, color: SUN_COLORS.darkTwilight },
      { minute: set + 135, color: SUN_COLORS.darkTwilight },
      { minute: set + 150, color: SUN_COLORS.night },
    ];
  });
}

function colorAtMinute(minute, stops) {
  const previous = stops.findLast((stop) => stop.minute <= minute);
  return previous?.color || stops[0]?.color || SUN_COLORS.night;
}

function lightSlot(key, daily) {
  const date = key.slice(0, 10);
  const hour = Number(key.slice(11, 13));
  const sun = sunMinutes(daily, date);
  if (!sun) {
    return "night";
  }

  const start = hour * 60;
  const end = start + 60;
  const midpoint = start + 30;
  if (sun.rise >= start && sun.rise < end) {
    return "dawn";
  }
  if (sun.set >= start && sun.set < end) {
    return "dusk";
  }
  return midpoint >= sun.rise && midpoint < sun.set ? "day" : "night";
}

function sunMinutes(daily, date) {
  const position = daily.time.indexOf(date);
  if (position === -1 || !daily.sunrise[position] || !daily.sunset[position]) {
    return null;
  }
  return {
    rise: minutesPart(daily.sunrise[position]),
    set: minutesPart(daily.sunset[position]),
  };
}

function minutesPart(value) {
  const time = timePart(value);
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function localMinuteFromSlotKey(key) {
  return localMinute(key.slice(0, 10), Number(key.slice(11, 13)) * 60);
}

function localMinuteFromDateTime(value) {
  return localMinute(value.slice(0, 10), minutesPart(value));
}

function localMinute(date, minutes) {
  return Date.parse(`${date}T00:00:00Z`) / 60000 + minutes;
}

function formatPercent(value) {
  return String(round(value, 2));
}

function normalizeForecastView(view) {
  if (view === "midnight" || view === "midday" || view === "night") {
    return view;
  }
  return "current";
}

function hourSequence(startHour) {
  return Array.from({ length: 24 }, (_, offset) => padHour((startHour + offset) % 24));
}

function currentDateHour(now, timezone) {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentDate = `${values.year}-${values.month}-${values.day}`;
  const currentHour = Number(values.hour);
  return {
    date: currentDate,
    hour: currentHour,
    key: `${currentDate}T${padHour(currentHour)}:00`,
  };
}

function padHour(hour) {
  return String(hour).padStart(2, "0");
}

function weekdayName(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone,
  }).format(new Date(`${date}T12:00:00Z`));
}

function dailySun(daily, date) {
  const position = daily.time.indexOf(date);
  if (position === -1) {
    return { rise: "", set: "", daylightHours: null };
  }

  return {
    rise: timePart(daily.sunrise[position]),
    set: timePart(daily.sunset[position]),
    daylightHours: round(daily.daylight_duration[position] / 3600, 1),
  };
}

function timePart(value) {
  return value ? value.slice(11, 16) : "";
}

function approximateMoon(date) {
  const synodicMonth = 29.53058867;
  const referenceNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const current = Date.parse(`${date}T12:00:00Z`);
  const age = positiveModulo((current - referenceNewMoon) / 86400000, synodicMonth);
  const phase = age / synodicMonth;
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);

  return {
    phase: moonPhaseName(phase),
    phaseValue: round(phase, 3),
    illumination,
    waxing: phase < 0.5,
  };
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function moonPhaseName(phase) {
  if (phase < 0.03 || phase >= 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Third Quarter";
  return "Waning Crescent";
}

function detailRows(slots) {
  return [
    cloudRow("Total Clouds (% Sky Obscured)", slots, "cloud_cover"),
    cloudRow("Low Clouds (% Sky Obscured)", slots, "cloud_cover_low"),
    cloudRow("Medium Clouds (% Sky Obscured)", slots, "cloud_cover_mid"),
    cloudRow("High Clouds (% Sky Obscured)", slots, "cloud_cover_high"),
    ratingRow("Visibility (km)", slots, "visibility", (value) => round(value / 1000, 1), visibilityClass),
    ratingRow("Fog (%)", slots, "weather_code", fogValue, (value) => (fogValue(value) > 0 ? "bad" : "good")),
    noneRow("Precipitation Type", slots, "precipitation_type", (value) => PRECIPITATION_TYPES.get(value) ?? ""),
    ratingRow("Precipitation Probability (%)", slots, "precipitation_probability", identity, precipitationProbabilityClass),
    ratingRow("Precipitation Amount (mm)", slots, "precipitation", (value) => round(value, 1), precipitationAmountClass),
    windRow(slots),
    noneRow("Chance of Frost", slots, "temperature_2m", (value) => (value <= 0 ? "Frost" : "")),
    ratingRow("Temperature (\u00b0C)", slots, "temperature_2m", Math.round, temperatureClass),
    ratingRow("Feels Like (\u00b0C)", slots, "apparent_temperature", Math.round, temperatureClass),
    ratingRow("Dew Point (\u00b0C)", slots, "dew_point_2m", Math.round, () => "good"),
    ratingRow("Relative Humidity (%)", slots, "relative_humidity_2m", Math.round, humidityClass),
    noneRow("Pressure (hPa)", slots, "pressure_msl", Math.round),
  ];
}

function cloudRow(label, slots, key) {
  return {
    label,
    type: "cloud",
    values: slots.map((slot) => nullableRound(slot[key])),
  };
}

function ratingRow(label, slots, key, transform, classify) {
  return {
    label,
    type: "rating",
    values: slots.map((slot) => nullableTransform(slot[key], transform)),
    classes: slots.map((slot) => nullableClass(slot[key], classify)),
  };
}

function noneRow(label, slots, key, transform) {
  return {
    label,
    type: "none",
    values: slots.map((slot) => nullableTransform(slot[key], transform)),
  };
}

function windRow(slots) {
  return {
    label: "Wind Speed/Direction (km/h)",
    type: "wind",
    values: slots.map((slot) => nullableRound(slot.wind_speed_10m)),
    classes: slots.map((slot) => `${compassClass(slot.wind_direction_10m)} ${windClass(slot.wind_speed_10m)}`),
  };
}

function nullableRound(value) {
  return value === null ? "" : Math.round(value);
}

function nullableTransform(value, transform) {
  return value === null ? "" : transform(value);
}

function nullableClass(value, classify) {
  return value === null ? "none" : classify(value);
}

function observingClass(slot) {
  const cloud = slot.cloud_cover ?? 100;
  const precipitation = slot.precipitation ?? 99;
  const precipitationProbability = slot.precipitation_probability ?? 100;
  const visibility = slot.visibility ?? 0;
  const wind = slot.wind_speed_10m ?? 999;

  if (cloud <= 25 && precipitation <= 0.1 && precipitationProbability <= 10 && visibility >= 8000 && wind <= 15) {
    return "good";
  }
  if (cloud <= 65 && precipitation <= 1 && precipitationProbability <= 50 && visibility >= 4000 && wind <= 30) {
    return "ok";
  }
  return "bad";
}

function visibilityClass(value) {
  if (value >= 8000) return "good";
  if (value >= 4000) return "ok";
  return "bad";
}

function precipitationProbabilityClass(value) {
  if (value <= 10) return "good";
  if (value <= 50) return "ok";
  return "bad";
}

function precipitationAmountClass(value) {
  if (value <= 0.1) return "good";
  if (value <= 1) return "ok";
  return "bad";
}

function temperatureClass(value) {
  if (value <= -5 || value >= 28) return "bad";
  if (value <= 2 || value >= 22) return "ok";
  return "good";
}

function humidityClass(value) {
  if (value >= 90) return "bad";
  if (value >= 80) return "ok";
  return "good";
}

function windClass(value) {
  if (value === null) return "none";
  if (value <= 15) return "good";
  if (value <= 30) return "ok";
  return "bad";
}

function compassClass(degrees) {
  if (degrees === null) return "north";
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_CLASSES[index];
}

function fogValue(weatherCode) {
  return weatherCode === 45 || weatherCode === 48 ? 100 : 0;
}

function identity(value) {
  return value;
}

function round(value, precision = 0) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
