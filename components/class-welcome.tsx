"use client";
import { useEffect, useState } from "react";
import { X, Copy, MessageCircle, RefreshCw } from "lucide-react";
import type { CourseClass, Student } from "@/lib/domain";
import { studentDisplayName } from "@/lib/domain";
import { groupInvitation, validGroupLink } from "@/lib/sales";
import { classQrUrl } from "@/lib/class-qr";
export function ClassWelcome({
  course,
  student,
  onClose,
  onMessage,
}: {
  course: CourseClass;
  student?: Student;
  onClose: () => void;
  onMessage: (text: string, phone: string, title: string) => void;
}) {
  const [generated, setGenerated] = useState(""),
    [custom, setCustom] = useState(""),
    [preferGenerated, setPreferGenerated] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setGenerated("");
    setCustom("");
    setError("");
    if (course.whatsapp && validGroupLink(course.whatsapp))
      void import("qrcode")
        .then((q) =>
          q.toDataURL(course.whatsapp, {
            width: 400,
            margin: 4,
            errorCorrectionLevel: "M",
            color: { dark: "#112e52", light: "#ffffff" },
          }),
        )
        .then((url) => {
          if (active) setGenerated(url);
        })
        .catch(() => {
          if (active)
            setError(
              "Não foi possível gerar o QR code. O link continua disponível.",
            );
        });
    const refresh = () => {
      if (course.whatsapp_qr_path)
        void classQrUrl(course.whatsapp_qr_path).then((url) => {
          if (active) setCustom(url || "");
        });
    };
    refresh();
    const timer = setInterval(refresh, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [course.id, course.whatsapp, course.whatsapp_qr_path]);
  const valid = Boolean(course.whatsapp && validGroupLink(course.whatsapp)),
    image = !preferGenerated && custom ? custom : generated;
  return (
    <div className="modal-overlay">
      <section
        className="modal class-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">BOAS-VINDAS À WISDOM</span>
            <h2 id="welcome-title">Grupo da turma</h2>
            <p>{course.name}</p>
            {student && <p>{studentDisplayName(student)}</p>}
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar grupo da turma"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="welcome-body">
          {valid || custom ? (
            <>
              <div className="welcome-qr">
                {image ? (
                  <img src={image} alt={`QR code do grupo ${course.name}`} />
                ) : (
                  <p>Preparando QR code…</p>
                )}
              </div>
              <p className="welcome-instruction">
                Abra a câmera do celular e aponte para o QR code para entrar no
                grupo.
              </p>
              {custom && valid && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setPreferGenerated(!preferGenerated)}
                >
                  <RefreshCw size={15} />
                  {preferGenerated
                    ? "Usar imagem da secretaria"
                    : "Usar QR gerado a partir do link"}
                </button>
              )}
              {!valid && (
                <p className="welcome-instruction">
                  Use o QR code fornecido pela secretaria. Cadastre também o
                  link para preparar os convites pelo WhatsApp.
                </p>
              )}
              {valid && (
                <div className="welcome-link">
                  <a href={course.whatsapp} target="_blank" rel="noreferrer">
                    {course.whatsapp}
                  </a>
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(course.whatsapp);
                        setCopied(true);
                      } catch {
                        setError(
                          "Não foi possível copiar. Selecione e copie o link exibido.",
                        );
                      }
                    }}
                  >
                    <Copy size={16} />
                    {copied ? "Copiado" : "Copiar link"}
                  </button>
                </div>
              )}
              {student && valid && (
                <div className="welcome-recipients">
                  <button
                    className="primary"
                    disabled={!student.phone}
                    onClick={() =>
                      onMessage(
                        groupInvitation(student, course, "student"),
                        student.phone,
                        "Convite para o aluno",
                      )
                    }
                  >
                    <MessageCircle size={18} />
                    Enviar convite ao aluno
                  </button>
                  {!student.phone && (
                    <small>
                      Informe o telefone do aluno para preparar o convite.
                    </small>
                  )}
                  <button
                    className="secondary"
                    disabled={!student.guardian_phone}
                    onClick={() =>
                      onMessage(
                        groupInvitation(student, course, "guardian"),
                        student.guardian_phone,
                        "Convite para o responsável",
                      )
                    }
                  >
                    <MessageCircle size={18} />
                    Enviar convite ao responsável
                  </button>
                  {!student.guardian_phone && (
                    <small>
                      Informe o telefone do responsável para preparar o convite.
                    </small>
                  )}
                </div>
              )}
              <p className="welcome-instruction">
                As mensagens serão abertas para revisão. O envio pelo WhatsApp é
                manual.
              </p>
            </>
          ) : (
            <p>
              A secretaria ainda precisa configurar um link válido do grupo
              desta turma.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
