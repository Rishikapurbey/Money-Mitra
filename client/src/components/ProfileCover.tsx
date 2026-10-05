import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Camera, Check, ImagePlus, X } from "lucide-react";
import api from "../lib/api";
import { photoSrc } from "../lib/me";
import { prepareCover } from "../lib/photo";
import { COVER_DESIGNS, coverDesign } from "../lib/covers";
import { useToast } from "../lib/toast";

interface Cover {
  coverUrl: string | null;
  coverPreset: string | null;
}

// The banner at the top of a profile: the person's own image, or one of the built-in designs.
// On your own profile it has an "Edit cover" button.
export function CoverBand({ cover, onEdit }: { cover: Cover; onEdit?: () => void }) {
  const src = photoSrc(cover.coverUrl);
  return (
    <div aria-hidden={!onEdit} className="relative h-28 sm:h-36" style={src ? undefined : coverDesign(cover.coverPreset).style}>
      {src && <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/60 transition"
        >
          <Camera size={14} /> Edit cover
        </button>
      )}
    </div>
  );
}

// Choosing a new cover: upload an image, pick a built-in design, or go back to the default
export function CoverEditor({ cover, onChanged, onClose }: { cover: Cover; onChanged: () => void; onClose: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (task: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await task();
      toast({ message });
      onChanged();
      onClose();
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't change your cover. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    let image: string;
    try {
      image = await prepareCover(file);
    } catch {
      setError("We couldn't read that image. Please try a JPEG or PNG.");
      return;
    }
    await save(() => api.put("/account/cover", { image }), "Cover updated");
  };

  const selected = cover.coverUrl ? "photo" : cover.coverPreset;

  return (
    <div className="mt-5 rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">Cover</h2>
        <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-900">
          <X size={18} />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-500">Upload a wide image (it's cropped to a 3:1 banner), or pick one of ours.</p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="h-16 rounded-xl border-2 border-dashed border-line text-sm font-medium text-ink-700 hover:border-brand-500 hover:text-brand-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <ImagePlus size={16} /> {busy ? "Saving…" : "Upload image"}
        </button>
        {COVER_DESIGNS.map((d) => {
          const active = selected === d.key;
          return (
            <button
              key={d.label}
              onClick={() => save(() => api.put("/account/cover/preset", { preset: d.key }), `Cover changed to ${d.label}`)}
              disabled={busy || active}
              aria-label={d.label}
              aria-pressed={active}
              className={`relative h-16 rounded-xl overflow-hidden transition ${active ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas" : "hover:opacity-90"}`}
              style={d.style}
            >
              {active && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white text-brand-700 flex items-center justify-center">
                  <Check size={13} />
                </span>
              )}
              <span className={`absolute bottom-1 left-2 text-[11px] font-medium ${d.light ? "text-[#0f1b2d]" : "text-white/90 drop-shadow"}`}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {cover.coverUrl && (
        <button
          onClick={() => save(() => api.delete("/account/cover"), "Cover photo removed")}
          disabled={busy}
          className="mt-4 text-sm font-medium text-loss hover:underline disabled:opacity-60"
        >
          Remove cover photo
        </button>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
