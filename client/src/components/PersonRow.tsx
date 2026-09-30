import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { nameOf } from "../lib/me";
import Avatar from "./Avatar";

// One person in a list: photo, name and @username linking to their profile, with actions on the right
function PersonRow({
  person,
  children,
}: {
  person: { username: string; displayName: string | null; avatarUrl: string | null };
  children?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <Link to={`/u/${person.username}`} className="flex items-center gap-3 min-w-0 flex-1 group">
        <Avatar name={nameOf(person)} avatarUrl={person.avatarUrl} size="lg" />
        <span className="min-w-0">
          <span className="block font-medium text-ink-900 truncate group-hover:underline">{nameOf(person)}</span>
          <span className="block text-sm text-ink-500 truncate">@{person.username}</span>
        </span>
      </Link>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </li>
  );
}

export default PersonRow;
