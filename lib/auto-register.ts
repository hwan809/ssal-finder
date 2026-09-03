export interface UserProfile {
  name: string;
  student_id: string;
  department: string;
  email: string;
  phone: string;
}

export interface FormMapping {
  [entryId: string]: keyof UserProfile | null;
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

export function extractFormId(url: string): string | null {
  const match = url.match(/forms\/d\/e\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export function buildFormResponseUrl(formId: string): string {
  return `https://docs.google.com/forms/d/e/${formId}/formResponse`;
}

export async function submitForm(
  formId: string,
  mapping: FormMapping,
  profile: UserProfile,
): Promise<boolean> {
  const url = buildFormResponseUrl(formId);
  const body = new URLSearchParams();

  for (const [entryId, profileField] of Object.entries(mapping)) {
    if (!profileField) continue;
    const value = profile[profileField];
    if (value) {
      body.append(entryId, value);
    }
  }

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return true;
  } catch {
    return false;
  }
}
