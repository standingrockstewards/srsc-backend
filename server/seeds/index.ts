/**
 * server/seeds/index.ts  (Brick 10j)
 *
 * Seed runner — executes all seed files in order.
 * Safe to re-run: every seed uses upsert (ON CONFLICT DO UPDATE).
 *
 * Usage:
 *   npx tsx server/seeds/index.ts
 */

// Each seed file is a self-contained script with its own main().
// We import them by executing their runSeed export.
// For now, kb_articles.seed.ts is the only seed.

export {};  // keep tsc happy (module file)

// Note: running `npx tsx server/seeds/kb_articles.seed.ts` directly
// executes that seed. This index file exists as a hook for future
// multi-seed orchestration.
