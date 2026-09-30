import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { authorName } from "../lib/discuss";
import type { AuthorProfile } from "../lib/discuss";
import Avatar from "./Avatar";

// Photo and name of whoever wrote a post or reply, linking to their profile.
// Anonymous and deleted authors get a plain placeholder and no link.
function Byline({ item }: { item: { author: string | null; profile: AuthorProfile | null; isMine: boolean } }) {
  const name = authorName(item);
  if (!item.profile) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-ink-700">
        <span aria-hidden="true" className="w-6 h-6 shrink-0 rounded-full bg-ink-100 text-ink-400 flex items-center justify-center">
          <UserRound size={13} />
        </span>
        {name}
      </span>
    );
  }
  return (
    // relative z-10 keeps the link clickable on cards whose whole area is a link
    <Link
      to={`/u/${item.profile.username}`}
      className="relative z-10 inline-flex items-center gap-1.5 font-medium text-ink-700 hover:text-brand-700 hover:underline"
    >
      <Avatar name={name} avatarUrl={item.profile.avatarUrl} size="sm" />
      {name}
    </Link>
  );
}

export default Byline;
