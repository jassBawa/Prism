"use client";
import { useState } from "react";
import { shortAddr, explorerAddr } from "@/lib/format";
import { IconCopy, IconCheck, IconExternal } from "@/components/ui/icons";

/** Short address + copy button (+ optional explorer link). */
export function CopyAddr({ addr, link = false }: { addr: string; link?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copyaddr">
      <span className="ca-text">{shortAddr(addr, 4)}</span>
      <button
        type="button"
        className="ca-btn"
        aria-label="Copy address"
        onClick={() => {
          void navigator.clipboard?.writeText(addr);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
      </button>
      {link && (
        <a className="ca-btn" href={explorerAddr(addr)} target="_blank" rel="noreferrer" aria-label="View on explorer">
          <IconExternal width={12} height={12} />
        </a>
      )}
    </span>
  );
}
