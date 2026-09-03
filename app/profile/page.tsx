"use client";

import Link from "next/link";
import { ProfileForm } from "@/components/profile/profile-form";
import { S } from "@/lib/strings";

export default function ProfilePage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-lg border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="text-stone-400 hover:text-stone-600 text-sm">
            {S.NAV_BACK}
          </Link>
          <span className="font-bold text-sm">{S.PROFILE_TITLE}</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <ProfileForm />
      </main>
    </div>
  );
}
