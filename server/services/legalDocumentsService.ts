/**
 * server/services/legalDocumentsService.ts
 *
 * Business-logic wrapper for legal document versioning.
 * Enforces: at most one active document per docType (atomic swap).
 * IDs are nanoid text strings — compatible with the live DB's text PK.
 */

import { nanoid } from "nanoid";
import { legalDocumentsRepo } from "../repositories/legalDocuments";

export interface CreateLegalDocInput {
  docType:       string;
  version:       string;
  bodyMd:        string;
  effectiveDate: string; // YYYY-MM-DD
  active?:       boolean;
}

export const legalDocumentsService = {
  /**
   * Create a new document version.
   * If active=true, atomically deactivates the prior active version for that docType.
   * Returns the newly created row.
   */
  async create(input: CreateLegalDocInput) {
    const id = nanoid();
    return legalDocumentsRepo.createWithAtomicActivate({
      id,
      docType:       input.docType,
      version:       input.version,
      bodyMd:        input.bodyMd,
      effectiveDate: input.effectiveDate,
      active:        input.active ?? false,
    });
  },

  /** Return the single active version for a docType, or null. */
  async getActive(docType: string) {
    return legalDocumentsRepo.getActiveByType(docType);
  },

  /** Return all versions for a docType, oldest-first. */
  async listVersions(docType: string) {
    return legalDocumentsRepo.listByType(docType);
  },
};
