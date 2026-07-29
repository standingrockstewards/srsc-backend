/**
 * server/repositories/stewardshipJobs.ts  (Brick 8)
 *
 * All IDs (id, propertyId, sourceEventId, assignedTo) are text.
 * assignedTo has NO hard FK — resolved via assignedToType in the app layer.
 * status, priority, triggerType, jobType are plain text; unions enforced in service.
 */

import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { db } from "../db";
import {
  stewardshipJobs,
  type InsertStewardshipJob,
  type JobStatus,
  type JobPriority,
} from "../../shared/schema-v2";

export interface ListJobsOptions {
  propertyId?:  string;
  status?:      JobStatus;
  assignedTo?:  string;
  from?:        string;   // ISO datetime — lower bound on scheduled_for
  to?:          string;   // ISO datetime — upper bound on scheduled_for
  limit?:       number;
}

export const stewardshipJobsRepo = {
  async create(data: InsertStewardshipJob) {
    const [row] = await db
      .insert(stewardshipJobs)
      .values(data)
      .returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(stewardshipJobs)
      .where(eq(stewardshipJobs.id, id));
    return row ?? null;
  },

  async list(opts: ListJobsOptions = {}) {
    const { propertyId, status, assignedTo, from, to, limit = 200 } = opts;
    const conditions: SQL[] = [];

    if (propertyId)  conditions.push(eq(stewardshipJobs.propertyId, propertyId));
    if (status)      conditions.push(eq(stewardshipJobs.status, status));
    if (assignedTo)  conditions.push(eq(stewardshipJobs.assignedTo, assignedTo));
    if (from)        conditions.push(gte(stewardshipJobs.scheduledFor, new Date(from)));
    if (to)          conditions.push(lte(stewardshipJobs.scheduledFor, new Date(to)));

    const query = db
      .select()
      .from(stewardshipJobs)
      .orderBy(stewardshipJobs.createdAt);

    if (conditions.length > 0) {
      return (query as any).where(and(...conditions)).limit(limit);
    }
    return (query as any).limit(limit);
  },

  /**
   * Transition status + set timestamp fields appropriate to the new state.
   * All callers go through here so state changes stay consistent.
   */
  async transition(
    id: string,
    newStatus: JobStatus,
    extra: {
      assignedTo?:     string | null;
      assignedToType?: string | null;
      scheduledFor?:   Date | null;
      dueBy?:          Date | null;
      notes?:          string | null;
      metadata?:       Record<string, unknown>;
    } = {},
  ) {
    const now = new Date();
    const patch: Record<string, unknown> = {
      status:    newStatus,
      updatedAt: now,
      ...extra,
    };

    if (newStatus === "dispatched")   patch.dispatchedAt = now;
    if (newStatus === "completed")    patch.completedAt  = now;

    const [row] = await db
      .update(stewardshipJobs)
      .set(patch as any)
      .where(eq(stewardshipJobs.id, id))
      .returning();
    return row ?? null;
  },

  async assign(
    id: string,
    assignedTo: string,
    assignedToType: string,
  ) {
    const [row] = await db
      .update(stewardshipJobs)
      .set({ assignedTo, assignedToType, updatedAt: new Date() })
      .where(eq(stewardshipJobs.id, id))
      .returning();
    return row ?? null;
  },
};
