/**
 * Privacy filter - runs BEFORE any email content is sent to an LLM.
 *
 * KAIST dooray mail routes mass announcements to individual addresses,
 * so we can't rely on the `to` field for group detection. Instead we
 * whitelist known institutional senders and only block clearly personal
 * 1-to-1 conversations.
 */

import type { FetchedEmail } from "./imap-fetcher";

/** Senders that are clearly institutional (always pass) */
const INSTITUTIONAL_SENDER_PATTERNS: RegExp[] = [
  /noreply/i,
  /no-reply/i,
  /알리미/i,
  /총학/i,
  /학생회/i,
  /학과/i,
  /대학원/i,
  /행정/i,
  /홍보/i,
  /교무/i,
  /장학/i,
  /취업/i,
  /채용/i,
  /센터/i,
  /연구/i,
  /세미나/i,
  /colloquium/i,
  /seminar/i,
  /workshop/i,
  /newsletter/i,
  /admin/i,
  /office/i,
  /team@/i,
  /support@/i,
  /info@/i,
  /event/i,
  /협동조합/i,
  /복지/i,
  /체육/i,
  /도서/i,
  /isss/i,
  /susep/i,
  /gsa/i,
  /usc/i,
];

/** Subjects that indicate mass announcements (always pass) */
const ANNOUNCEMENT_SUBJECT_PATTERNS: RegExp[] = [
  /안내/,
  /공지/,
  /모집/,
  /설명회/,
  /세미나/,
  /워크숍/,
  /초청/,
  /개최/,
  /행사/,
  /특강/,
  /채용/,
  /장학/,
  /Seminar/i,
  /Workshop/i,
  /Colloquium/i,
  /Reminder/i,
  /Notice/i,
  /Recruit/i,
];

/** Clearly personal mail that should always be blocked */
const PERSONAL_BLOCK_PATTERNS: RegExp[] = [
  /^Welcome to Supabase/i,
  /^Confirm your email/i,
  /^Security alert/i,
  /^You shared some Google Account/i,
  /sign.?in/i,
  /password/i,
  /verification/i,
  /메일 전달 제한/,
];

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

export function shouldProcess(email: FetchedEmail): FilterResult {
  const subject = email.subject || "";
  const from = email.from || "";
  const fromAddr = extractEmailAddress(from);

  // Block clearly personal/service emails
  if (PERSONAL_BLOCK_PATTERNS.some((p) => p.test(subject))) {
    return { passed: false, reason: "personal/service email" };
  }

  // Non-KAIST sender: block (Supabase, Google, etc.)
  if (fromAddr && !fromAddr.endsWith("@kaist.ac.kr")) {
    return { passed: false, reason: "non-KAIST sender" };
  }

  // Institutional sender name: always pass
  if (INSTITUTIONAL_SENDER_PATTERNS.some((p) => p.test(from))) {
    return { passed: true };
  }

  // Announcement-style subject: always pass
  if (ANNOUNCEMENT_SUBJECT_PATTERNS.some((p) => p.test(subject))) {
    return { passed: true };
  }

  // KAIST sender with @kaist.ac.kr: pass (most dooray mail is mass-sent)
  if (fromAddr.endsWith("@kaist.ac.kr")) {
    return { passed: true };
  }

  return { passed: false, reason: "unknown sender pattern" };
}

function extractEmailAddress(fromField: string): string {
  const match = fromField.match(/<([^>]+)>/);
  return match ? match[1] : fromField.trim();
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX =
  /(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|\+82[-.\s]?\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g;

export function maskForLLM(email: FetchedEmail): {
  subject: string;
  body: string;
} {
  let body = email.body;
  body = body.replace(EMAIL_REGEX, "[이메일]");
  body = body.replace(PHONE_REGEX, "[전화번호]");
  let subject = email.subject;
  subject = subject.replace(EMAIL_REGEX, "[이메일]");
  return { subject, body };
}
