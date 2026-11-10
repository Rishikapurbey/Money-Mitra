import { useState } from "react";
import api from "../../lib/api";
import { inputClass } from "../../lib/ui";
import { Panel, SectionHeader, Status } from "./shared";
import { errorMessage, idle, primaryButton, secondaryButton, useSettings } from "./context";

// The UPI ID friends use to pay you back in shared groups
export function PaymentsSection() {
  const { me, updateMe } = useSettings();
  const [edited, setEdited] = useState<string | null>(null);
  const [state, setState] = useState(idle);
  const saved = me?.upiId ?? "";
  const upiId = edited ?? saved;

  const save = async (value: string) => {
    setState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/upi", { upiId: value });
      updateMe({ upiId: res.data.upiId });
      setEdited(null);
      setState({ busy: false, error: "", success: res.data.upiId ? "UPI ID saved" : "UPI ID removed" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't save your UPI ID."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader title="Payments" description="Make it easy for friends in your shared groups to pay you back." />
      <Panel
        title="UPI ID"
        description="When someone in a shared group owes you, they get a button that opens their UPI app with your UPI ID and the amount filled in."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(upiId.trim());
          }}
          className="space-y-4"
        >
          <input
            value={upiId}
            onChange={(e) => setEdited(e.target.value)}
            placeholder="name@okaxis"
            aria-label="UPI ID"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`${inputClass} w-full max-w-md`}
            disabled={!me}
          />
          <p className="-mt-2 text-xs text-ink-500">
            Only people in your groups who owe you money see it, and only while you're both in the group. It's never shown on your
            profile or in Discuss. Many UPI IDs include a phone number, so use one you're comfortable sharing with them.
          </p>
          <Status {...state} />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={state.busy || !me || !upiId.trim() || upiId.trim().toLowerCase() === saved} className={primaryButton}>
              {state.busy ? "Saving…" : "Save UPI ID"}
            </button>
            {saved && (
              <button type="button" onClick={() => save("")} disabled={state.busy} className={secondaryButton}>
                Remove
              </button>
            )}
          </div>
        </form>
      </Panel>
    </>
  );
}
