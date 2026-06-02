import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateRemainingTrialDays, PRO_PLAN_NAME } from "./billing";

describe("calculateRemainingTrialDays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns full trial for new Pro subscription", () => {
    const result = calculateRemainingTrialDays(
      PRO_PLAN_NAME,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toBe(14);
  });

  it("returns 0 when downgrading to free", () => {
    const result = calculateRemainingTrialDays("Free Plan", PRO_PLAN_NAME, 14, new Date());
    expect(result).toBe(0);
  });

  it("returns remaining days for in-progress trial", () => {
    const createdAt = new Date("2026-05-01T12:00:00Z");
    const result = calculateRemainingTrialDays(
      PRO_PLAN_NAME,
      PRO_PLAN_NAME,
      14,
      createdAt,
    );
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(14);
  });
});
