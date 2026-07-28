/**
 * Vendor scoring service.
 * On every new review: recompute running average of `overall` and bump reviewCount.
 * publicScore is only exposed when reviewCount >= minReviewsForDisplay.
 * All vendor IDs are text (nanoid/cuid2).
 */

import { eq, avg, count } from "drizzle-orm";
import { db } from "../db";
import { vendorReviews, vendors } from "../../shared/schema-v2";
import { vendorsRepo } from "../repositories/vendors";
import { vendorReviewsRepo } from "../repositories/vendorReviews";
import type { InsertVendorReview } from "../../shared/schema-v2";

export const vendorScoringService = {
  /**
   * Submit a review and recompute the vendor's running average + count.
   */
  async submitReview(data: InsertVendorReview) {
    const review = await vendorReviewsRepo.create(data);

    const [agg] = await db
      .select({
        avgScore: avg(vendorReviews.overall),
        total:    count(vendorReviews.id),
      })
      .from(vendorReviews)
      .where(eq(vendorReviews.vendorId, data.vendorId));

    const newScore = agg?.avgScore
      ? parseFloat(agg.avgScore).toFixed(2)
      : "0.00";
    const newCount = Number(agg?.total ?? 0);

    await vendorsRepo.updateScore(data.vendorId, newScore, newCount);

    return review;
  },

  /**
   * Return public scorecard. Score is gated: returns null when reviewCount < minReviewsForDisplay.
   */
  async scorecard(vendorId: string) {
    const vendor = await vendorsRepo.getById(vendorId);
    if (!vendor) return null;

    const reviews      = await vendorReviewsRepo.listByVendor(vendorId);
    const scoreVisible = vendor.reviewCount >= (vendor.minReviewsForDisplay ?? 3);

    const dims = reviews.length
      ? {
          quality:       avg4(reviews.map((r) => r.ratingQuality)),
          timeliness:    avg4(reviews.map((r) => r.ratingTimeliness)),
          communication: avg4(reviews.map((r) => r.ratingCommunication)),
          cleanup:       avg4(reviews.map((r) => r.ratingCleanup)),
        }
      : null;

    return {
      vendorId,
      name:                 vendor.name,
      reviewCount:          vendor.reviewCount,
      publicScore:          scoreVisible ? vendor.publicScore : null,
      scoreVisible,
      minReviewsForDisplay: vendor.minReviewsForDisplay,
      dimensionAverages:    scoreVisible ? dims : null,
    };
  },
};

function avg4(vals: (number | null | undefined)[]): string {
  const filtered = vals.filter((v): v is number => v != null);
  if (!filtered.length) return "0.00";
  const sum = filtered.reduce((a, b) => a + b, 0);
  return (sum / filtered.length).toFixed(2);
}
