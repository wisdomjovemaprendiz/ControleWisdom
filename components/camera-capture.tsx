"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
export function CameraCapture({
  onPhoto,
  onClose,
}: {
  onPhoto: (file: File) => void;
  onClose: () => void;
}) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const video = useRef<HTMLVideoElement>(null),
    [facing, setFacing] = useState<"user" | "environment">("environment"),
    [device, setDevice] = useState(""),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [taking, setTaking] = useState(false);
  useEffect(() => {
    let cancelled = false,
      stream: MediaStream | undefined;
    setReady(false);
    setError("");
    async function open() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("unsupported");
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(device
              ? { deviceId: { exact: device } }
              : { facingMode: { ideal: facing } }),
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          next.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = next;
        if (video.current) {
          video.current.srcObject = next;
          void video.current.play().catch(() => {});
        }
        const available = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled)
          setDevices(available.filter((d) => d.kind === "videoinput"));
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "O navegador não permitiu a câmera. Libere o acesso nas permissões do site, ou use a opção de câmera do celular abaixo."
            : name === "NotFoundError"
              ? "Nenhuma câmera foi encontrada. Conecte uma webcam ou escolha uma foto."
              : "Não foi possível abrir a câmera. Confira se ela está em uso e se o site está aberto por HTTPS.",
        );
      }
    }
    void open();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [device, facing]);
  async function capture() {
    if (!video.current || !ready) return;
    setTaking(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.current.videoWidth;
      canvas.height = video.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível capturar.");
      ctx.drawImage(video.current, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Não foi possível capturar.");
      if (alive.current)
        onPhoto(new File([blob], "foto-camera.jpg", { type: "image/jpeg" }));
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setTaking(false);
    }
  }
  return (
    <section
      className="camera-capture"
      aria-label="Captura de foto pela câmera"
    >
      <div className="photo-crop-heading">
        <Camera size={20} />
        <strong>Câmera / webcam</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar câmera"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p>
        Permita o uso da câmera. Ao tirar a foto, você poderá ajustar o rosto
        antes de salvar.
      </p>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        onCanPlay={() => setReady(true)}
        aria-label="Prévia ao vivo da câmera"
      />
      {error && (
        <p role="alert" className="photo-error">
          {error}
        </p>
      )}
      {devices.length > 1 && (
        <label>
          Selecionar câmera
          <select value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="">Câmera automática</option>
            {devices.map((d, i) => (
              <option value={d.deviceId} key={d.deviceId}>
                {d.label || `Câmera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="photo-crop-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setDevice("");
            setFacing(facing === "environment" ? "user" : "environment");
          }}
        >
          <RefreshCw size={16} />
          Alternar câmera
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancelar câmera
        </button>
        <button
          type="button"
          className="primary"
          disabled={!ready || taking}
          onClick={() => void capture()}
        >
          <Camera size={17} />
          {taking ? "Capturando…" : "Tirar foto"}
        </button>
      </div>
      <label className="secondary photo-file-label native-camera">
        <Camera size={16} />
        Abrir câmera do celular
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Foto pela câmera do celular"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPhoto(file);
            e.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
