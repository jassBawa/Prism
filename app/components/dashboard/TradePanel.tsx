"use client";
import { num } from "@/lib/format";

interface Props {
  quoteSym: string;
  depAmt: string;
  wdAmt: string;
  setDepAmt: (v: string) => void;
  setWdAmt: (v: string) => void;
  userBalance: number;
  busy: "deposit" | "withdraw" | null;
  connected: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function TradePanel({
  quoteSym,
  depAmt,
  wdAmt,
  setDepAmt,
  setWdAmt,
  userBalance,
  busy,
  connected,
  onDeposit,
  onWithdraw,
}: Props) {
  return (
    <div className="trade">
      <div className="trade-card">
        <div className="th">
          <span className="t">Deposit {quoteSym}</span>
          <span className="bal">mint basket shares</span>
        </div>
        <div className="field">
          <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" placeholder="0.00" />
          <span className="unit">{quoteSym}</span>
        </div>
        <button className="act" disabled={!connected || busy !== null} onClick={onDeposit}>
          {busy === "deposit" ? (
            <>
              <span className="spinner" /> Depositing…
            </>
          ) : connected ? (
            "Deposit"
          ) : (
            "Connect wallet"
          )}
        </button>
      </div>

      <div className="trade-card">
        <div className="th">
          <span className="t">Withdraw</span>
          <span className="bal">balance {num(userBalance)}</span>
        </div>
        <div className="field">
          <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" placeholder="0.00" />
          {connected && userBalance > 0 ? (
            <button className="maxbtn" onClick={() => setWdAmt(String(userBalance))} type="button">
              MAX
            </button>
          ) : (
            <span className="unit">shares</span>
          )}
        </div>
        <button className="act" disabled={!connected || busy !== null} onClick={onWithdraw}>
          {busy === "withdraw" ? (
            <>
              <span className="spinner" /> Withdrawing…
            </>
          ) : connected ? (
            "Withdraw in-kind"
          ) : (
            "Connect wallet"
          )}
        </button>
      </div>
    </div>
  );
}
