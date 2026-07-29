/**
 * server/repositories/integrationSources.ts  (Brick 8)
 *
 * Provider registry — one row per (provider × property) pair,
 * or a global row with property_id NULL for provider-wide defaults.
 *
 * All IDs are text (nanoid/cuid2).
 * config is jsonb — read/write as plain JS objects; the service layer
 * interprets rule thresholds, secret refs, etc. from it at runtime.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  integrationSources,
  type InsertIntegrationSource,
} from "../../shared/schema-v2";

export const integrationSourcesRepo = {
  async getAll() {
    return db
      .select()
      .from(integrationSources)
      .orderBy(integrationSources.provider, integrationSources.createdAt);
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(integrationSources)
      .where(eq(integrationSources.id, id));
    return row ?? null;
  },

  /**
   * Look up the integration source for a (provider, propertyId) pair.
   * Returns the property-specific row first; falls back to the global row
   * (property_id IS NULL) if no property-specific one exists.
   */
  async getByProviderAndProperty(
    provider: string,
    propertyId: string,
  ) {
    // Try property-specific first
    const [specific] = await db
      .select()
      .from(integrationSources)
      .where(
        and(
          eq(integrationSources.provider, provider),
          eq(integrationSources.propertyId, propertyId),
        ),
      )
      .limit(1);
    if (specific) return specific;

    // Fall back to global (property_id IS NULL) for this provider
    const [global] = await db
      .select()
      .from(integrationSources)
      .where(eq(integrationSources.provider, provider))
      .limit(1);
    return global ?? null;
  },

  async listByProvider(provider: string) {
    return db
      .select()
      .from(integrationSources)
      .where(eq(integrationSources.provider, provider))
      .orderBy(integrationSources.createdAt);
  },

  async listByProperty(propertyId: string) {
    return db
      .select()
      .from(integrationSources)
      .where(eq(integrationSources.propertyId, propertyId))
      .orderBy(integrationSources.provider);
  },

  async create(data: InsertIntegrationSource) {
    const [row] = await db
      .insert(integrationSources)
      .values(data)
      .returning();
    return row;
  },

  async update(id: string, data: Partial<InsertIntegrationSource>) {
    const [row] = await db
      .update(integrationSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(integrationSources.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(integrationSources).where(eq(integrationSources.id, id));
  },
};
