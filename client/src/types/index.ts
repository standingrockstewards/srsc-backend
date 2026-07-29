/**
 * API types matching the live v2 schema.
 * All id / FK fields are string (text/cuid2). No integers on IDs.
 * Money columns (creditBalance, targetRetainerAmount, bonusCreditAmount, amount)
 * are string because pg numeric comes back as string from the JSON driver.
 */

export interface Customer {
  id: string;
  email: string;
  name: string;
  role: string;
  creditBalance: string;
  activePropertyCount: number;
  createdAt: string;
}

export interface Property {
  id: string;
  customerId: string;           // text FK — never a number
  nickname: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  serviceTier: string | null;
  targetRetainerAmount: string;
  lowBalanceAlertPct: number;
  discountTierPct: number;
  active: boolean;
  // Brick 3.5 — nullable; returned as numeric string or null from Postgres
  latitude: string | null;
  longitude: string | null;
  nearestShorelineMarker: string | null;
  billingState: string;
  createdAt: string;
  updatedAt: string;
}

/** Property row augmented with currentBalance from GET /retainer/low-balance */
export interface LowBalanceProperty extends Property {
  currentBalance: string;
}

export interface Referral {
  id: string;
  referrerCustomerId: string;   // text FK
  referredCustomerId: string;   // text FK
  status: string;               // pending | qualified | vested | cancelled | expired
  bonusCreditAmount: string;
  vestsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountCredit {
  id: string;
  customerId: string;           // text FK
  amount: string;
  source: string;               // 'referral:<id>' | 'refund' | 'adjustment'
  applied: boolean;
  createdAt: string;
}

// ── Auth types ────────────────────────────────────────────────────────────────

export type UserRole =
  | "admin"
  | "supervisor"
  | "field_tech"
  | "client"
  | "vendor";

export interface AuthUser {
  id: number;           // v1 users table PK — integer; NOT an API resource ID
  username: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface Permissions {
  [key: string]: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  customerId: string | null;    // text (cuid2) if client role, null otherwise
  role: UserRole;
  permissions: Permissions;
}

export interface StewardshipJob {
  id: string;
  propertyId: string;           // text FK
  sourceEventId: string | null;
  triggerType: string;
  jobType: string;
  status: string;               // pending|scheduled|dispatched|in_progress|completed|cancelled
  priority: string;
  assignedTo: string | null;
  assignedToType: string | null;
  scheduledFor: string | null;
  dueBy: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
