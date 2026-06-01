/**
 * MOCK_MODE — single source of truth for the offline dry-run flag.
 *
 * When NEXT_PUBLIC_MOCK_MODE=true, every external dependency is short-circuited
 * with canned data so the entire flow runs without burning quota and without
 * any external key. Mock logic lives in lib/mock/*; production code paths are
 * not forked, they call mock helpers behind the flag.
 */

export const MOCK_MODE: boolean =
  process.env.NEXT_PUBLIC_MOCK_MODE === "true" ||
  process.env.NEXT_PUBLIC_MOCK_MODE === "on";

export function isMockMode(): boolean {
  return MOCK_MODE;
}
