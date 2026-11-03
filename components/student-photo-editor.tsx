"use client";
import { useEffect, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import type { Student } from "@/lib/domain";
import { compressStudentPhoto, type CompressedPhoto } from "@/lib/photos";
import { StudentAvatar } from "./student-avatar";
export function StudentPhotoEditor({
  student,
  onChange,
  onBusy,
}: {
  student?: Student;
  onChange: (photo: CompressedPhoto | null, remove: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [removed, setRemoved] = useState(false),
    [bytes, setBytes] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function select(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const result = await compressStudentPhoto(file);
      setPreview(URL.createObjectURL(result.blob));
      setBytes(result.blob.size);
      setRemoved(false);
      onChange(result, false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="student-photo-editor">
      <div className="photo-editor-preview">
        {preview ? (
          <img src={preview} alt="Prévia da foto comprimida" />
        ) : student && !removed ? (
          <StudentAvatar student={student} size={76} />
        ) : (
          <Camera size={27} />
        )}
      </div>
      <div>
        <strong>Foto de identificação</strong>
        <p>
          JPG, PNG ou WebP. A foto é ajustada automaticamente para até 512 × 512
          px e 100 KB.
        </p>
        <div className="photo-editor-actions">
          <label className="secondary photo-file-label">
            <Camera size={15} />
            {busy ? "Comprimindo…" : "Escolher foto"}
            <input
              type="file"
              aria-label="Foto do aluno"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => void select(e.target.files?.[0])}
            />
          </label>
          {(preview || student?.photo_path) && !removed && (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setPreview("");
                setBytes(0);
                setRemoved(true);
                onChange(null, true);
              }}
            >
              <Trash2 size={14} /> Remover
            </button>
          )}
        </div>
        {bytes > 0 && (
          <small>
            Foto pronta: {Math.ceil(bytes / 1024)} KB • armazenamento privado
          </small>
        )}
        {error && (
          <p className="photo-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
