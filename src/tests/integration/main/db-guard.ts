/**
 * Guard for integration tests that need a Docker container / external binary.
 *
 * Locally, when the dependency is missing, tests skip gracefully (returns false → the test
 * early-returns). In CI, set `REQUIRE_DB_TESTS=1` so a missing dependency FAILS the run
 * instead of silently passing — preventing a "green" CI that actually exercised nothing.
 */
export const requireOrSkip = (available: boolean, label: string): boolean => {
  if (available) return true
  if (process.env.REQUIRE_DB_TESTS === '1') {
    throw new Error(`${label} is unavailable but REQUIRE_DB_TESTS=1 — failing instead of skipping a backup/restore integration test`)
  }
  console.warn(`Skipping — ${label} unavailable`)
  return false
}
