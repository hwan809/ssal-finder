"use client";

import { ProfileForm } from "@/components/profile/profile-form";
import { S } from "@/lib/strings";
import { Header } from "@/components/layout/header";

export default function ProfilePage() {
  return (
    <div className="max-w-[480px] mx-auto min-h-screen">
      <Header back="/events" title={S.PROFILE_TITLE} />
      <main className="px-5 py-4">
        <ProfileForm />
      </main>
    </div>
  );
}
