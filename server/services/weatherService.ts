/**
 * server/services/weatherService.ts  (Brick 8)
 *
 * Evaluates per-property weather rules and spawns forward-scheduled
 * stewardship_jobs when thresholds are exceeded.
 *
 * Design:
 *   - runWeatherCheck() accepts INJECTED weather data so it is fully
 *     testable without a live API key.
 *   - Each property's weather rules live in integration_sources.config
 *     (keyed by provider = "weather"). No hardcoded thresholds.
 *   - A triggered job gets status = "scheduled" and scheduledFor set
 *     ahead of the event (configurable via config.scheduleOffsetMs,
 *     default 2 hours before).
 *
 * ── WEATHER API SEAM ─────────────────────────────────────────────────────────
 * To fetch live weather, replace the call sites that call runWeatherCheck()
 * with a function that:
 *   1. Reads the API key from process.env[config.apiKeyRef ?? "WEATHER_API_KEY"]
 *   2. Fetches data from the provider (OpenWeatherMap, NWS, etc.)
 *   3. Normalises to WeatherData and passes to runWeatherCheck()
 * The runWeatherCheck() function itself never touches network — it only
 * evaluates rules. This keeps the seam clean and the service testable.
 * ── END SEAM ─────────────────────────────────────────────────────────────────
 *
 * All IDs are text. No parseInt on any ID or FK.
 */

import { integrationSourcesRepo } from "../repositories/integrationSources";
import { stewardshipJobsRepo } from "../repositories/stewardshipJobs";
import { propertiesRepo } from "../repositories/properties";
import type { StewardshipJob } from "../../shared/schema-v2";

// ── Weather data shape ────────────────────────────────────────────────────────

export interface WeatherData {
  windSpeedMph:      number;
  windGustMph?:      number;
  wavesHeightFt?:    number;
  precipInches?:     number;
  lightningWithin5?: boolean;          // any lightning strike within 5 nmi
  severityLabel?:    string;           // "WATCH" | "WARNING" | "ADVISORY" etc.
  observedAt:        Date;
  [key: string]: unknown;              // open for provider-specific extra fields
}

// ── Rule config shape (from integration_sources.config for provider "weather") ──

interface WeatherRuleConfig {
  apiKeyRef?:          string;         // env var name for the weather API key (seam)
  windGustThreshMph?:  number;         // default 35
  waveHeightThreshFt?: number;         // default 3
  lightningTrigger?:   boolean;        // default true
  scheduleOffsetMs?:   number;         // ms before event to schedule job (default 7_200_000 = 2h)
  jobType?:            string;         // default "response"
  priority?:           string;         // default "urgent"
}

const DEFAULTS: Required<WeatherRuleConfig> = {
  apiKeyRef:          "WEATHER_API_KEY",
  windGustThreshMph:  35,
  waveHeightThreshFt: 3,
  lightningTrigger:   true,
  scheduleOffsetMs:   2 * 60 * 60 * 1000,  // 2 hours
  jobType:            "response",
  priority:           "urgent",
};

// ── Rule evaluation ───────────────────────────────────────────────────────────

function evaluateRules(
  weather: WeatherData,
  config: WeatherRuleConfig,
): { triggered: boolean; reasons: string[] } {
  const c = { ...DEFAULTS, ...config };
  const reasons: string[] = [];

  const gust = weather.windGustMph ?? weather.windSpeedMph;
  if (gust >= c.windGustThreshMph) {
    reasons.push(`Wind gust ${gust} mph ≥ threshold ${c.windGustThreshMph} mph`);
  }
  if (c.waveHeightThreshFt && (weather.wavesHeightFt ?? 0) >= c.waveHeightThreshFt) {
    reasons.push(`Wave height ${weather.wavesHeightFt} ft ≥ threshold ${c.waveHeightThreshFt} ft`);
  }
  if (c.lightningTrigger && weather.lightningWithin5) {
    reasons.push("Lightning detected within 5 nmi");
  }
  if (weather.severityLabel && ["WARNING", "WATCH"].includes(weather.severityLabel.toUpperCase())) {
    reasons.push(`NWS severity: ${weather.severityLabel}`);
  }

  return { triggered: reasons.length > 0, reasons };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface WeatherCheckResult {
  propertyId:  string;
  triggered:   boolean;
  reasons:     string[];
  job:         StewardshipJob | null;
}

export const weatherService = {
  /**
   * runWeatherCheck(propertyId, weatherData)
   *
   * Evaluates the weather rules for one property against injected weather data.
   * Spawns a forward-scheduled stewardship job when any rule fires.
   * Returns the result — caller decides whether to send notifications.
   */
  async runWeatherCheck(
    propertyId: string,
    weather:    WeatherData,
  ): Promise<WeatherCheckResult> {
    // Load the weather integration source for this property
    const source = await integrationSourcesRepo.getByProviderAndProperty(
      "weather",
      propertyId,
    );

    // No source → not configured for weather monitoring; skip silently
    if (!source || !source.enabled) {
      return { propertyId, triggered: false, reasons: ["Weather monitoring not configured or disabled"], job: null };
    }

    const config = (source.config ?? {}) as WeatherRuleConfig;
    const { triggered, reasons } = evaluateRules(weather, config);

    if (!triggered) {
      return { propertyId, triggered: false, reasons, job: null };
    }

    if (!source.autoCreateJob) {
      return { propertyId, triggered: true, reasons, job: null };
    }

    // Schedule the job ahead of the weather event
    const c = { ...DEFAULTS, ...config };
    const scheduledFor = new Date(weather.observedAt.getTime() - c.scheduleOffsetMs);

    const job = await stewardshipJobsRepo.create({
      propertyId,
      sourceEventId: null,    // no monitoring_event row for weather checks (no ingest step)
      triggerType:   "weather",
      jobType:       c.jobType,
      priority:      c.priority,
      status:        "scheduled",
      scheduledFor,
      notes:         `Weather auto-response: ${reasons.join("; ")}`,
      metadata:      {
        provider:   "weather",
        sourceId:   source.id,
        weatherSnapshot: {
          windSpeedMph:      weather.windSpeedMph,
          windGustMph:       weather.windGustMph,
          wavesHeightFt:     weather.wavesHeightFt,
          lightningWithin5:  weather.lightningWithin5,
          severityLabel:     weather.severityLabel,
          observedAt:        weather.observedAt.toISOString(),
        },
        triggeredBy: reasons,
      },
    });

    return { propertyId, triggered: true, reasons, job };
  },

  /**
   * runWeatherCheckAllProperties(weatherByPropertyId)
   *
   * Convenience: run weather checks for multiple properties in one call.
   * weatherByPropertyId is a map of propertyId → WeatherData (injected by caller).
   * Returns one result per property.
   */
  async runWeatherCheckAllProperties(
    weatherByPropertyId: Record<string, WeatherData>,
  ): Promise<WeatherCheckResult[]> {
    return Promise.all(
      Object.entries(weatherByPropertyId).map(([propertyId, weather]) =>
        weatherService.runWeatherCheck(propertyId, weather),
      ),
    );
  },
};
