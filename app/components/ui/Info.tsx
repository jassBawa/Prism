"use client";
import { useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { IconInfo } from "@/components/ui/icons";

/** A small (i) affordance that reveals a plain-language explanation of a term.
 *  Opens on hover, keyboard focus, or tap (touch-friendly). */
export function Info({ k, align = "left" }: { k: GlossaryKey; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const e = GLOSSARY[k];
  return (
    <span className="info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="info-btn"
        aria-label={`What is ${e.term}?`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <IconInfo width={13} height={13} />
      </button>
      {open && (
        <span className={"info-pop " + align} role="tooltip">
          <span className="info-term">{e.term}</span>
          <span className="info-body">{e.body}</span>
        </span>
      )}
    </span>
  );
}
