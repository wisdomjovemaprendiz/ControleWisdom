"use client";
import { useEffect, useState } from "react";
import { QrCode, Trash2 } from "lucide-react";
import { classQrUrl, compressClassQr } from "@/lib/class-qr";
export function ClassQrEditor({
  path,
  onChange,
  onBusy,
}: {
  path?: string | null;
  onChange: (blob: Blob | null, remove: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (path)
      void classQrUrl(path).then((url) => {
        if (active) setPreview(url || "");
      });
    return () => {
      active = false;
    };
  }, [path]);
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <div className="class-qr-editor">
      <div>
        <QrCode size={22} />
        <strong>QR code do grupo</strong>
        <p>
          Se houver um link, o sistema gera o QR code automaticamente. Você
          também pode enviar a imagem fornecida pela unidade.
        </p>
      </div>
      {preview && <img src={preview} alt="Prévia do QR code da turma" />}
      <label className="secondary photo-file-label">
        {busy ? "Processando imagem…" : "Enviar imagem do QR code"}
        <input
          type="file"
          aria-label="Imagem do QR code da turma"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            onBusy(true);
            setError("");
            try {
              const blob = await compressClassQr(file);
              setPreview(URL.createObjectURL(blob));
              onChange(blob, false);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {preview && (
        <button
          className="text-link"
          type="button"
          disabled={busy}
          onClick={() => {
            setPreview("");
            onChange(null, true);
          }}
        >
          <Trash2 size={15} />
          Remover imagem e usar QR automático
        </button>
      )}
      {error && (
        <p role="alert" className="photo-error">
          {error}
        </p>
      )}
    </div>
  );
}
