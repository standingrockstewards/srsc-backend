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
  name: string;
  address: string;
  targetRetainerAmount: string;
  lowBalanceAlertPct: number;
  discountTierPct: number;
  createdAt: string;
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
