(() => {
  "use strict";

  const EVENT_START_UTC_MS = Date.UTC(2026, 1, 10, 16, 0, 0);
  const EVENT_DAYS = 14;
  const EVENT_END_UTC_MS = EVENT_START_UTC_MS + EVENT_DAYS * 24 * 3600 * 1000;

  const MAX_FEET = 500;
  const HUNTS_PER_DAY_CAP = 120;

  const btnCompute = document.getElementById("btnCompute");
  const statusEl = document.getElementById("status");
  const eventBox = document.getElementById("eventBox");
  const resultEl = document.getElementById("result");

  const inp = {
    planStart: document.getElementById("planStart"),
    huntsPerDay: document.getElementById("huntsPerDay"),
    currentHeight: document.getElementById("currentHeight"),
    dumplings: document.getElementById("dumplings"),
    ngd: document.getElementById("ngd"),
    whiteInv: document.getElementById("whiteInv"),
    redInv: document.getElementById("redInv"),
    leaveDumplings: document.getElementById("leaveDumplings"),
    leaveNGD: document.getElementById("leaveNGD"),
    leaveWhite: document.getElementById("leaveWhite"),
    leaveRed: document.getElementById("leaveRed"),
    rateDumplings: document.getElementById("rateDumplings"),
    rateWhite: document.getElementById("rateWhite"),
    rateRed: document.getElementById("rateRed"),
  };

  const clampNum = (v, lo, hi) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = 0;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  };
  const clampInt = (v, lo, hi) => Math.trunc(clampNum(v, lo, hi));
  const ceilDiv = (a, b) => Math.ceil((a / b) - 1e-12);

  const setStatus = (txt, cls) => {
    statusEl.className = "pill " + (cls || "");
    statusEl.innerHTML = `<span class="dot"></span>${txt}`;
  };

  const pad = (n) => String(n).padStart(2, "0");

  function fmtUTC(ms) {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  }

  function toDateTimeLocalValue(msUtc) {
    const d = new Date(msUtc);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseDateTimeLocalToMs(s) {
    if (!s || typeof s !== "string") return NaN;
    const d = new Date(s);
    const t = d.getTime();
    return Number.isNaN(t) ? NaN : t;
  }

  function parsePlanStartClamped() {
    const raw = parseDateTimeLocalToMs(inp.planStart.value);
    let ms = Number.isFinite(raw) ? raw : Date.now();
    if (ms < EVENT_START_UTC_MS) ms = EVENT_START_UTC_MS;
    if (ms > EVENT_END_UTC_MS) ms = EVENT_END_UTC_MS;
    return ms;
  }

  function remainingDaysFrom(planStartMs) {
    if (planStartMs <= EVENT_START_UTC_MS) return EVENT_DAYS;
    if (planStartMs >= EVENT_END_UTC_MS) return 0;
    return (EVENT_END_UTC_MS - planStartMs) / (24 * 3600 * 1000);
  }

  function remainingHunts(huntsPerDay, planStartMs) {
    const days = remainingDaysFrom(planStartMs);
    return Math.max(0, Math.floor(huntsPerDay * days));
  }

  function lexLess(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av < bv) return true;
      if (av > bv) return false;
    }
    return false;
  }

  function computeBestPlan(p) {
    const huntsPerDay = clampInt(p.huntsPerDay, 0, HUNTS_PER_DAY_CAP);
    const planStart = p.planStartMs;
    const remDays = remainingDaysFrom(planStart);
    const remHunts = remainingHunts(huntsPerDay, planStart);

    const currentHeight = clampInt(p.currentHeight, 0, MAX_FEET);
    const maxGain = MAX_FEET - currentHeight;

    const dumplings0 = Math.max(0, Math.trunc(p.dumplings));
    const ngd0 = Math.max(0, Math.trunc(p.ngd));
    const whiteInv0 = Math.max(0, Math.trunc(p.whiteInv));
    const redInv0 = Math.max(0, Math.trunc(p.redInv));

    const leaveD = Math.max(0, Math.trunc(p.leaveDumplings));
    const leaveN = Math.max(0, Math.trunc(p.leaveNGD));
    const leaveW = Math.max(0, Math.trunc(p.leaveWhite));
    const leaveR = Math.max(0, Math.trunc(p.leaveRed));

    const rD = clampNum(p.rateDumplings, 0, 1e9);
    const rW = clampNum(p.rateWhite, 0, 1e9);
    const rR = clampNum(p.rateRed, 0, 1e9);

    let best = null;

    const XMAX = Math.min(Math.max(0, ngd0 - leaveN), remHunts);
    const YMAX = remHunts;

    for (let x = 0; x <= XMAX; x++) {
      const whiteFromNGD = Math.floor(rW * x);
      const redFromNGD = Math.floor(rR * x);

      for (let y = 0; y <= YMAX; y++) {
        let z = 0;
        if (dumplings0 < y + leaveD) {
          if (rD <= 0) continue;
          const need = (y + leaveD) - dumplings0;
          z = ceilDiv(need, rD);
          while (Math.floor(rD * z) < need) z++;
        }

        if (!Number.isFinite(z) || z > 1e12) continue;

        const farming = x + y + z;
        if (farming > remHunts) break;

        const huntsLeft = remHunts - farming;

        const producedD = Math.floor(rD * z);
        if (dumplings0 + producedD - y < leaveD) continue;
        if (ngd0 - x < leaveN) continue;

        const whiteFromD = Math.floor(rW * y);

        const whiteTotal = whiteInv0 + whiteFromNGD + whiteFromD;
        const redTotal = redInv0 + redFromNGD;

        const spendableWhite = Math.max(0, whiteTotal - leaveW);
        const spendableRed = Math.max(0, redTotal - leaveR);
        const spendableCandles = spendableWhite + spendableRed;

        const spendBudget = Math.min(huntsLeft, spendableCandles);

        const spendRed = Math.min(spendableRed, spendBudget);
        const spendWhite = spendBudget - spendRed;

        const afterWhite = whiteTotal - spendWhite;
        const afterRed = redTotal - spendRed;

        if (afterWhite < leaveW) continue;
        if (afterRed < leaveR) continue;

        const gain = Math.min(maxGain, spendWhite + 2 * spendRed);
        const endHeight = Math.min(MAX_FEET, currentHeight + gain);

        const canKeepUntilEnd = (spendBudget >= huntsLeft);

        const dumplingsAfter = dumplings0 + producedD - y;
        const ngdAfter = ngd0 - x;

        const key = [-endHeight, canKeepUntilEnd ? 0 : 1, -spendBudget, farming];

        if (!best || lexLess(key, best.key)) {
          best = {
            key,
            huntsPerDay,
            planStartMs: planStart,
            remDays,
            remHunts,

            currentHeight,
            endHeight,
            gain,
            maxGain,

            x, y, z,
            farming,
            huntsLeft,

            spendBudget,
            canKeepUntilEnd,
            spendRed,
            spendWhite,

            rD, rW, rR,

            dumplings0, ngd0, whiteInv0, redInv0,
            leaveD, leaveN, leaveW, leaveR,

            producedD,
            whiteFromNGD,
            redFromNGD,
            whiteFromD,

            whiteTotal,
            redTotal,

            dumplingsAfter,
            ngdAfter,
            whiteAfter: afterWhite,
            redAfter: afterRed,

            farmedDumplings: producedD,
            farmedWhite: whiteFromNGD + whiteFromD,
            farmedRed: redFromNGD,
          };
        }
      }
    }

    if (!best) {
      const huntsLeft = remHunts;

      const whiteTotal = whiteInv0;
      const redTotal = redInv0;

      const spendableWhite = Math.max(0, whiteTotal - leaveW);
      const spendableRed = Math.max(0, redTotal - leaveR);
      const spendableCandles = spendableWhite + spendableRed;

      const spendBudget = Math.min(huntsLeft, spendableCandles);
      const spendRed = Math.min(spendableRed, spendBudget);
      const spendWhite = spendBudget - spendRed;

      const gain = Math.min(MAX_FEET - currentHeight, spendWhite + 2 * spendRed);
      const endHeight = Math.min(MAX_FEET, currentHeight + gain);

      best = {
        key: [-endHeight, 1, -spendBudget, 0],
        huntsPerDay,
        planStartMs: planStart,
        remDays,
        remHunts,

        currentHeight,
        endHeight,
        gain,
        maxGain: MAX_FEET - currentHeight,

        x: 0, y: 0, z: 0,
        farming: 0,
        huntsLeft,

        spendBudget,
        canKeepUntilEnd: (spendBudget >= huntsLeft),
        spendRed,
        spendWhite,

        rD, rW, rR,

        dumplings0, ngd0, whiteInv0, redInv0,
        leaveD, leaveN, leaveW, leaveR,

        producedD: 0,
        whiteFromNGD: 0,
        redFromNGD: 0,
        whiteFromD: 0,

        whiteTotal,
        redTotal,

        dumplingsAfter: dumplings0,
        ngdAfter: ngd0,
        whiteAfter: whiteTotal - spendWhite,
        redAfter: redTotal - spendRed,

        farmedDumplings: 0,
        farmedWhite: 0,
        farmedRed: 0,
      };
    }

    return best;
  }

  function fmt(n) {
    if (!Number.isFinite(n)) return "—";
    return String(n);
  }

  function fmt2(n) {
    if (!Number.isFinite(n)) return "—";
    return Number(n).toFixed(2);
  }

  function renderEventBox(planStartMs) {
    const now = Date.now();
    const activeNow = now >= EVENT_START_UTC_MS && now < EVENT_END_UTC_MS;

    eventBox.textContent =
      `Start: ${fmtUTC(EVENT_START_UTC_MS)}\n` +
      `End:   ${fmtUTC(EVENT_END_UTC_MS)}\n` +
      `Now:   ${fmtUTC(now)}\n` +
      `Event active now: ${activeNow}\n` +
      `Planning start used: ${fmtUTC(planStartMs)}\n`;
  }

  function renderPlan(plan) {
    const daysAtRate = plan.huntsPerDay > 0 ? (plan.remHunts / plan.huntsPerDay) : 0;

    const summary = `
      <div class="kv">
        <div class="tile">
          <div class="k">Remaining time</div>
          <div class="v">${fmt2(plan.remDays)} days</div>
        </div>
        <div class="tile">
          <div class="k">Remaining hunts</div>
          <div class="v">${fmt(plan.remHunts)} (${fmt2(daysAtRate)} days at ${fmt(plan.huntsPerDay)}/day)</div>
        </div>
        <div class="tile">
          <div class="k">End height</div>
          <div class="v">${fmt(plan.endHeight)} ft <span style="opacity:.6;">(gain ${fmt(plan.gain)} / max ${fmt(plan.maxGain)})</span></div>
        </div>
        <div class="tile">
          <div class="k">Candles lit until end</div>
          <div class="v">${plan.canKeepUntilEnd ? "YES" : "NO"} <span style="opacity:.6;">(burn ${fmt(plan.spendBudget)} candles)</span></div>
        </div>
      </div>
    `;

    const alloc = `
      <table>
        <thead>
          <tr>
            <th>Phase</th>
            <th class="right">Hunts</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Farm dumplings</td>
            <td class="right mono">${fmt(plan.z)}</td>
          </tr>
          <tr>
            <td>Farm white candles (dumpling cheese)</td>
            <td class="right mono">${fmt(plan.y)}</td>
          </tr>
          <tr>
            <td>Farm candles (NGD)</td>
            <td class="right mono">${fmt(plan.x)}</td>
          </tr>
          <tr>
            <td>Burn candles (red-first)</td>
            <td class="right mono">${fmt(plan.spendBudget)}</td>
          </tr>
        </tbody>
      </table>
    `;

    const resources = `
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th class="right">Start</th>
            <th class="right">Farmed during event</th>
            <th class="right">Leave</th>
            <th class="right">After event</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dumplings</td>
            <td class="right mono">${fmt(plan.dumplings0)}</td>
            <td class="right mono">${fmt(plan.farmedDumplings)}</td>
            <td class="right mono">${fmt(plan.leaveD)}</td>
            <td class="right mono">${fmt(plan.dumplingsAfter)}</td>
          </tr>
          <tr>
            <td>NGD</td>
            <td class="right mono">${fmt(plan.ngd0)}</td>
            <td class="right mono">0</td>
            <td class="right mono">${fmt(plan.leaveN)}</td>
            <td class="right mono">${fmt(plan.ngdAfter)}</td>
          </tr>
          <tr>
            <td>White candles</td>
            <td class="right mono">${fmt(plan.whiteInv0)}</td>
            <td class="right mono">${fmt(plan.farmedWhite)}</td>
            <td class="right mono">${fmt(plan.leaveW)}</td>
            <td class="right mono">${fmt(plan.whiteAfter)}</td>
          </tr>
          <tr>
            <td>Red candles</td>
            <td class="right mono">${fmt(plan.redInv0)}</td>
            <td class="right mono">${fmt(plan.farmedRed)}</td>
            <td class="right mono">${fmt(plan.leaveR)}</td>
            <td class="right mono">${fmt(plan.redAfter)}</td>
          </tr>
        </tbody>
      </table>
    `;

    const spend = `
      <div class="kv">
        <div class="tile">
          <div class="k">Spend split</div>
          <div class="v">red ${fmt(plan.spendRed)} + white ${fmt(plan.spendWhite)} = ${fmt(plan.spendBudget)}</div>
        </div>
      </div>
    `;

    resultEl.innerHTML = summary + alloc + resources + spend;
  }

  function readInputs(planStartMs) {
    return {
      planStartMs,
      huntsPerDay: inp.huntsPerDay.value,
      currentHeight: inp.currentHeight.value,
      dumplings: inp.dumplings.value,
      ngd: inp.ngd.value,
      whiteInv: inp.whiteInv.value,
      redInv: inp.redInv.value,
      leaveDumplings: inp.leaveDumplings.value,
      leaveNGD: inp.leaveNGD.value,
      leaveWhite: inp.leaveWhite.value,
      leaveRed: inp.leaveRed.value,
      rateDumplings: inp.rateDumplings.value,
      rateWhite: inp.rateWhite.value,
      rateRed: inp.rateRed.value,
    };
  }

  function init() {
    const now = Date.now();
    let defaultMs = now;
    if (defaultMs < EVENT_START_UTC_MS) defaultMs = EVENT_START_UTC_MS;
    if (defaultMs > EVENT_END_UTC_MS) defaultMs = EVENT_END_UTC_MS;
    inp.planStart.value = toDateTimeLocalValue(defaultMs);
    renderEventBox(defaultMs);
  }

  inp.planStart.addEventListener("change", () => {
    const ms = parsePlanStartClamped();
    inp.planStart.value = toDateTimeLocalValue(ms);
    renderEventBox(ms);
    setStatus("Ready", "ok");
  });

  btnCompute.addEventListener("click", () => {
    try {
      setStatus("Computing…", "warn");

      const ms = parsePlanStartClamped();
      inp.planStart.value = toDateTimeLocalValue(ms);
      renderEventBox(ms);

      const params = readInputs(ms);
      const plan = computeBestPlan(params);

      renderPlan(plan);

      setStatus("Done", "ok");
    } catch (e) {
      setStatus("Error", "bad");
      resultEl.innerHTML = `<div class="box">${String(e && e.message ? e.message : e)}</div>`;
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    init();
    setStatus("Ready", "ok");
  });
})();
