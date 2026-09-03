/**
 * Privacy filter — runs BEFORE any email content is sent to an LLM.
 *
 * Rules (from the spec):
 *   1. If the `to` field contains ONLY a single personal address, discard.
 *   2. If the sender is a personal student/professor email AND recipients
 *      are few (<= 3), discard.
 *   3. Pass only when recipients include group/mailing-list addresses such as
 *      "학생(학부)", "학생(대학원)", "@kaist.ac.kr" list aliases, or the
 *      email comes from a portal crawl.
 *
 * Additionally, before sending to the LLM:
 *   - Mask all email addresses: sender -> [발신자], recipients -> [수신자]
 *   - Remove personally identifiable header fields
 */

import type { FetchedEmail } from "./imap-fetcher";

/** Known group / mailing-list recipient patterns that indicate mass mail. */
const GROUP_PATTERNS: RegExp[] = [
  /학생\s*\(학부\)/i,
  /학생\s*\(대학원\)/i,
  /학생\s*\(전체\)/i,
  /전체\s*학생/i,
  /all[-_]?student/i,
  /undisclosed[-_]?recipients/i,
  /@kaist\.ac\.kr$/i, // domain-level list aliases
  /mailing[-_]?list/i,
  /announce/i,
  /notice/i,
  /공지/i,
];

/** Patterns indicating personal student/professor addresses. */
const PERSONAL_SENDER_PATTERNS: RegExp[] = [
  /^[a-z0-9._-]+@kaist\.ac\.kr$/i,   // individual KAIST address
  /^[a-z0-9._-]+@gmail\.com$/i,
  /^[a-z0-9._-]+@naver\.com$/i,
];

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

/**
 * Determine whether an email should be forwarded to the LLM for classification.
 */
export function shouldProcess(email: FetchedEmail): FilterResult {
  const toList = email.to.filter((addr) => addr.trim().length > 0);

  // Rule 1: If the only recipient is a single personal address, discard.
  if (toList.length === 1 && !isGroupAddress(toList[0])) {
    return { passed: false, reason: "single personal recipient" };
  }

  // Rule 3: At least one recipient must match a group pattern.
  const hasGroupRecipient = toList.some(isGroupAddress);

  // Rule 2: Personal sender + few recipients + no group address -> discard.
  if (!hasGroupRecipient) {
    const senderIsPersonal = PERSONAL_SENDER_PATTERNS.some((p) =>
      p.test(extractEmailAddress(email.from)),
    );
    if (senderIsPersonal && toList.length <= 3) {
      return {
        passed: false,
        reason: "personal sender with few non-group recipients",
      };
    }
  }

  // If we have group recipients, pass.
  if (hasGroupRecipient) {
    return { passed: true };
  }

  // Edge case: many recipients (> 3) even without a recognized group pattern
  // — likely a mass mail.  Pass with a note.
  if (toList.length > 3) {
    return { passed: true };
  }

  return { passed: false, reason: "no group recipients detected" };
}

function isGroupAddress(addr: string): boolean {
  return GROUP_PATTERNS.some((p) => p.test(addr));
}

function extractEmailAddress(fromField: string): string {
  const match = fromField.match(/<([^>]+)>/);
  return match ? match[1] : fromField.trim();
}

// ---------------------------------------------------------------------------
// Masking helpers — strip PII before sending content to the LLM
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX =
  /(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|\+82[-.\s]?\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g;

/**
 * Mask PII in the email body before sending to the LLM.
 */
export function maskForLLM(email: FetchedEmail): {
  subject: string;
  body: string;
} {
  let body = email.body;

  // Mask email addresses
  body = body.replace(EMAIL_REGEX, "[이메일]");

  // Mask phone numbers
  body = body.replace(PHONE_REGEX, "[전화번호]");

  // Also mask in subject (less likely but defensive)
  let subject = email.subject;
  subject = subject.replace(EMAIL_REGEX, "[이메일]");

  return { subject, body };
}
