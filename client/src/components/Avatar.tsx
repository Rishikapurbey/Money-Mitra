import { useState } from "react";
import { photoSrc } from "../lib/me";

const SIZES = {
  sm: "w-6 h-6 text-[11px]",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-24 h-24 text-3xl",
};

// A person's photo, or the first letter of their name on a teal circle when they have none
function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl: string | null; size?: keyof typeof SIZES }) {
  const src = photoSrc(avatarUrl);
  // Remember which photo failed to load, so a new photo gets its own chance
  const [failed, setFailed] = useState<string | null>(null);
  const shape = `${SIZES[size]} shrink-0 rounded-full`;

  if (src && failed !== src) {
    return <img src={src} alt="" onError={() => setFailed(src)} className={`${shape} object-cover bg-ink-100`} />;
  }
  return (
    <span aria-hidden="true" className={`${shape} bg-brand-600 text-white font-semibold flex items-center justify-center`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default Avatar;
