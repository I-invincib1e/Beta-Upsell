import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateRemainingTrialDays } from './billing';

describe('calculateRemainingTrialDays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 when no existing subscription data', () => {
    const result = calculateRemainingTrialDays('Pro Plan', undefined, undefined, undefined);
    expect(result).toBe(0);
  });

  it('should return 0 when existing trial days is 0', () => {
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 0, '2026-05-08T12:00:00Z');
    expect(result).toBe(0);
  });

  it('should return 0 when re-subscribing to the same plan', () => {
    const result = calculateRemainingTrialDays('Pro Plan', 'Pro Plan', 3, '2026-05-09T12:00:00Z');
    expect(result).toBe(0);
  });

  it('should return remaining trial days when switching plans mid-trial', () => {
    // Created 1 day ago with 3 day trial => 2 days remaining
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 3, '2026-05-09T12:00:00Z');
    expect(result).toBe(2);
  });

  it('should return 0 when trial has fully elapsed', () => {
    // Created 5 days ago with 3 day trial => 0 remaining
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 3, '2026-05-05T12:00:00Z');
    expect(result).toBe(0);
  });

  it('should return full trial days when switching plans on creation day', () => {
    // Created today with 3 day trial => 3 remaining
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 3, '2026-05-10T12:00:00Z');
    expect(result).toBe(3);
  });

  it('should never return negative values', () => {
    // Created 100 days ago with 3 day trial
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 3, '2026-02-01T12:00:00Z');
    expect(result).toBe(0);
  });
});
