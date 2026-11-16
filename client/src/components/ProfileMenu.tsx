import { isAxiosError } from "axios";
import { Ban, MoreHorizontal } from "lucide-react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import ActionMenu from "./ActionMenu";

const outlined = "inline-flex items-center px-4 py-2.5 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-ink-100 disabled:opacity-60 transition";

// The quieter actions on someone's profile, in a ⋯ menu next to Follow and Message. Once you've
// blocked someone, Unblock is the only thing left to do there, so it shows as a button instead.
function ProfileMenu({ username, name, blocked, onChange }: { username: string; name: string; blocked: boolean; onChange: () => void }) {
  const toast = useToast();

  const apply = async (block: boolean) => {
    try {
      if (block) await api.post(`/blocks/${username}`);
      else await api.delete(`/blocks/${username}`);
      toast({ message: block ? `${name} is blocked` : `${name} is unblocked` });
      onChange();
    } catch (err) {
      toast({ message: (isAxiosError(err) && err.response?.data?.error) || "That didn't work. Please try again." });
    }
  };

  if (blocked) {
    return (
      <button onClick={() => apply(false)} className={outlined}>
        Unblock
      </button>
    );
  }
  return (
    <ActionMenu
      label="More options"
      trigger={({ open }) => (
        <span
          className={`inline-flex items-center justify-center w-[42px] h-[42px] rounded-xl border border-line transition ${open ? "bg-ink-100 text-ink-900" : "text-ink-700 hover:bg-ink-100"}`}
        >
          <MoreHorizontal size={18} />
        </span>
      )}
      actions={[
        {
          label: `Block ${name}`,
          icon: Ban,
          danger: true,
          onSelect: () => apply(true),
          confirm: {
            title: `Block ${name}?`,
            body: "They won't be able to message you, follow you, see your profile or find you in search. They aren't told.",
            action: "Block",
          },
        },
      ]}
    />
  );
}

export default ProfileMenu;
