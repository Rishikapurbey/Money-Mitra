import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Check, ImagePlus } from "lucide-react";
import api from "../lib/api";
import { photoSrc } from "../lib/me";
import { prepareCover } from "../lib/photo";
import { COVER_DESIGNS, coverDesign } from "../lib/covers";

export interface Cover {
  coverUrl: string | null;
  coverPreset: string | null;
}

// The banner at the top of a profile: the person's own image, or one of the built-in designs
export function CoverBand({ cover, className = "h-28 sm:h-36" }: { cover: Cover; className?: string }) {
  const src = photoSrc(cover.coverUrl);
  return (
    <div aria-hidden="true" className={`relative ${className}`} style={src ? undefined : coverDesign(cover.coverPreset).style}>
      {src && <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
    </div>
  );
}

// Choosing a cover: upload an image, pick a built-in design, or go back to the default.
// Each choice is saved straight away and handed back through onChanged.
export function CoverPicker({ cover, onChanged }: { cover: Cover; onChanged: (cover: Cover, message: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (task: () => Promise<{ data: Cover }>, message: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await task();
      onChanged({ coverUrl: res.data.coverUrl, coverPreset: res.data.coverPreset }, message);
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
      setError("We couldn't read that image. Please choose a JPEG, PNG or WebP image.");
      return;
    }
    await save(() => api.put("/account/cover", { image }), "Cover updated");
  };

  const selected = cover.coverUrl ? "photo" : cover.coverPreset;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="h-16 rounded-xl border-2 border-dashed border-line text-sm font-medium text-ink-700 hover:border-brand-500 hover:text-brand-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <ImagePlus size={16} /> {busy ? "Saving…" : cover.coverUrl ? "Change image" : "Upload image"}
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
              className={`relative h-16 rounded-xl overflow-hidden transition ${active ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-surface" : "hover:opacity-90"}`}
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
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {cover.coverUrl && (
        <button
          onClick={() => save(() => api.delete("/account/cover"), "Cover image removed")}
          disabled={busy}
          className="mt-3 text-sm font-medium text-ink-500 hover:text-loss transition disabled:opacity-60"
        >
          Remove image
        </button>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
