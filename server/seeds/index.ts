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
// Run them individually or list here for documentation purposes.
//
// Seed execution order (run independently via npx tsx):
//   1. server/seeds/kb_articles.seed.ts    — Brick 10j: KB categories + 18 articles
//   2. server/seeds/properties.seed.ts     — Brick 10M: 3 demo customers + 5 demo properties
//
// Running `npx tsx server/seeds/<file>.seed.ts` directly executes that seed.
// This index file serves as the canonical registry of all seeds.

export {};  // keep tsc happy (module file)
