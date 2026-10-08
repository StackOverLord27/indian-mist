import { useState, useEffect } from "react";
import { Pencil, X } from "lucide-react";
import type { UserData } from "./types";

export function AccountDetailsForm({
  user,
  onUpdate,
  setGlobalError,
  setGlobalSuccess,
}: {
  user: UserData;
  onUpdate: (user: UserData) => void;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (msg: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name || "", phone: user.phone || "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ name: user.name || "", phone: user.phone || "" });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setGlobalError(null);
    setGlobalSuccess(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update account details");
      onUpdate(data.user);
      setIsEditing(false);
      setGlobalSuccess("Account details updated successfully.");
      setTimeout(() => setGlobalSuccess(null), 3000);
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="border-b border-olive-leaf/15 px-6 py-4">
        <div className="flex items-center justify-between">
          <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf">
            Account Details
          </p>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 font-montserrat text-xs font-semibold uppercase tracking-widest text-olive-leaf hover:text-copperwood transition-colors"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="divide-y divide-olive-leaf/10 border-b border-olive-leaf/15">
          <div className="px-6 py-3">
            <label className="block font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">
              Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-transparent font-montserrat text-sm text-black-forest outline-none placeholder:text-olive-leaf/30 border-b border-olive-leaf/25 pb-1 focus:border-olive-leaf transition-colors"
            />
          </div>
          <div className="px-6 py-3">
            <label className="block font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-transparent font-montserrat text-sm text-black-forest outline-none placeholder:text-olive-leaf/30 border-b border-olive-leaf/25 pb-1 focus:border-olive-leaf transition-colors"
            />
          </div>
          <div className="px-6 py-3 opacity-50 cursor-not-allowed">
            <label className="block font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">
              Email
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full bg-transparent font-montserrat text-sm text-black-forest outline-none pb-1"
            />
          </div>
          <div className="flex divide-x divide-olive-leaf/15">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-olive-leaf py-3.5 font-montserrat text-xs font-semibold uppercase tracking-widest text-cornsilk transition-colors hover:bg-black-forest disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setForm({ name: user.name || "", phone: user.phone || "" });
              }}
              className="flex items-center justify-center px-5 py-3.5 text-olive-leaf/70 transition-colors hover:bg-olive-leaf/10 hover:text-olive-leaf"
            >
              <X className="size-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-olive-leaf/10 border-b border-olive-leaf/15">
          <div className="px-6 py-4">
            <p className="font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">Name</p>
            <p className="font-montserrat text-sm font-semibold text-black-forest">{user.name}</p>
          </div>
          <div className="px-6 py-4">
            <p className="font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">Email</p>
            <p className="font-montserrat text-sm font-medium text-black-forest">{user.email}</p>
          </div>
          <div className="px-6 py-4">
            <p className="font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">Phone</p>
            <p className="font-montserrat text-sm font-medium text-black-forest">{user.phone || <span className="text-olive-leaf/70 italic">Not set</span>}</p>
          </div>
        </div>
      )}
    </>
  );
}
