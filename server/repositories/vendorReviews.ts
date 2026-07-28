import { eq } from "drizzle-orm";
import { db } from "../db";
import { vendorReviews, type InsertVendorReview } from "../../shared/schema-v2";

export const vendorReviewsRepo = {
  async getAll() {
    return db.select().from(vendorReviews).orderBy(vendorReviews.createdAt);
  },

  async getById(id: number) {
    const [row] = await db.select().from(vendorReviews).where(eq(vendorReviews.id, id));
    return row ?? null;
  },

  async listByVendor(vendorId: number) {
    return db
      .select()
      .from(vendorReviews)
      .where(eq(vendorReviews.vendorId, vendorId))
      .orderBy(vendorReviews.createdAt);
  },

  async create(data: InsertVendorReview) {
    const [row] = await db.insert(vendorReviews).values(data).returning();
    return row;
  },
};
