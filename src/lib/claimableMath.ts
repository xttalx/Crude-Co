/**
 * Claimable amount in minor units, using stored value when present,
 * else deriving from status (same rules as expense creation).
 */
export function effectiveClaimableMinor(
  amountMinor: number,
  deductibilityStatus: string,
  deductibleAmountMinor: number | null,
): number {
  if (deductibleAmountMinor != null) return deductibleAmountMinor;
  switch (deductibilityStatus) {
    case "deductible":
      return amountMinor;
    case "partial":
      return Math.round(amountMinor * 0.5);
    case "non_deductible":
      return 0;
    default:
      return 0;
  }
}
