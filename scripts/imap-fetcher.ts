/**
 * IMAP fetcher — single-connection, batch approach:
 *   fetchEmailsSince: batch headers + batch partial-message bodies in one IMAP session
 *   fetchBodies: standalone batch body fetch (used by collect.ts after privacy filtering)
 *
 * Key optimizations over the original:
 *   - BODY.PEEK[]<0.51200>: first 50KB of each message (skips large attachments)
 *   - Batch IMAP commands: all UIDs in one FETCH (eliminates per-email round-trips)
 *   - Socket timeout (30s) + retry with reconnect on failure
 *   - Python email.message MIME-tree walk for reliable encoding/charset handling
 */

import { execFileSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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
 * Combined script: batch headers + batch partial-message bodies in one IMAP session.
 * BODY.PEEK[]<0.51200> fetches first 50KB of each message, skipping large attachments.
 * Python's email.message MIME-tree walker handles all encoding/charset decoding.
 */
const COMBINED_SCRIPT = `
import imaplib, email, json, sys, re, os, time
from email.header import decode_header, make_header
from datetime import datetime

user = os.environ["GMAIL_USER"]
pw = os.environ["GMAIL_APP_PASS"].replace(" ", "")
since_iso = sys.argv[1]
output_file = sys.argv[2]
max_emails = int(sys.argv[3]) if len(sys.argv) > 3 else 50

def connect():
    c = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    c.login(user, pw)
    c.socket().settimeout(30)
    c.select("INBOX", readonly=True)
    return c

conn = connect()

date_str = datetime.fromisoformat(since_iso.replace("Z","+00:00")).strftime("%d-%b-%Y")
typ, data = conn.uid("search", None, f"SINCE {date_str}")
uids = (data[0] or b"").split()
if not uids:
    json.dump([], open(output_file, "w"))
    conn.logout()
    sys.exit(0)

uids = uids[-max_emails:]

# --- Pass 1: batch header fetch (fast) ---
uid_set = b",".join(uids)
typ, data = conn.uid("fetch", uid_set, "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])")

header_map = {}
for item in data:
    if not isinstance(item, tuple) or len(item) < 2:
        continue
    meta = item[0].decode("utf-8", errors="replace")
    m_uid = re.search(r"UID (\\d+)", meta)
    if not m_uid:
        continue
    uid_val = int(m_uid.group(1))
    headers = email.message_from_bytes(item[1])
    def hdr(n):
        raw = headers.get(n, "")
        if not raw: return ""
        try: return str(make_header(decode_header(raw))).strip()
        except: return str(raw).strip()
    to_raw = hdr("To")
    to_list = [a.strip() for a in to_raw.split(",") if a.strip()]
    header_map[uid_val] = {
        "uid": uid_val,
        "subject": hdr("Subject"),
        "from": hdr("From"),
        "to": to_list,
        "date": hdr("Date"),
        "body": "",
    }

sys.stderr.write(f"[imap] Headers fetched: {len(header_map)}\\n")

# --- Pass 2: batch full-message fetch + MIME-tree body extraction ---
def get_body(msg):
    html_fallback = None
    for part in (msg.walk() if msg.is_multipart() else [msg]):
        ctype = part.get_content_type()
        disp = str(part.get("Content-Disposition", ""))
        if "attachment" in disp:
            continue
        try:
            payload = part.get_payload(decode=True)
        except:
            continue
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"
        try:
            text = payload.decode(charset, errors="replace")
        except:
            text = payload.decode("utf-8", errors="replace")
        if ctype == "text/plain":
            return text.strip()[:10000]
        if ctype == "text/html" and html_fallback is None:
            html_fallback = text
    if html_fallback:
        text = re.sub(r"<[^>]+>", " ", html_fallback)
        text = text.replace("&nbsp;", " ")
        text = re.sub(r"\\s+", " ", text).strip()
        return text[:10000]
    return ""

for attempt in range(2):
    try:
        sys.stderr.write(f"[imap] Fetching messages (batch of {len(uids)}, first 50KB each)...\\n")
        typ, data = conn.uid("fetch", uid_set, "(BODY.PEEK[]<0.51200>)")
        if typ != "OK":
            raise Exception(f"FETCH returned {typ}")

        decoded_count = 0
        for item in data:
            if not isinstance(item, tuple) or len(item) < 2:
                continue
            meta = item[0].decode("utf-8", errors="replace")
            m = re.search(r"UID (\\d+)", meta)
            if not m:
                continue
            u = int(m.group(1))
            if u in header_map:
                msg = email.message_from_bytes(item[1])
                body_text = get_body(msg)
                if body_text:
                    header_map[u]["body"] = body_text
                    decoded_count += 1

        sys.stderr.write(f"[imap] Bodies decoded: {decoded_count}/{len(uids)}\\n")
        break
    except Exception as e:
        if attempt == 0:
            sys.stderr.write(f"[imap] Body batch failed (attempt 1): {e}, retrying in 3s...\\n")
            time.sleep(3)
            try:
                conn.noop()
            except:
                conn = connect()
        else:
            sys.stderr.write(f"[imap] Body batch failed after retry: {e}\\n")

conn.logout()
results = [header_map[int(u.decode())] for u in uids if int(u.decode()) in header_map]
results.reverse()
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)
`;

const BODY_SCRIPT = `
import imaplib, email, json, sys, re, os, time
from email.header import decode_header, make_header

user = os.environ["GMAIL_USER"]
pw = os.environ["GMAIL_APP_PASS"].replace(" ", "")
uids_str = sys.argv[1]
output_file = sys.argv[2]

def connect():
    c = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    c.login(user, pw)
    c.socket().settimeout(30)
    c.select("INBOX", readonly=True)
    return c

conn = connect()

def get_body(msg):
    html_fallback = None
    for part in (msg.walk() if msg.is_multipart() else [msg]):
        ctype = part.get_content_type()
        disp = str(part.get("Content-Disposition", ""))
        if "attachment" in disp:
            continue
        try:
            payload = part.get_payload(decode=True)
        except:
            continue
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"
        try:
            text = payload.decode(charset, errors="replace")
        except:
            text = payload.decode("utf-8", errors="replace")
        if ctype == "text/plain":
            return text.strip()[:10000]
        if ctype == "text/html" and html_fallback is None:
            html_fallback = text
    if html_fallback:
        text = re.sub(r"<[^>]+>", " ", html_fallback)
        text = text.replace("&nbsp;", " ")
        text = re.sub(r"\\s+", " ", text).strip()
        return text[:10000]
    return ""

uid_list = [u.strip() for u in uids_str.split(",") if u.strip()]
total = len(uid_list)
results = {}

# Batch fetch partial messages (first 50KB, skips large attachments)
uid_set = ",".join(uid_list).encode()
sys.stderr.write(f"[imap] Fetching bodies (batch of {total}, first 50KB each)\\n")

for attempt in range(2):
    try:
        typ, data = conn.uid("fetch", uid_set, "(BODY.PEEK[]<0.51200>)")
        if typ != "OK":
            raise Exception(f"FETCH returned {typ}")
        for item in data:
            if not isinstance(item, tuple) or len(item) < 2:
                continue
            meta = item[0].decode("utf-8", errors="replace")
            m = re.search(r"UID (\\d+)", meta)
            if not m:
                continue
            uid_s = m.group(1)
            msg = email.message_from_bytes(item[1])
            results[uid_s] = get_body(msg)
        sys.stderr.write(f"[imap] Bodies decoded: {len(results)}/{total}\\n")
        break
    except Exception as e:
        if attempt == 0:
            sys.stderr.write(f"[imap] Body batch failed (attempt 1): {e}, retrying in 3s...\\n")
            time.sleep(3)
            try:
                conn.noop()
            except:
                conn = connect()
        else:
            sys.stderr.write(f"[imap] Body batch failed after retry: {e}\\n")

conn.logout()
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)
`;

export async function fetchEmailsSince(sinceDate: Date): Promise<FetchedEmail[]> {
  // Combined: headers (batch) + bodies (BODY.PEEK[1] per UID) in one IMAP session
  const raw = await runPython(COMBINED_SCRIPT, [sinceDate.toISOString(), "", "50"]);
  const data = JSON.parse(raw) as Array<{
    uid: number; subject: string; from: string; to: string[]; date: string; body: string;
  }>;
  console.log(`[imap] Fetched ${data.length} email(s) with bodies`);

  return data.map((h) => ({
    uid: h.uid,
    subject: h.subject,
    from: h.from,
    to: h.to,
    date: h.date ? new Date(h.date) : null,
    body: h.body || "",
    html: null,
  }));
}

export async function fetchBodies(uids: number[]): Promise<Record<number, string>> {
  if (uids.length === 0) return {};
  const out: Record<number, string> = {};

  try {
    const result = await runPython(BODY_SCRIPT, [uids.join(","), ""]);
    const parsed = JSON.parse(result) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) out[Number(k)] = v;
  } catch (err) {
    console.warn(`[imap] Body batch failed:`, err);
  }

  console.log(`[imap] Bodies fetched: ${Object.keys(out).length}/${uids.length}`);
  return out;
}

function runPython(script: string, args: string[]): Promise<string> {
  const tmpOut = join(tmpdir(), `ssal-${Date.now()}.json`);
  const tmpPy = join(tmpdir(), `ssal-${Date.now()}.py`);
  args[1] = tmpOut; // replace output file placeholder

  try {
    writeFileSync(tmpPy, script);
    execFileSync("python3", [tmpPy, ...args], {
      env: { ...process.env },
      timeout: 180_000,
      stdio: ["pipe", "inherit", "inherit"],
    });
    return readFileSync(tmpOut, "utf-8");
  } finally {
    try { unlinkSync(tmpOut); } catch {}
    try { unlinkSync(tmpPy); } catch {}
  }
}
