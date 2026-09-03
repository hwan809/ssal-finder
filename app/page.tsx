"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSlides } from "@/components/onboarding/onboarding-slides";

export default function LandingPage() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const done = localStorage.getItem("ssal-onboarded");
    if (done) {
      router.replace("/events");
    } else {
      setShowOnboarding(true);
    }
  }, [router]);

  if (showOnboarding === null) return null;

  return (
    <OnboardingSlides onComplete={() => router.replace("/events")} />
  );
}
