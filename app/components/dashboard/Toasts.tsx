"use client";
import type { Toast } from "@/lib/types";
import { IconCheck, IconAlert, IconClose, IconRefresh } from "@/components/ui/icons";

export function Toasts({ items, onDismiss }: { items: Toast[]; onDismiss: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="ti" style={{ color: tint(t.kind) }}>
            {t.kind === "ok" ? <IconCheck /> : t.kind === "err" ? <IconAlert /> : <IconRefresh className="spin-slow" width={15} height={15} />}
          </span>
          <div className="tmsg">
            {t.msg}
            {t.sub && <div className="sub">{t.sub}</div>}
          </div>
          <button
            className="btn"
            style={{ padding: 4, border: "none", background: "transparent", color: "var(--muted)", marginLeft: "auto" }}
            onClick={() => onDismiss(t.id)}
            aria-label="dismiss"
          >
            <IconClose width={14} height={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function tint(kind: Toast["kind"]): string {
  return kind === "ok" ? "var(--ok)" : kind === "err" ? "var(--danger)" : "var(--accent)";
}
