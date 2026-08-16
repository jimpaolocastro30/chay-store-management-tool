"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { Button, Input, Panel } from "@/components/ui";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!session?.user) return;
    setProfile((current) => ({
      name: current.name || session.user.name || "",
      email: current.email || session.user.email || "",
      role: current.role || session.user.role || "",
    }));
  }, [session]);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setProfileError(data.error || "Could not load profile");
          return;
        }
        setProfile({
          name: data.name || "",
          email: data.email || "",
          role: data.role || "",
        });
        setProfileError("");
      })
      .catch(() => setProfileError("Could not load profile"));
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        email: profile.email,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingProfile(false);
    if (!res.ok) {
      setProfileError(data.error || "Could not update profile");
      return;
    }
    await update({ name: data.name, email: data.email });
    setProfile({
      name: data.name || "",
      email: data.email || "",
      role: data.role || profile.role,
    });
    setProfileMessage("Profile updated.");
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    setPasswordMessage("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setSavingPassword(false);
      setPasswordError("New passwords do not match");
      return;
    }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(data.error || "Could not update password");
      return;
    }
    setPasswords({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordMessage("Password updated.");
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Update your profile and password"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <form onSubmit={saveProfile} className="space-y-3">
            <Input
              label="Full name"
              required
              minLength={2}
              value={profile.name}
              onChange={(e) =>
                setProfile({ ...profile, name: e.target.value })
              }
            />
            <Input
              label="Email"
              type="email"
              required
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
            <Input
              label="Role"
              value={profile.role || session?.user?.role || ""}
              readOnly
              className="capitalize bg-violet-50/60"
            />
            {profileError ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {profileError}
              </p>
            ) : null}
            {profileMessage ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {profileMessage}
              </p>
            ) : null}
            <Button type="submit" disabled={savingProfile} className="w-full">
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Panel>

        <Panel title="Password">
          <form onSubmit={savePassword} className="space-y-3">
            <Input
              label="Current password"
              type="password"
              required
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  currentPassword: e.target.value,
                })
              }
            />
            <Input
              label="New password"
              type="password"
              required
              minLength={6}
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, newPassword: e.target.value })
              }
            />
            <Input
              label="Confirm new password"
              type="password"
              required
              minLength={6}
              value={passwords.confirmPassword}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  confirmPassword: e.target.value,
                })
              }
            />
            {passwordError ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {passwordError}
              </p>
            ) : null}
            {passwordMessage ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {passwordMessage}
              </p>
            ) : null}
            <Button type="submit" disabled={savingPassword} className="w-full">
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
