export interface UserProfile {
  name: string;
  student_id: string;
  department: string;
  email: string;
  phone: string;
}

const PROFILE_KEY = "ssal-finder-profile";

export function getProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
}

export async function autoRegister(
  eventId: string,
  profile: UserProfile,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auto-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, profile }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "failed" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
