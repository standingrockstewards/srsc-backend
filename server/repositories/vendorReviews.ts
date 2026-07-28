import { eq } from "drizzle-orm";
import { db } from "../db";
import { vendorReviews, vendors, type InsertVendorReview } from "../../shared/schema-v2";

export const vendorReviewsRepo = {
  async listByVendor(vendorId: string) {
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

  async getAggregateForVendor(vendorId: string) {
    const rows = await db
      .select()
      .from(vendorReviews)
      .where(eq(vendorReviews.vendorId, vendorId));
    if (rows.length === 0) return null;
    const avg = (field: keyof typeof rows[0]) =>
      rows.reduce((s, r) => s + Number(r[field]), 0) / rows.length;
    return {
      count: rows.length,
      avgQuality:       avg("ratingQuality"),
      avgTimeliness:    avg("ratingTimeliness"),
      avgCommunication: avg("ratingCommunication"),
      avgCleanup:       avg("ratingCleanup"),
      avgOverall:       avg("overall"),
    };
  },
};
