import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Copy, ExternalLink } from "lucide-react";
import api from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatINR } from "../../lib/ui";
import { toInputDate, transactionTimestamp } from "../../lib/dates";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { upiLink } from "../../lib/shared";
import type { GroupDetail, Payment } from "../../lib/shared";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

// Paying a group member back through a UPI app. Money Mitra never sees the payment itself, so once
// the person comes back it asks whether it went through and records it as a normal payback.
function UpiPayPanel({ group, payment, onDone }: { group: GroupDetail; payment: Payment & { upiId: string }; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  // Phones and tablets have UPI apps to open; on a computer the QR code is scanned with a phone instead
  const touch = useMediaQuery("(pointer: coarse)");
  const [opened, setOpened] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const payee = group.members.find((m) => m.id === payment.toMemberId)?.name ?? "them";
  const amountText = formatINR(payment.amount);
  const link = upiLink({ upiId: payment.upiId, name: payee, amount: payment.amount, note: `Money Mitra: ${group.name}` });

  useEffect(() => {
    if (touch) return;
    let live = true;
    // Loaded only when needed, so the library stays out of every other page
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(link, { width: 220, margin: 1 }))
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [link, touch]);

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ message: `${what} copied` });
    } catch {
      toast({ message: `We couldn't copy the ${what.toLowerCase()}` });
    }
  };

  const record = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/shared/groups/${group.id}/settlements`, {
        fromMemberId: payment.fromMemberId,
        toMemberId: payment.toMemberId,
        amount: payment.amount,
        date: transactionTimestamp(toInputDate(new Date())),
      });
      toast({ message: `Recorded: you paid ${payee} ${amountText}` });
      onDone(true);
    } catch (err) {
      setError(errorText(err, "We couldn't record the payment. Please try again."));
      setBusy(false);
    }
  };

  const copyRow = (label: string, value: string, copyValue: string) => (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="font-medium text-ink-900 truncate tabular-nums">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => copy(copyValue, label)}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-ink-700 border border-line hover:bg-ink-100 transition"
      >
        <Copy size={14} /> Copy
      </button>
    </div>
  );

  return (
    <section className="bg-surface border border-brand-500 ring-2 ring-brand-100 rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-ink-900">
          Pay {payee} {amountText}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {touch
            ? "Opens your UPI app with the details filled in. Check them before you pay."
            : "Scan this with any UPI app on your phone. Check the name and amount before you pay."}
        </p>
      </div>

      {opened ? (
        <div className="rounded-xl bg-brand-50/60 border border-line p-4 space-y-3">
          <p className="font-medium text-ink-900">
            Did you pay {payee} {amountText}?
          </p>
          <p className="text-sm text-ink-500">Money Mitra can't see your bank, so let us know and we'll record it for the group.</p>
          {error && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={record}
              disabled={busy}
              className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
            >
              {busy ? "Saving…" : "Yes, record it"}
            </button>
            <button onClick={() => setOpened(false)} disabled={busy} className="text-sm text-ink-500 hover:text-ink-900">
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
          {touch ? (
            <a
              href={link}
              onClick={() => setOpened(true)}
              className="inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-brand-700 transition"
            >
              <ExternalLink size={16} /> Open UPI app
            </a>
          ) : (
            <div className="shrink-0 w-[188px] h-[188px] rounded-xl border border-line bg-white p-2 flex items-center justify-center">
              {qr ? (
                <img src={qr} alt={`UPI QR code to pay ${payee} ${amountText}`} className="w-full h-full" />
              ) : (
                <span className="text-xs text-ink-400">Making QR code…</span>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0 divide-y divide-line">
            {copyRow("UPI ID", payment.upiId, payment.upiId)}
            {copyRow("Amount", amountText, payment.amount.toFixed(2))}
          </div>
        </div>
      )}

      {!opened && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => setOpened(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-ink-700 border border-line hover:bg-ink-100 transition"
          >
            I've paid
          </button>
          <button onClick={() => onDone(false)} className="text-sm text-ink-500 hover:text-ink-900">
            Cancel
          </button>
        </div>
      )}
      <p className="text-xs text-ink-500">
        If your UPI app won't accept the filled-in payment, copy the UPI ID and amount and pay from the app directly.
      </p>
    </section>
  );
}

export default UpiPayPanel;
