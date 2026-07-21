import type { SessionMetrics } from "../domain/metrics.js";
import type { NormalizedEvent } from "../domain/event.js";
import type { SessionRecord } from "../domain/session.js";
import type { AuditorConfig } from "../config/config-schema.js";
import type { Recommendation } from "../domain/recommendation.js";

export interface RuleContext {
  metrics: SessionMetrics;
  events: NormalizedEvent[];
  session: SessionRecord;
  config: AuditorConfig;
}

export interface Rule {
  id: string;
  evaluate(ctx: RuleContext): Recommendation | null;
}
