import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Camera, LogOut } from "lucide-react";
import api from "../../lib/api";
import { nameOf } from "../../lib/me";
import { preparePhoto } from "../../lib/photo";
import Avatar from "../../components/Avatar";
import { inputClass } from "../../lib/ui";
import { useToast } from "../../lib/toast";
import { Panel, SectionHeader, Status } from "./shared";
import { errorMessage, idle, primaryButton, secondaryButton, useSettings } from "./context";

function PhotoPanel() {
  const { me, updateMe } = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  // The resized photo waiting for "Save", shown as a preview
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState(idle);

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState(idle);
    try {
      setPreview(await preparePhoto(file));
    } catch {
      setState({ busy: false, error: "We couldn't read that file. Please choose a JPEG, PNG or WebP photo.", success: "" });
    }
  };

  const save = async () => {
    setState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/photo", { image: preview });
      updateMe({ avatarUrl: res.data.avatarUrl });
      setPreview(null);
      setState({ busy: false, error: "", success: "Photo updated" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't save your photo."), success: "" });
    }
  };

  const remove = async () => {
    setState({ busy: true, error: "", success: "" });
    try {
      await api.delete("/account/photo");
      updateMe({ avatarUrl: null });
      setState({ busy: false, error: "", success: "Photo removed" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't remove your photo."), success: "" });
    }
  };

  return (
    <Panel title="Photo" description="Shown on your profile and next to what you post under your name. Never on anonymous posts.">
      <div className="flex flex-wrap items-center gap-5">
        {preview ? (
          <img src={preview} alt="Preview of your new photo" className="w-24 h-24 rounded-full object-cover" />
        ) : me ? (
          <Avatar name={nameOf(me)} avatarUrl={me.avatarUrl} size="xl" />
        ) : (
          <span className="w-24 h-24 rounded-full bg-ink-100" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} className="sr-only" tabIndex={-1} />
          {preview ? (
            <>
              <button onClick={save} disabled={state.busy} className={primaryButton}>
                {state.busy ? "Saving…" : "Save photo"}
              </button>
              <button onClick={() => setPreview(null)} disabled={state.busy} className="text-sm font-medium text-ink-500 hover:text-ink-900">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => fileInput.current?.click()} disabled={!me || state.busy} className={secondaryButton}>
                <Camera size={16} /> {me?.avatarUrl ? "Change photo" : "Add a photo"}
              </button>
              {me?.avatarUrl && (
                <button onClick={remove} disabled={state.busy} className="text-sm font-medium text-ink-500 hover:text-loss transition">
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        {preview
          ? "We've cropped the middle of your photo into a square. It isn't saved until you choose Save photo."
          : "We crop it to a square and shrink it on your device before uploading. Location details in the file are removed."}
      </p>
      <div className="mt-3">
        <Status {...state} />
      </div>
    </Panel>
  );
}

const MAX_BIO = 160;

function AboutYouPanel() {
  const { me, updateMe } = useSettings();
  // null means "not edited yet", so the saved value shows once it loads
  const [editedName, setEditedName] = useState<string | null>(null);
  const [editedBio, setEditedBio] = useState<string | null>(null);
  const [state, setState] = useState(idle);
  const displayName = editedName ?? me?.displayName ?? "";
  const bio = editedBio ?? me?.bio ?? "";
  const changed = me && (displayName.trim() !== (me.displayName ?? "") || bio.trim() !== (me.bio ?? ""));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/profile", { displayName, bio });
      updateMe(res.data.profile);
      setEditedName(null);
      setEditedBio(null);
      setState({ busy: false, error: "", success: "Profile saved" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't save your profile."), success: "" });
    }
  };

  return (
    <Panel title="About you">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Name</span>
          <input
            value={displayName}
            onChange={(e) => setEditedName(e.target.value)}
            maxLength={40}
            placeholder={me?.username}
            className={`${inputClass} w-full mt-1.5`}
            disabled={!me}
          />
          <span className="mt-1 block text-xs text-ink-500">Optional. Shown instead of your username. Your real name isn't required.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setEditedBio(e.target.value)}
            maxLength={MAX_BIO}
            rows={3}
            placeholder="For example: Saving for my first home. Learning about mutual funds."
            className={`${inputClass} w-full mt-1.5 resize-y`}
            disabled={!me}
          />
          <span className="mt-1 flex justify-between gap-4 text-xs text-ink-500">
            <span>Optional. Avoid sharing personal details like your phone number or salary.</span>
            <span className="shrink-0 tabular-nums">
              {bio.length}/{MAX_BIO}
            </span>
          </span>
        </label>
        <Status {...state} />
        <button type="submit" disabled={state.busy || !changed} className={primaryButton}>
          {state.busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Panel>
  );
}

function UsernamePanel() {
  const { me, updateMe } = useSettings();
  const [edited, setEdited] = useState<string | null>(null);
  const [state, setState] = useState(idle);
  const username = edited ?? me?.username ?? "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/username", { username });
      updateMe({ username: res.data.user.username, avatarUrl: res.data.user.avatarUrl });
      setEdited(null);
      setState({ busy: false, error: "", success: "Username updated" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't update your username."), success: "" });
    }
  };

  return (
    <Panel title="Username" description="Your unique @name. It's also your profile's web address.">
      <form onSubmit={save} className="space-y-4">
        <input
          value={username}
          onChange={(e) => setEdited(e.target.value)}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3 to 20 characters: letters, numbers and underscores"
          aria-label="Username"
          className={`${inputClass} w-full`}
          disabled={!me}
          required
        />
        <span className="-mt-2 block text-xs text-ink-500">3 to 20 characters: letters, numbers and underscores.</span>
        <Status {...state} />
        <button type="submit" disabled={state.busy || !me || username === me.username} className={primaryButton}>
          {state.busy ? "Saving…" : "Save username"}
        </button>
      </form>
    </Panel>
  );
}

export function ProfileSection() {
  const { me } = useSettings();
  return (
    <>
      <SectionHeader title="Profile" description="How you appear in Discuss when you don't post anonymously." />
      {me && (
        <Link to={`/u/${me.username}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
          View your profile <ArrowRight size={15} />
        </Link>
      )}
      <PhotoPanel />
      <AboutYouPanel />
      <UsernamePanel />
    </>
  );
}

export function SecuritySection() {
  const { me } = useSettings();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState(idle);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [logoutState, setLogoutState] = useState(idle);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/password", { currentPassword, newPassword });
      // The change logs out every session; keep this device signed in with the fresh token
      localStorage.setItem("token", res.data.token);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordState({ busy: false, error: "", success: "Password changed. You've been logged out on your other devices." });
    } catch (err) {
      setPasswordState({ busy: false, error: errorMessage(err, "We couldn't change your password."), success: "" });
    }
  };

  const logoutEverywhere = async () => {
    setLogoutState({ busy: true, error: "", success: "" });
    try {
      const res = await api.post("/account/logout-everywhere");
      localStorage.setItem("token", res.data.token);
      setConfirmingLogout(false);
      setLogoutState(idle);
      toast({ message: "Logged out on all your other devices" });
    } catch (err) {
      setLogoutState({ busy: false, error: errorMessage(err, "We couldn't log out your other devices."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader title="Login & security" description="Your email, password and where you're logged in." />
      <Panel title="Email">
        <input value={me?.email ?? ""} disabled aria-label="Email" className={`${inputClass} w-full bg-canvas text-ink-500`} />
        <p className="mt-2 text-xs text-ink-500">Used to log in and to reset your password. It's never shown to other people.</p>
      </Panel>

      <Panel title="Change password">
        <form onSubmit={savePassword} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`${inputClass} w-full mt-1.5`}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-700">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              className={`${inputClass} w-full mt-1.5`}
              required
            />
            <span className="mt-1 block text-xs text-ink-500">At least 8 characters, with a letter and a number.</span>
          </label>
          <Status {...passwordState} />
          <button type="submit" disabled={passwordState.busy} className={primaryButton}>
            {passwordState.busy ? "Changing…" : "Change password"}
          </button>
        </form>
      </Panel>

      <Panel
        title="Log out of all other devices"
        description="If you logged in on a shared or lost device, this signs it out. You'll stay logged in here."
      >
        {confirmingLogout ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink-700">Log out everywhere else?</span>
            <button onClick={logoutEverywhere} disabled={logoutState.busy} className={primaryButton}>
              {logoutState.busy ? "Logging out…" : "Yes, log them out"}
            </button>
            <button onClick={() => setConfirmingLogout(false)} className="text-sm font-medium text-ink-500 hover:text-ink-900">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmingLogout(true)} className={secondaryButton}>
            <LogOut size={16} /> Log out other devices
          </button>
        )}
        <div className="mt-3">
          <Status {...logoutState} />
        </div>
      </Panel>
    </>
  );
}

export function DeleteAccountSection() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [state, setState] = useState(idle);

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: "", success: "" });
    try {
      await api.delete("/account", { data: { password } });
      localStorage.removeItem("token");
      navigate("/", { replace: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't delete your account."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader title="Delete account" />
      <Panel
        danger
        title="Permanently delete your account"
        description="This deletes your account, transactions, budgets, goals and categories. Your questions and replies in Discuss stay visible as “Deleted user” so conversations still make sense."
      >
        <form onSubmit={deleteAccount} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">Enter your password to confirm</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} w-full mt-1.5`}
              required
            />
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-loss"
            />
            <span className="text-sm text-ink-700">I understand this can't be undone.</span>
          </label>
          <Status {...state} />
          <button
            type="submit"
            disabled={!understood || state.busy}
            className="flex items-center gap-2 bg-loss text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AlertTriangle size={16} /> {state.busy ? "Deleting…" : "Delete my account"}
          </button>
        </form>
      </Panel>
    </>
  );
}
