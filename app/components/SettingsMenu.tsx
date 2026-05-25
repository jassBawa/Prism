"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Modal } from "@/components/ui/Modal";
import { CopyAddr } from "@/components/ui/CopyAddr";
import { NETWORK } from "@/components/PrismProvider";
import { RPC_URL, PROGRAM_ID } from "@/lib/constants";
import { IconSettings, IconLogout, IconExternal } from "@/components/ui/icons";

const VERSION = "0.1.0";

/** Bottom-of-sidebar Settings (opens an info modal) + Sign out (wallet disconnect). */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { connected, disconnect } = useWallet();
  const signOut = () => void disconnect().catch(() => {});

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
            <p>The network and deployment this app is connected to.</p>
          </div>
          <div className="settings-rows">
            <div className="setrow">
              <span className="setrow-k">Network</span>
              <span className="setrow-v">
                <span className="netpill">
                  <span className="dot" /> {NETWORK}
                </span>
              </span>
            </div>
            <div className="setrow">
              <span className="setrow-k">RPC endpoint</span>
              <span className="setrow-v mono">{RPC_URL}</span>
            </div>
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
          <a className="settings-link" href="https://github.com/jassBawa/Prism" target="_blank" rel="noreferrer">
            Help &amp; documentation <IconExternal width={13} height={13} />
          </a>
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
