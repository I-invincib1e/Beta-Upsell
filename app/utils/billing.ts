/**
 * Calculates the remaining trial days when a merchant is upgrading or downgrading.
 *
 * @param planToSelect - The name of the plan the merchant wants to subscribe to
 * @param existingSubName - The name of the merchant's current/existing subscription
 * @param existingTrialDays - The total trial days initially granted to the existing subscription
 * @param existingCreatedAt - The date the existing subscription was created
 * @returns The number of trial days remaining, or 0 if no trial should be granted.
 */
export function calculateRemainingTrialDays(
  planToSelect: string,
  existingSubName: string | undefined,
  existingTrialDays: number | undefined,
  existingCreatedAt: string | Date | undefined
): number {
  return 0;
}
