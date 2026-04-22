"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface Initial {
  fullName: string;
  email: string;
  address: string;
  phone: string;
}

export function EditProfileForm({ initial }: { initial: Initial }) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ fullName, address, phone });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Profile updated", "success");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Name</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          required
        />
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Email</span>
        <input
          value={initial.email}
          readOnly
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-disabled text-ink-2"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">
          Contact support to change your email.
        </span>
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          placeholder="Street, city, state"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">
          Used to find nearby camps.
        </span>
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          placeholder="+1 (555) 000-0000"
          inputMode="tel"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">
          Used for future registration reminders via text.
        </span>
      </label>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
