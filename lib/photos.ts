import { supabase } from "./supabase";
import type { Student } from "./domain";
export const PHOTO_LIMIT = 100 * 1024;
export interface CompressedPhoto {
  blob: Blob;
  extension: "webp" | "jpg";
  width: number;
  height: number;
}
export interface PhotoCrop {
  zoom: number;
  x: number;
  y: number;
}
export const defaultPhotoCrop: PhotoCrop = { zoom: 1, x: 0, y: 0 };
export function photoCropGeometry(
  width: number,
  height: number,
  size: number,
  crop: PhotoCrop,
) {
  const zoom = Math.max(0.1, Math.min(5, crop.zoom));
  const scale = (size / Math.min(width, height)) * zoom;
  const w = width * scale,
    h = height * scale;
  return {
    x:
      (size - w) / 2 +
      Math.max(-1, Math.min(1, crop.x)) * Math.max(size / 2, (w - size) / 2),
    y:
      (size - h) / 2 +
      Math.max(-1, Math.min(1, crop.y)) * Math.max(size / 2, (h - size) / 2),
    width: w,
    height: h,
  };
}
export function drawStudentPhoto(
  context: CanvasRenderingContext2D,
  source: ImageBitmap,
  size: number,
  crop: PhotoCrop,
) {
  const rect = photoCropGeometry(source.width, source.height, size, crop);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
}
export async function compressStudentPhoto(
  file: File,
  crop: PhotoCrop = defaultPhotoCrop,
): Promise<CompressedPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("A foto original deve ter até 10 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Não foi possível abrir a foto. Escolha outro arquivo.");
  }
  try {
    for (const size of [512, 384, 256]) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Seu navegador não conseguiu processar a foto.");
      drawStudentPhoto(context, bitmap, size, crop);
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        let blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", quality),
        );
        if (!blob || blob.type !== "image/webp")
          blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
          );
        if (
          blob &&
          ["image/webp", "image/jpeg"].includes(blob.type) &&
          blob.size <= PHOTO_LIMIT
        )
          return {
            blob,
            extension: blob.type === "image/webp" ? "webp" : "jpg",
            width: size,
            height: size,
          };
      }
    }
    throw new Error(
      "Não foi possível reduzir a foto. Escolha uma imagem menor.",
    );
  } finally {
    bitmap.close();
  }
}
const signed = new Map<string, { url: string; expires: number }>();
const pending = new Map<string, Promise<string | null>>();
export function clearPhotoCache() {
  signed.clear();
  pending.clear();
}
export async function studentPhotoUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const cached = signed.get(path);
  if (cached && cached.expires > Date.now() + 15000) return cached.url;
  if (pending.has(path)) return pending.get(path)!;
  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from("student-photos")
      .createSignedUrl(path, 300);
    if (error || !data) return null;
    signed.set(path, { url: data.signedUrl, expires: Date.now() + 300000 });
    return data.signedUrl;
  })();
  pending.set(path, promise);
  try {
    return await promise;
  } finally {
    pending.delete(path);
  }
}
export interface ReportPhoto {
  id: string;
  name: string;
  data: Uint8Array;
}
export async function photoForReport(
  student: Student,
): Promise<ReportPhoto | null> {
  if (!student.photo_path) return null;
  try {
    const url = await studentPhotoUrl(student.photo_path);
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, 96, 96);
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", 0.8),
      );
      return blob
        ? {
            id: student.id,
            name: student.name,
            data: new Uint8Array(await blob.arrayBuffer()),
          }
        : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
