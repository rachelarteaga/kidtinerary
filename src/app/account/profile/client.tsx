"use client";

import { EditProfileForm } from "@/components/account/edit-profile-form";

interface Props {
  initial: {
    fullName: string;
    email: string;
    address: string;
    phone: string;
  };
}

export function EditProfileClient({ initial }: Props) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-extrabold text-4xl text-ink tracking-tight mb-2">
        Edit profile
      </h1>
      <p className="text-ink-2 mb-8">
        Update the details we use to personalize your kidtinerary.
      </p>
      <EditProfileForm initial={initial} />
    </main>
  );
}
