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

const LIST_SCRIPT = `
import imaplib, email, json, sys, re, os
from email.header import decode_header, make_header
from datetime import datetime

user = os.environ["GMAIL_USER"]
pw = os.environ["GMAIL_APP_PASS"].replace(" ", "")
since_iso = sys.argv[1]
output_file = sys.argv[2]
max_emails = int(sys.argv[3]) if len(sys.argv) > 3 else 50

conn = imaplib.IMAP4_SSL("imap.gmail.com", 993)
conn.login(user, pw)
conn.select("INBOX", readonly=True)

date_str = datetime.fromisoformat(since_iso.replace("Z","+00:00")).strftime("%d-%b-%Y")
typ, data = conn.uid("search", None, f"SINCE {date_str}")
uids = (data[0] or b"").split()
if not uids:
    json.dump([], open(output_file, "w"))
    conn.logout()
    sys.exit(0)

uids = uids[-max_emails:]
uid_set = b",".join(uids)
typ, data = conn.uid("fetch", uid_set, "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])")

results = []
for item in data:
    if not isinstance(item, tuple) or len(item) < 2:
        continue
    meta = item[0].decode("utf-8", errors="replace")
    m_uid = re.search(r"UID (\\d+)", meta)
    if not m_uid:
        continue
    headers = email.message_from_bytes(item[1])
    def hdr(n):
        raw = headers.get(n, "")
        if not raw: return ""
        try: return str(make_header(decode_header(raw))).strip()
        except: return str(raw).strip()
    to_raw = hdr("To")
    to_list = [a.strip() for a in to_raw.split(",") if a.strip()]
    results.append({
        "uid": int(m_uid.group(1)),
        "subject": hdr("Subject"),
        "from": hdr("From"),
        "to": to_list,
        "date": hdr("Date"),
    })

conn.logout()
results.reverse()
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)
`;

const BODY_SCRIPT = `
import imaplib, email, json, sys, re, os
from email.header import decode_header, make_header

user = os.environ["GMAIL_USER"]
pw = os.environ["GMAIL_APP_PASS"].replace(" ", "")
uids_str = sys.argv[1]
output_file = sys.argv[2]

conn = imaplib.IMAP4_SSL("imap.gmail.com", 993)
conn.login(user, pw)
conn.select("INBOX", readonly=True)

def get_body(msg):
    html_fallback = None
    for part in (msg.walk() if msg.is_multipart() else [msg]):
        ctype = part.get_content_type()
        disp = str(part.get("Content-Disposition", ""))
        if "attachment" in disp: continue
        try: payload = part.get_payload(decode=True)
        except: continue
        if not payload: continue
        charset = part.get_content_charset() or "utf-8"
        try: text = payload.decode(charset, errors="replace")
        except: text = payload.decode("utf-8", errors="replace")
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

results = {}
for uid_s in uids_str.split(","):
    uid = uid_s.strip()
    if not uid: continue
    try:
        typ, data = conn.uid("fetch", uid.encode(), "(BODY.PEEK[])")
        if typ == "OK" and data and isinstance(data[0], tuple):
            msg = email.message_from_bytes(data[0][1])
            results[uid] = get_body(msg)
    except Exception as e:
        sys.stderr.write(f"UID {uid}: {e}\\n")

conn.logout()
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)
`;

export async function fetchEmailsSince(sinceDate: Date): Promise<FetchedEmail[]> {
  // Pass 1: headers only (fast)
  const headers = await runPython(LIST_SCRIPT, [sinceDate.toISOString(), "", "50"]);
  const headerData = JSON.parse(headers) as Array<{
    uid: number; subject: string; from: string; to: string[]; date: string;
  }>;
  console.log(`[imap] Headers fetched: ${headerData.length}`);

  return headerData.map((h) => ({
    uid: h.uid,
    subject: h.subject,
    from: h.from,
    to: h.to,
    date: h.date ? new Date(h.date) : null,
    body: "",
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
      timeout: 120_000,
      stdio: ["pipe", "inherit", "inherit"],
    });
    return readFileSync(tmpOut, "utf-8");
  } finally {
    try { unlinkSync(tmpOut); } catch {}
    try { unlinkSync(tmpPy); } catch {}
  }
}
