/**
 * server/services/signaturesService.ts
 *
 * Evidentiary e-signature capture.
 * - IP address and userAgent are injected server-side from the Express request.
 * - legalDocumentId links to the exact document version signed (text FK).
 * - Append-only: no update or delete paths exposed.
 * - hasSignedActive: join-based check used by onboarding/portal (Brick 12).
 */

import type { Request } from "express";
import { customerSignaturesRepo } from "../repositories/customerSignatures";
import { legalDocumentsRepo } from "../repositories/legalDocuments";

export interface CaptureSignatureInput {
  customerId:      number;
  legalDocumentId: string;   // text FK to legal_documents.id
  signatureSvg:    string;
  signedDocument:  string;   // snapshot of doc body at time of signing (varchar 100 label)
}

export const signaturesService = {
  /**
   * Capture a signature.
   * Verifies the referenced legalDocumentId exists before inserting.
   * Server injects ipAddress + userAgent from the Express request.
   */
  async capture(input: CaptureSignatureInput, req: Request) {
    // Verify the document exists
    const doc = await legalDocumentsRepo.getById(input.legalDocumentId);
    if (!doc) {
      throw Object.assign(new Error(`Legal document '${input.legalDocumentId}' not found`), { status: 404 });
    }

    const ipAddress = (
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      null
    );
    const userAgent = req.headers["user-agent"] ?? null;

    return customerSignaturesRepo.create({
      customerId:      input.customerId,
      legalDocumentId: input.legalDocumentId,
      signatureSvg:    input.signatureSvg,
      signedDocument:  input.signedDocument,
      ipAddress:       ipAddress ?? undefined,
      userAgent:       userAgent ?? undefined,
    });
  },

  /**
   * Returns true if the customer has a signature row whose linked legal_documents
   * row is active=true and matches the given docType.
   * Used by Brick 12 onboarding/portal gate.
   */
  async hasSignedActive(customerId: number, docType: string): Promise<boolean> {
    return customerSignaturesRepo.hasSignedActive(customerId, docType);
  },

  async listByCustomer(customerId: number) {
    return customerSignaturesRepo.listByCustomer(customerId);
  },
};
