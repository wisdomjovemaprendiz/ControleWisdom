"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Move, ZoomIn } from "lucide-react";
import type { Student } from "@/lib/domain";
import {
  compressStudentPhoto,
  drawStudentPhoto,
  photoCropGeometry,
  defaultPhotoCrop,
  studentPhotoUrl,
  type CompressedPhoto,
  type PhotoCrop,
} from "@/lib/photos";
import { CameraCapture } from "./camera-capture";
import { StudentAvatar, PhotoZoom } from "./student-avatar";
export function StudentPhotoEditor({
  student,
  onChange,
  onBusy,
}: {
  student?: Student;
  onChange: (photo: CompressedPhoto | null, remove: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [previewZoom, setPreviewZoom] = useState(0);
  const [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [removed, setRemoved] = useState(false),
    [bytes, setBytes] = useState(0),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState<{ file: File; bitmap: ImageBitmap } | null>(
      null,
    ),
    [crop, setCrop] = useState<PhotoCrop>(defaultPhotoCrop),
    [cameraOpen, setCameraOpen] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<{ x: number; y: number; crop: PhotoCrop } | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => () => source?.bitmap.close(), [source]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx && source) drawStudentPhoto(ctx, source.bitmap, 512, crop);
  }, [source, crop]);
  async function select(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("Escolha JPG, PNG ou WebP de até 10 MB.");
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      setSource({ file, bitmap });
      setCrop(defaultPhotoCrop);
    } catch (e) {
      setError((e as Error).message);
      onBusy(false);
    } finally {
      setBusy(false);
    }
  }
  async function existing() {
    if (!student?.photo_path) return;
    setBusy(true);
    onBusy(true);
    try {
      const url = await studentPhotoUrl(student.photo_path);
      if (!url) throw new Error("Foto indisponível.");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Foto indisponível.");
      const blob = await response.blob();
      await select(new File([blob], "foto-atual", { type: blob.type }));
    } catch (e) {
      setError((e as Error).message);
      onBusy(false);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const result = await compressStudentPhoto(source.file, crop);
      setPreview(URL.createObjectURL(result.blob));
      setBytes(result.blob.size);
      setRemoved(false);
      onChange(result, false);
      setSource(null);
      onBusy(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    setSource(null);
    onBusy(false);
  }
  return (
    <div className="student-photo-editor">
      {preview && previewZoom > 0 && (
        <PhotoZoom
          url={preview}
          student={student || { id: "novo", name: "Foto do aluno" }}
          size={previewZoom}
          onClose={() => setPreviewZoom(0)}
        />
      )}
      <div className="photo-editor-preview">
        {preview ? (
          <button
            type="button"
            className="photo-preview-button"
            aria-label="Ampliar prévia da foto"
            onClick={(e) =>
              setPreviewZoom(e.currentTarget.getBoundingClientRect().width)
            }
          >
            <img src={preview} alt="Prévia da foto comprimida" />
          </button>
        ) : student && !removed ? (
          <StudentAvatar student={student} size={76} />
        ) : (
          <Camera size={27} />
        )}
      </div>
      <div>
        <strong>Foto de identificação</strong>
        <p>
          Ajuste o rosto na moldura. A foto será comprimida para até 512 × 512
          px e 100 KB.
        </p>
        <div className="photo-editor-actions">
          <label className="secondary photo-file-label">
            <Camera size={15} />
            {busy ? "Processando…" : "Escolher foto"}
            <input
              type="file"
              aria-label="Foto do aluno"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || !!source || cameraOpen}
              onChange={(e) => {
                void select(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={busy || !!source || cameraOpen}
            onClick={() => {
              setError("");
              setCameraOpen(true);
              onBusy(true);
            }}
          >
            <Camera size={16} />
            Usar câmera
          </button>
          {student?.photo_path && !source && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void existing()}
            >
              Ajustar foto atual
            </button>
          )}
          {(preview || student?.photo_path) && !removed && !source && (
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
              <Trash2 size={14} />
              Remover
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
      {cameraOpen && (
        <CameraCapture
          onClose={() => {
            setCameraOpen(false);
            onBusy(false);
          }}
          onPhoto={(file) => {
            setCameraOpen(false);
            void select(file);
          }}
        />
      )}
      {source && (
        <div className="photo-crop-workspace">
          <div className="photo-crop-heading">
            <ZoomIn size={19} />
            <strong>Enquadrar o rosto</strong>
          </div>
          <p>
            Arraste a imagem ou use os controles. Confira a moldura antes de
            aplicar.
          </p>
          <canvas
            ref={canvas}
            width={512}
            height={512}
            aria-label="Moldura de enquadramento da foto"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, crop };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const size = e.currentTarget.getBoundingClientRect().width;
              const geometry = photoCropGeometry(
                source.bitmap.width,
                source.bitmap.height,
                size,
                crop,
              );
              const horizontal = Math.max(
                size / 2,
                (geometry.width - size) / 2,
              );
              const vertical = Math.max(size / 2, (geometry.height - size) / 2);
              setCrop({
                ...crop,
                x: Math.max(
                  -1,
                  Math.min(
                    1,
                    drag.current.crop.x +
                      (e.clientX - drag.current.x) / horizontal,
                  ),
                ),
                y: Math.max(
                  -1,
                  Math.min(
                    1,
                    drag.current.crop.y +
                      (e.clientY - drag.current.y) / vertical,
                  ),
                ),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
          <label>
            Zoom da foto · {Math.round(crop.zoom * 100)}%
            <input
              aria-label="Zoom da foto"
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={crop.zoom}
              onChange={(e) =>
                setCrop({ ...crop, zoom: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Posição horizontal
            <input
              aria-label="Posição horizontal da foto"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={crop.x}
              onChange={(e) => setCrop({ ...crop, x: Number(e.target.value) })}
            />
          </label>
          <label>
            Posição vertical
            <input
              aria-label="Posição vertical da foto"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={crop.y}
              onChange={(e) => setCrop({ ...crop, y: Number(e.target.value) })}
            />
          </label>
          <div className="photo-crop-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                setCrop({
                  zoom: Math.min(
                    1,
                    Math.min(source.bitmap.width, source.bitmap.height) /
                      Math.max(source.bitmap.width, source.bitmap.height),
                  ),
                  x: 0,
                  y: 0,
                })
              }
            >
              <Move size={16} />
              Mostrar foto inteira
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={cancel}
            >
              Cancelar ajuste
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void apply()}
            >
              Aplicar enquadramento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
