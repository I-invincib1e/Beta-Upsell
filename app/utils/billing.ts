const PRO_PLAN_NAME = "Pro Plan";
const DEFAULT_TRIAL_DAYS = 14;

export function calculateRemainingTrialDays(
  planToSelect: string,
  existingSubName: string | undefined,
  existingTrialDays: number | undefined,
  existingCreatedAt: string | Date | undefined,
): number {
  if (planToSelect !== PRO_PLAN_NAME) {
    return 0;
  }

  if (!existingSubName || !existingTrialDays || !existingCreatedAt) {
    return DEFAULT_TRIAL_DAYS;
  }

  const createdAt =
    existingCreatedAt instanceof Date
      ? existingCreatedAt
      : new Date(existingCreatedAt);

  const trialEnd = new Date(createdAt);
  trialEnd.setDate(trialEnd.getDate() + existingTrialDays);

  const now = new Date();
  const remainingMs = trialEnd.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

export { PRO_PLAN_NAME, DEFAULT_TRIAL_DAYS };
