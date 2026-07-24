// Offline draft storage — in-memory fallback (visit data is persisted to backend)
import type { OfflineDraft } from "../../../shared/schema";

// Simple in-memory store — survives within the same browser session
const draftsStore = new Map<string, OfflineDraft>();

export async function saveDraft(draft: OfflineDraft): Promise<void> {
  draftsStore.set(draft.id, draft);
}

export async function getDraft(id: string): Promise<OfflineDraft | undefined> {
  return draftsStore.get(id);
}

export async function getAllDrafts(): Promise<OfflineDraft[]> {
  return Array.from(draftsStore.values());
}

export async function deleteDraft(id: string): Promise<void> {
  draftsStore.delete(id);
}

// Compress image to < 800KB base64
export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const MAX_DIM = 1200;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Generate a simple UUID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
