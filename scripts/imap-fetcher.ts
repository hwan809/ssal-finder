/**
 * IMAP fetcher for Gmail.
 *
 * Connects to imap.gmail.com using an App Password, fetches emails received
 * since `sinceDate`, and returns parsed mail objects. Uses the `imapflow`
 * library which provides a modern async interface over IMAP.
 *
 * Environment variables:
 *   GMAIL_USER      – Gmail address (e.g. doorayhwan809@gmail.com)
 *   GMAIL_APP_PASS  – Gmail App Password (spaces are stripped automatically)
 */

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";

const IMAP_HOST = "imap.gmail.com";
const IMAP_PORT = 993;

export interface FetchedEmail {
  uid: number;
  subject: string;
  from: string;
  to: string[];
  date: Date | null;
  body: string;
  html: string | null;
}

/**
 * Fetch all emails from INBOX received on or after `sinceDate`.
 *
 * Opens a readonly connection so we never mark messages as read.
 * Returns newest-first.
 */
export async function fetchEmailsSince(
  sinceDate: Date,
): Promise<FetchedEmail[]> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASS?.replace(/\s/g, "");

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER or GMAIL_APP_PASS is not set. " +
        "Provide them as environment variables.",
    );
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const emails: FetchedEmail[] = [];

  try {
    await client.connect();

    // Open INBOX as readonly (no flags changes)
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for emails since the given date
      const searchResult = await client.search(
        { since: sinceDate },
        { uid: true },
      );

      // ImapFlow.search() returns number[] | false
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        console.log("[imap] No new emails found since", sinceDate.toISOString());
        return [];
      }

      console.log(`[imap] Found ${uids.length} email(s) since ${sinceDate.toISOString()}`);

      // Fetch in batches of 50 to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < uids.length; i += batchSize) {
        const batch = uids.slice(i, i + batchSize);
        const uidRange = batch.join(",");

        for await (const message of client.fetch(uidRange, {
          uid: true,
          source: true,
        })) {
          try {
            if (!message.source) {
              console.warn(`[imap] No source for message UID ${message.uid}, skipping`);
              continue;
            }
            const parsed = await simpleParser(message.source) as ParsedMail;

            const toAddresses: string[] = [];
            if (parsed.to) {
              const toField = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
              for (const addr of toField) {
                if ("value" in addr) {
                  for (const v of addr.value) {
                    toAddresses.push(v.address || v.name || "");
                  }
                }
              }
            }

            const fromText =
              parsed.from?.value
                .map((a) => `${a.name || ""} <${a.address || ""}>`.trim())
                .join(", ") || "";

            emails.push({
              uid: message.uid,
              subject: parsed.subject || "(no subject)",
              from: fromText,
              to: toAddresses,
              date: parsed.date || null,
              body: parsed.text || "",
              html: parsed.html || null,
            });
          } catch (parseErr) {
            console.warn(`[imap] Failed to parse message UID ${message.uid}:`, parseErr);
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  // Newest first
  emails.sort((a: FetchedEmail, b: FetchedEmail) => {
    const da = a.date?.getTime() ?? 0;
    const db = b.date?.getTime() ?? 0;
    return db - da;
  });

  return emails;
}
