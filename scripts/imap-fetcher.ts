/**
 * IMAP fetcher - two-pass approach like secondary-agent/gmail_tools.py:
 * Pass 1: fast header fetch (subject, from, to, date) for all emails
 * Pass 2: body fetch only for emails that pass privacy filter
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
 * Combined script: fetches headers (batch) then bodies (BODY.PEEK[1] per UID)
 * in a single IMAP connection. BODY.PEEK[1] fetches only the first MIME part
 * (usually text/plain), avoiding large attachments entirely.
 */
const COMBINED_SCRIPT = `
import imaplib, email, json, sys, re, os, time, quopri, base64
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

# --- Helper: decode a MIME part's transfer encoding + charset ---
def decode_part(raw_bytes, mime_bytes):
    encoding = "7bit"
    charset = "utf-8"
    content_type = "text/plain"
    if mime_bytes:
        mime_msg = email.message_from_bytes(mime_bytes)
        encoding = mime_msg.get("Content-Transfer-Encoding", "7bit").lower().strip()
        ct = mime_msg.get("Content-Type", "text/plain")
        content_type = ct.split(";")[0].strip().lower()
        cs_match = re.search("charset=[\\\"']?([^\\\"';\\\\s]+)", ct, re.I)
        if cs_match:
            charset = cs_match.group(1)
    if encoding == "base64":
        try: decoded = base64.b64decode(raw_bytes)
        except: decoded = raw_bytes
    elif encoding == "quoted-printable":
        try: decoded = quopri.decodestring(raw_bytes)
        except: decoded = raw_bytes
    else:
        decoded = raw_bytes
    try: text = decoded.decode(charset, errors="replace")
    except: text = decoded.decode("utf-8", errors="replace")
    if "html" in content_type:
        text = re.sub(r"<[^>]+>", " ", text)
        text = text.replace("&nbsp;", " ")
        text = re.sub(r"\\s+", " ", text).strip()
    return text.strip()[:10000]

# --- Single batch fetch: headers + first MIME part ---
uid_set = b",".join(uids)
typ, data = conn.uid("fetch", uid_set,
    "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY.PEEK[1] BODY.PEEK[1.MIME])")

header_map = {}
uid_headers = {}
uid_bodies = {}
uid_mimes = {}

for item in data:
    if not isinstance(item, tuple) or len(item) < 2:
        continue
    meta = item[0].decode("utf-8", errors="replace")
    m_uid = re.search(r"UID (\\d+)", meta)
    if not m_uid:
        continue
    uid_val = int(m_uid.group(1))
    if "BODY[HEADER.FIELDS" in meta:
        uid_headers[uid_val] = item[1]
    elif "BODY[1.MIME]" in meta:
        uid_mimes[uid_val] = item[1]
    elif "BODY[1]" in meta:
        uid_bodies[uid_val] = item[1]

for uid_val, raw_hdrs in uid_headers.items():
    headers = email.message_from_bytes(raw_hdrs)
    def hdr(n):
        raw = headers.get(n, "")
        if not raw: return ""
        try: return str(make_header(decode_header(raw))).strip()
        except: return str(raw).strip()
    to_raw = hdr("To")
    to_list = [a.strip() for a in to_raw.split(",") if a.strip()]
    body_text = ""
    if uid_val in uid_bodies:
        body_text = decode_part(uid_bodies[uid_val], uid_mimes.get(uid_val))
    header_map[uid_val] = {
        "uid": uid_val,
        "subject": hdr("Subject"),
        "from": hdr("From"),
        "to": to_list,
        "date": hdr("Date"),
        "body": body_text,
    }

sys.stderr.write(f"[imap] Fetched headers+bodies: {len(header_map)}\\n")

# --- Fallback: UIDs without body (non-multipart messages) - batch BODY.PEEK[TEXT] ---
missing = [u for u in uids if int(u.decode()) in header_map and not header_map[int(u.decode())].get("body")]
if missing:
    sys.stderr.write(f"[imap] Fallback TEXT fetch for {len(missing)} UID(s)\\n")
    for attempt in range(2):
        try:
            missing_set = b",".join(missing)
            typ, data = conn.uid("fetch", missing_set, "(BODY.PEEK[TEXT])")
            if typ == "OK":
                for item in data:
                    if not isinstance(item, tuple) or len(item) < 2:
                        continue
                    meta = item[0].decode("utf-8", errors="replace")
                    m = re.search(r"UID (\\d+)", meta)
                    if not m:
                        continue
                    u = int(m.group(1))
                    if u in header_map:
                        raw = item[1]
                        try: text = raw.decode("utf-8", errors="replace")
                        except: text = str(raw)
                        if "<html" in text.lower() or "<body" in text.lower():
                            text = re.sub(r"<[^>]+>", " ", text)
                            text = text.replace("&nbsp;", " ")
                            text = re.sub(r"\\s+", " ", text).strip()
                        header_map[u]["body"] = text.strip()[:10000]
            break
        except Exception as e:
            if attempt == 0:
                sys.stderr.write(f"[imap] Fallback failed (attempt 1): {e}, retrying in 3s...\\n")
                time.sleep(3)
                try:
                    conn.noop()
                except:
                    conn = connect()
            else:
                sys.stderr.write(f"[imap] Fallback failed after retry: {e}\\n")

conn.logout()
results = [header_map[int(u.decode())] for u in uids if int(u.decode()) in header_map]
results.reverse()
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)
`;

const BODY_SCRIPT = `
import imaplib, email, json, sys, re, os, time, quopri, base64
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

def decode_part(raw_bytes, mime_bytes):
    encoding = "7bit"
    charset = "utf-8"
    content_type = "text/plain"
    if mime_bytes:
        mime_msg = email.message_from_bytes(mime_bytes)
        encoding = mime_msg.get("Content-Transfer-Encoding", "7bit").lower().strip()
        ct = mime_msg.get("Content-Type", "text/plain")
        content_type = ct.split(";")[0].strip().lower()
        cs_match = re.search("charset=[\\\"']?([^\\\"';\\\\s]+)", ct, re.I)
        if cs_match:
            charset = cs_match.group(1)
    if encoding == "base64":
        try: decoded = base64.b64decode(raw_bytes)
        except: decoded = raw_bytes
    elif encoding == "quoted-printable":
        try: decoded = quopri.decodestring(raw_bytes)
        except: decoded = raw_bytes
    else:
        decoded = raw_bytes
    try: text = decoded.decode(charset, errors="replace")
    except: text = decoded.decode("utf-8", errors="replace")
    if "html" in content_type:
        text = re.sub(r"<[^>]+>", " ", text)
        text = text.replace("&nbsp;", " ")
        text = re.sub(r"\\s+", " ", text).strip()
    return text.strip()[:10000]

uid_list = [u.strip() for u in uids_str.split(",") if u.strip()]
total = len(uid_list)
results = {}

for idx, uid_s in enumerate(uid_list, 1):
    sys.stderr.write(f"[imap] Fetching body {idx}/{total} (UID {uid_s})\\n")
    for attempt in range(2):
        try:
            typ, data = conn.uid("fetch", uid_s.encode(), "(BODY.PEEK[1] BODY.PEEK[1.MIME])")
            if typ != "OK":
                raise Exception(f"FETCH returned {typ}")
            body_bytes = None
            mime_bytes = None
            for item in data:
                if not isinstance(item, tuple) or len(item) < 2:
                    continue
                meta = item[0].decode("utf-8", errors="replace")
                if "BODY[1.MIME]" in meta:
                    mime_bytes = item[1]
                elif "BODY[1]" in meta:
                    body_bytes = item[1]
            if body_bytes is None:
                typ2, data2 = conn.uid("fetch", uid_s.encode(), "(BODY.PEEK[TEXT])")
                if typ2 == "OK":
                    for item in data2:
                        if isinstance(item, tuple) and len(item) >= 2:
                            body_bytes = item[1]
                            break
            if body_bytes:
                results[uid_s] = decode_part(body_bytes, mime_bytes)
            else:
                results[uid_s] = ""
            break
        except Exception as e:
            if attempt == 0:
                sys.stderr.write(f"[imap] UID {uid_s} failed (attempt 1): {e}, retrying in 3s...\\n")
                time.sleep(3)
                try:
                    conn.noop()
                except:
                    conn = connect()
            else:
                sys.stderr.write(f"[imap] UID {uid_s} failed after retry: {e}\\n")
                results[uid_s] = ""

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
  const batchSize = 3;

  for (let i = 0; i < uids.length; i += batchSize) {
    const batch = uids.slice(i, i + batchSize);
    try {
      const result = await runPython(BODY_SCRIPT, [batch.join(","), ""]);
      const parsed = JSON.parse(result) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) out[Number(k)] = v;
    } catch (err) {
      console.warn(`[imap] Body batch failed:`, batch);
    }
    if (i + batchSize < uids.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
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
