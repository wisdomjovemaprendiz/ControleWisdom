"use client";
export function WhatsAppPreview({ text }: { text: string }) {
  return (
    <div className="whatsapp-preview" aria-label="Prévia da mensagem formatada">
      <div className="whatsapp-bubble">
        {text.split("\n").map((line, i) => (
          <div className="whatsapp-line" key={i}>
            {line ? (
              line
                .split(/(\*[^*]+\*|_[^_]+_)/g)
                .map((part, j) =>
                  part.startsWith("*") && part.endsWith("*") ? (
                    <strong key={j}>{part.slice(1, -1)}</strong>
                  ) : part.startsWith("_") && part.endsWith("_") ? (
                    <em key={j}>{part.slice(1, -1)}</em>
                  ) : (
                    <span key={j}>{part}</span>
                  ),
                )
            ) : (
              <br />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
