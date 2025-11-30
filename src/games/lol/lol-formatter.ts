/**
 * Capitalize first letter, lowercase rest (e.g., "GOLD" -> "Gold")
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format rank display (e.g., "Gold II 67LP", "Master 245LP", "Unranked")
 */
export function formatRankDisplay(
  tier: string | null,
  rank: string | null,
  currentLp: number | null
): string {
  if (!tier) return "Unranked";

  const tierDisplay = capitalize(tier);
  const lpDisplay = `${currentLp ?? 0}LP`;

  // Master+ don't have divisions (I, II, III, IV)
  const highTiers = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  if (highTiers.includes(tier.toUpperCase())) {
    return `${tierDisplay} ${lpDisplay}`;
  }

  return `${tierDisplay} ${rank} ${lpDisplay}`;
}

/**
 * Format LP change with +/- sign
 */
export function formatLpChange(lpChange: number | null): string {
  if (lpChange === null) {
    return "LP: N/A";
  }

  if (lpChange >= 0) {
    return `LP: +${lpChange}`;
  }

  return `LP: ${lpChange}`;
}

/**
 * Format the complete stream record response for LoL
 */
export function formatStreamRecord(
  wins: number,
  losses: number,
  lpChange: number | null,
  tier: string | null = null,
  rank: string | null = null,
  currentLp: number | null = null
): string {
  const rankDisplay = formatRankDisplay(tier, rank, currentLp);
  const recordStr = `${wins}W-${losses}L`;
  const lpStr = formatLpChange(lpChange);

  return `[${rankDisplay}] Stream Record: ${recordStr} | ${lpStr}`;
}

/**
 * Format "no games yet" response with rank
 */
export function formatNoGamesYet(
  tier: string | null = null,
  rank: string | null = null,
  currentLp: number | null = null
): string {
  const rankDisplay = formatRankDisplay(tier, rank, currentLp);
  return `[${rankDisplay}] No ranked games this stream yet!`;
}

/**
 * Format offline response with last session's record
 */
export function formatOfflineRecord(
  wins: number,
  losses: number,
  lpChange: number | null
): string {
  const recordStr = `${wins}W-${losses}L`;
  const lpStr = formatLpChange(lpChange);

  return `Stream is offline. Last stream's record: ${recordStr} | ${lpStr}`;
}
