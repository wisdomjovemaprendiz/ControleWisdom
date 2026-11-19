"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export function ReportSection({
  title,
  description,
  icon: Icon,
  children,
  id,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  id: string;
}) {
  const [activated, setActivated] = useState(false);
  return (
    <details
      className="panel report-section"
      data-report-section={id}
      onToggle={(event) => {
        if (event.currentTarget.open) setActivated(true);
      }}
    >
      <summary>
        <span className="report-section-icon">
          <Icon size={21} aria-hidden="true" />
        </span>
        <span className="report-section-heading">
          <h2>{title}</h2>
          <span>{description}</span>
        </span>
        <ChevronDown
          className="report-section-chevron"
          size={19}
          aria-hidden="true"
        />
      </summary>
      {activated && <div className="report-section-body">{children}</div>}
    </details>
  );
}
