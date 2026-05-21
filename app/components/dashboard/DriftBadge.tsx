import type { Live } from "@/lib/types";
import { IconCheck, IconScale, IconPause } from "@/components/ui/icons";

/** Status pill: paused / balanced / drifting, derived from on-chain drift. */
export function DriftBadge({ live }: { live: Live }) {
  if (live.view.paused) {
    return (
      <span className="badge paused">
        <IconPause width={11} height={11} /> Paused
      </span>
    );
  }
  const drifting = live.maxDriftBps > live.view.thresholdBps;
  if (drifting) {
    return (
      <span className="badge warn">
        <IconScale width={12} height={12} /> Drifting {(live.maxDriftBps / 100).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="badge ok">
      <IconCheck width={12} height={12} /> Balanced
    </span>
  );
}
