import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "data", "event.json");
const URL = "https://www.mhct.win/countdown.php";

function toIsoUtcFromMhctValue(v) {
  const m = v.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error("Unexpected date format: " + v);
  const mon = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12}[m[1]];
  if (!mon) throw new Error("Bad month: " + m[1]);
  const yyyy = Number(m[3]);
  const mm = String(mon).padStart(2, "0");
  const dd = String(Number(m[2])).padStart(2, "0");
  const HH = m[4], MM = m[5], SS = m[6];
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}Z`;
}

const res = await fetch(URL, { headers: { "user-agent": "gh-actions" } });
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const html = await res.text();

const titleMatch = html.match(/<h1[^>]*id="eventname"[^>]*>([^<]+)<\/h1>/i);
if (!titleMatch) {
  console.log("Event name not found, skipping");
  process.exit(0);
}

const eventName = titleMatch[1].trim();
if (!/lunar\s+new\s+year/i.test(eventName)) {
  console.log(`Event is "${eventName}", not Lunar New Year. Skipping.`);
  process.exit(0);
}

if (fs.existsSync(OUT)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
    if (prev && /lunar\s+new\s+year/i.test(String(prev.event || ""))) {
      console.log("Lunar New Year already stored in event.json, skipping");
      process.exit(0);
    }
  } catch {}
}

const m = html.match(/id="countdownDate"[^>]*value="([^"]+)"/i);
if (!m) throw new Error("countdownDate not found");

const startIso = toIsoUtcFromMhctValue(m[1]);
const startMs = Date.parse(startIso);
if (!Number.isFinite(startMs)) throw new Error("Bad start: " + startIso);

const endIso = new Date(startMs + 14 * 24 * 3600 * 1000).toISOString().replace(".000Z", "Z");

const payload = {
  event: "Lunar New Year",
  mhct_event_name: eventName,
  start_utc: startIso,
  end_utc: endIso,
  source: "mhct",
  fetched_at_utc: new Date().toISOString().replace(".000Z", "Z")
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log("Wrote", OUT);
