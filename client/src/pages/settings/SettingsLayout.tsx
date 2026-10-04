import type { ComponentType } from "react";
import { Navigate, NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Download,
  Info,
  Lock,
  LogOut,
  MessageSquareText,
  Palette,
  ShieldCheck,
  Tags,
  Trash2,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { pageWidth } from "../../lib/ui";
import { useTitle } from "../../lib/useTitle";
import { useWideLayout } from "../../lib/useMediaQuery";
import type { AppContext } from "../../components/AppLayout";
import { DeleteAccountSection, ProfileSection, SecuritySection } from "./AccountSections";
import { AppearanceSection, CategoriesSection, DataSection, NotificationsSection, PrivacySection } from "./PreferenceSections";
import { AboutSection, FeedbackSection, HelpSection } from "./SupportSections";

interface Section {
  slug: string;
  label: string;
  // Shown under the label in the phone list
  hint: string;
  icon: LucideIcon;
  component: ComponentType;
  danger?: boolean;
}

const GROUPS: { title: string; sections: Section[] }[] = [
  {
    title: "Account",
    sections: [
      { slug: "profile", label: "Profile", hint: "Photo, name and bio", icon: UserRound, component: ProfileSection },
      { slug: "security", label: "Login & security", hint: "Email, password, devices", icon: ShieldCheck, component: SecuritySection },
    ],
  },
  {
    title: "Preferences",
    sections: [
      { slug: "appearance", label: "Appearance", hint: "Light or dark", icon: Palette, component: AppearanceSection },
      { slug: "notifications", label: "Notifications", hint: "Emails about replies", icon: Bell, component: NotificationsSection },
      { slug: "categories", label: "Categories", hint: "Add, rename and merge", icon: Tags, component: CategoriesSection },
    ],
  },
  {
    title: "Privacy & data",
    sections: [
      { slug: "privacy", label: "Privacy", hint: "Private profile, anonymous posting", icon: Lock, component: PrivacySection },
      { slug: "data", label: "Your data", hint: "Import and download", icon: Download, component: DataSection },
      { slug: "delete", label: "Delete account", hint: "Permanently", icon: Trash2, component: DeleteAccountSection, danger: true },
    ],
  },
  {
    title: "Support",
    sections: [
      { slug: "help", label: "Help & FAQ", hint: "Common questions", icon: CircleHelp, component: HelpSection },
      { slug: "feedback", label: "Send feedback", hint: "Ideas and problems", icon: MessageSquareText, component: FeedbackSection },
      { slug: "about", label: "About", hint: "Version and privacy", icon: Info, component: AboutSection },
    ],
  },
];

const SECTIONS = GROUPS.flatMap((g) => g.sections);
const DEFAULT_SECTION = SECTIONS[0].slug;

function Menu({ wide, onLogout }: { wide: boolean; onLogout: () => void }) {
  const item = (s: Section) => (
    <NavLink
      key={s.slug}
      to={`/settings/${s.slug}`}
      className={({ isActive }) =>
        wide
          ? `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
              isActive
                ? "bg-surface border border-line font-semibold text-ink-900 shadow-sm"
                : `border border-transparent hover:bg-surface ${s.danger ? "text-loss" : "text-ink-700"}`
            }`
          : "flex items-center gap-3 px-4 py-3.5 hover:bg-canvas transition"
      }
    >
      {({ isActive }) => (
        <>
          <s.icon size={wide ? 16 : 20} className={s.danger ? "text-loss" : isActive && wide ? "text-brand-600" : "text-ink-400"} />
          {wide ? (
            s.label
          ) : (
            <>
              <span className="flex-1 min-w-0">
                <span className={`block font-medium ${s.danger ? "text-loss" : "text-ink-900"}`}>{s.label}</span>
                <span className="block text-sm text-ink-500">{s.hint}</span>
              </span>
              <ChevronRight size={18} className="text-ink-300" />
            </>
          )}
        </>
      )}
    </NavLink>
  );

  const logout = (
    <button
      onClick={onLogout}
      className={
        wide
          ? "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-700 border border-transparent hover:bg-surface transition"
          : "w-full flex items-center gap-3 px-4 py-3.5 bg-surface border border-line rounded-2xl font-medium text-ink-900 hover:bg-canvas transition"
      }
    >
      <LogOut size={wide ? 16 : 20} className="text-ink-400" /> Log out
    </button>
  );

  return (
    <nav aria-label="Settings" className={wide ? "sticky top-20 space-y-5" : "space-y-6"}>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className={`text-xs font-semibold uppercase tracking-wider text-ink-500 ${wide ? "px-3 pb-2" : "px-1 pb-2"}`}>{g.title}</p>
          {wide ? (
            <div className="space-y-0.5">{g.sections.map(item)}</div>
          ) : (
            <div className="bg-surface border border-line rounded-2xl divide-y divide-line overflow-hidden">{g.sections.map(item)}</div>
          )}
        </div>
      ))}
      {wide ? <div className="border-t border-line pt-3">{logout}</div> : logout}
    </nav>
  );
}

// Settings: a grouped menu of sections. Wide screens show the menu beside the open section;
// phones show the menu on its own, and each section opens as its own screen.
function SettingsLayout() {
  const wide = useWideLayout();
  const navigate = useNavigate();
  const { section } = useParams();
  const open = SECTIONS.find((s) => s.slug === section);
  useTitle(open ? `${open.label} · Settings` : "Settings");
  const context = useOutletContext<AppContext>();
  const { me } = context;

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (wide) {
    // Wide screens always have a section open
    if (!section) return <Navigate to={`/settings/${DEFAULT_SECTION}`} replace />;
    return (
      <main className={`${pageWidth} py-8`}>
        <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-10 items-start">
          <div>
            <h1 className="px-3 pb-5 text-2xl font-semibold tracking-tight text-ink-900">Settings</h1>
            <Menu wide onLogout={logout} />
          </div>
          <div className="max-w-3xl space-y-6 pt-1">
            <Outlet context={context} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${pageWidth} py-8`}>
      {section ? (
        <div className="space-y-6">
          <Outlet context={context} />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Settings</h1>
            {me && <p className="mt-1 text-sm text-ink-500">Signed in as {me.email}</p>}
          </div>
          <Menu wide={false} onLogout={logout} />
        </div>
      )}
    </main>
  );
}

// The section named in the address; unknown names go back to the menu
export function SettingsSection() {
  const { section } = useParams();
  const found = SECTIONS.find((s) => s.slug === section);
  if (!found) return <Navigate to="/settings" replace />;
  const Component = found.component;
  return <Component />;
}

export default SettingsLayout;
