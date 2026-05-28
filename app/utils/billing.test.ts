import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateRemainingTrialDays } from './billing';

describe('calculateRemainingTrialDays', () => {
  beforeEach(() => {
    // Mock the current date to a fixed point for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should always return 0 since there are no trial plans', () => {
    const result = calculateRemainingTrialDays('Pro Plan', undefined, undefined, undefined);
    expect(result).toBe(0);
  });
});
