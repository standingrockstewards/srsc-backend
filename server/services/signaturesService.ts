/**
 * server/services/signaturesService.ts
 *
 * Evidentiary e-signature capture.
 * - IP address and userAgent are injected server-side (or passed in directly).
 * - legalDocumentId links to the exact document version signed (text FK).
 * - Append-only: no update or delete paths exposed.
 * - All customer IDs are text (nanoid/cuid2).
 */

import { customerSignaturesRepo } from "../repositories/customerSignatures";
import { legalDocumentsRepo } from "../repositories/legalDocuments";

export interface CaptureSignatureInput {
  customerId:       string;           // text — no parseInt
  legalDocumentId?: string | null;    // text FK to legal_documents.id (optional)
  signatureSvg:     string;
  signedDocument:   string;
  ipAddress?:       string | null;
  userAgent?:       string | null;
}

export const signaturesService = {
  /**
   * Capture a signature.
   * If legalDocumentId is provided, verifies the document exists.
   */
  async capture(input: CaptureSignatureInput) {
    if (input.legalDocumentId) {
      const doc = await legalDocumentsRepo.getById(input.legalDocumentId);
      if (!doc) {
        throw Object.assign(
          new Error(`Legal document '${input.legalDocumentId}' not found`),
          { status: 404 },
        );
      }
    }

    return customerSignaturesRepo.create({
      customerId:      input.customerId,
      legalDocumentId: input.legalDocumentId ?? undefined,
      signatureSvg:    input.signatureSvg,
      signedDocument:  input.signedDocument,
      ipAddress:       input.ipAddress ?? undefined,
      userAgent:       input.userAgent ?? undefined,
    });
  },

  async hasSignedActive(customerId: string, docType: string): Promise<boolean> {
    return customerSignaturesRepo.hasSignedActive(customerId, docType);
  },

  async listForCustomer(customerId: string) {
    return customerSignaturesRepo.listByCustomer(customerId);
  },
};
