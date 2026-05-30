"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Modal } from "@/components/ui/Modal";
import { CopyAddr } from "@/components/ui/CopyAddr";
import { PROGRAM_ID } from "@/lib/constants";
import {
  readConfig,
  saveConfig,
  resetConfig,
  type Net,
  type RpcMode,
} from "@/lib/connection";
import { IconSettings, IconLogout } from "@/components/ui/icons";

const VERSION = "0.1.0";

/** Bottom-of-sidebar Settings (connection config) + Sign out (wallet disconnect). */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { connected, disconnect } = useWallet();
  const signOut = () => void disconnect().catch(() => {});

  const saved = readConfig();
  const [net, setNet] = useState<Net>(saved?.net ?? "devnet");
  const [mode, setMode] = useState<RpcMode>(saved?.mode ?? "public");
  const [customUrl, setCustomUrl] = useState(saved?.customUrl ?? "");

  const dirty =
    net !== (saved?.net ?? "devnet") ||
    mode !== (saved?.mode ?? "public") ||
    customUrl.trim() !== (saved?.customUrl ?? "");
  const canSave = dirty && (mode === "public" || customUrl.trim().length > 0);

  const apply = () => {
    saveConfig({ net, mode, customUrl });
    window.location.reload();
  };
  const reset = () => {
    resetConfig();
    window.location.reload();
  };

  return (
    <>
      <button className="side-action" onClick={() => setOpen(true)}>
        <IconSettings width={17} height={17} /> Settings
      </button>
      {connected && (
        <button className="side-action side-action-danger" onClick={signOut}>
          <IconLogout width={17} height={17} /> Sign out
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="settings">
          <div className="settings-head">
            <h2>Settings</h2>
            <p>Appearance and the connection the app talks to.</p>
          </div>

          <div className="set-field">
            <span className="set-flabel">Network</span>
            <div className="segmented">
              <button
                type="button"
                className={"seg" + (net === "devnet" ? " on" : "")}
                onClick={() => setNet("devnet")}
              >
                Devnet
              </button>
              <button type="button" className="seg" disabled title="Coming soon">
                Mainnet <span className="seg-soon">Soon</span>
              </button>
            </div>
          </div>

          <div className="set-field">
            <span className="set-flabel">RPC endpoint</span>
            <div className="segmented">
              <button
                type="button"
                className={"seg" + (mode === "public" ? " on" : "")}
                onClick={() => setMode("public")}
              >
                Public
              </button>
              <button
                type="button"
                className={"seg" + (mode === "custom" ? " on" : "")}
                onClick={() => setMode("custom")}
              >
                Custom URL
              </button>
            </div>
            {mode === "public" ? (
              <span className="set-hint mono">https://api.{net}.solana.com</span>
            ) : (
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-rpc.example.com"
                spellCheck={false}
              />
            )}
          </div>

          <div className="settings-rows">
            <div className="setrow">
              <span className="setrow-k">Program</span>
              <span className="setrow-v">
                <CopyAddr addr={PROGRAM_ID.toBase58()} link />
              </span>
            </div>
            <div className="setrow">
              <span className="setrow-k">Version</span>
              <span className="setrow-v">v{VERSION}</span>
            </div>
          </div>

          <div className="settings-foot">
            <button className="btn" onClick={reset} disabled={!saved}>
              Reset
            </button>
            <button className="act settings-save" onClick={apply} disabled={!canSave}>
              Save &amp; reload
            </button>
          </div>

          {connected && (
            <button
              className="settings-signout"
              onClick={() => {
                signOut();
                setOpen(false);
              }}
            >
              <IconLogout width={15} height={15} /> Disconnect wallet
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
