import { supabase } from "./supabase";
export async function compressClassQr(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Envie uma imagem PNG, JPG ou WebP de até 10 MB.");
  const image = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    for (const size of [1024, 768, 512]) {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, size / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível processar a imagem.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (blob && blob.size <= 358400) return blob;
    }
    throw new Error(
      "Use uma imagem apenas com o QR code para mantê-la nítida e com até 350 KB.",
    );
  } finally {
    image.close();
  }
}
export async function classQrUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from("class-qr-codes")
    .createSignedUrl(path, 300);
  return error ? null : data?.signedUrl || null;
}
