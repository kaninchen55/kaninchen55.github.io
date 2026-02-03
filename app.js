(() => {
  "use strict";

  let EVENT_START_UTC_MS = Date.UTC(2026, 1, 10, 16, 0, 0);
  let EVENT_END_UTC_MS = EVENT_START_UTC_MS + 14 * 24 * 3600 * 1000;

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
    chestsNormal: document.getElementById("chestsNormal"),
    chestsRare: document.getElementById("chestsRare"),
    reserveDumplings: document.getElementById("reserveDumplings"),
    reserveNGD: document.getElementById("reserveNGD"),
    reserveWhite: document.getElementById("reserveWhite"),
    reserveRed: document.getElementById("reserveRed"),
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
    if (planStartMs <= EVENT_START_UTC_MS) return (EVENT_END_UTC_MS - EVENT_START_UTC_MS) / (24 * 3600 * 1000);
    if (planStartMs >= EVENT_END_UTC_MS) return 0;
    return (EVENT_END_UTC_MS - planStartMs) / (24 * 3600 * 1000);
  }

  function remainingHunts(huntsPerDay, planStartMs) {
    const days = remainingDaysFrom(planStartMs);
    return Math.max(0, Math.floor(huntsPerDay * days));
  }

  function totalEventHunts(huntsPerDay) {
    const days = (EVENT_END_UTC_MS - EVENT_START_UTC_MS) / (24 * 3600 * 1000);
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

  function rewardBetween(h0, h1) {
    h0 = Math.max(0, Math.min(MAX_FEET, Math.trunc(h0)));
    h1 = Math.max(0, Math.min(MAX_FEET, Math.trunc(h1)));
    if (h1 <= h0) return { ngd: 0, red: 0 };

    const a = Math.floor(h0 / 30);
    const b = Math.floor(h1 / 30);
    const crossed30Multiples = Math.max(0, b - a);

    let ngd = crossed30Multiples * 3;
    if (h0 < 30 && h1 >= 30) ngd += 5;

    let red = 0;
    if (h0 < 300 && h1 >= 300) red += 5;
    if (h0 < 500 && h1 >= 500) red += 10;

    return { ngd, red };
  }

  function computeBestPlan(p) {
    const huntsPerDay = clampInt(p.huntsPerDay, 0, HUNTS_PER_DAY_CAP);
    const planStart = p.planStartMs;

    const remDays = remainingDaysFrom(planStart);
    const remHunts = remainingHunts(huntsPerDay, planStart);
    const totalHunts = totalEventHunts(huntsPerDay);

    const currentHeight = clampInt(p.currentHeight, 0, MAX_FEET);
    const maxGain = MAX_FEET - currentHeight;

    const chN = Math.max(0, Math.trunc(p.chestsNormal));
    const chR = Math.max(0, Math.trunc(p.chestsRare));

    const chestD = 10 * chN + 20 * chR;
    const chestW = 2 * chN + 6 * chR;

    const dumplings0_raw = Math.max(0, Math.trunc(p.dumplings));
    const ngd0_raw = Math.max(0, Math.trunc(p.ngd));
    const whiteInv0_raw = Math.max(0, Math.trunc(p.whiteInv));
    const redInv0_raw = Math.max(0, Math.trunc(p.redInv));

    const dumplings0 = dumplings0_raw + chestD;
    const ngd0 = ngd0_raw;
    const whiteInv0 = whiteInv0_raw + chestW;
    const redInv0 = redInv0_raw;

    const reserveD = Math.max(0, Math.trunc(p.reserveDumplings));
    const reserveN = Math.max(0, Math.trunc(p.reserveNGD));
    const reserveW = Math.max(0, Math.trunc(p.reserveWhite));
    const reserveR = Math.max(0, Math.trunc(p.reserveRed));

    const rD = clampNum(p.rateDumplings, 0, 1e9);
    const rW = clampNum(p.rateWhite, 0, 1e9);
    const rR = clampNum(p.rateRed, 0, 1e9);

    let best = null;

    const XMAX = Math.min(Math.max(0, ngd0 - reserveN), remHunts);
    const YMAX = remHunts;

    for (let x = 0; x <= XMAX; x++) {
      const whiteFromNGDBase = Math.floor(rW * x);
      const redFromNGDBase = Math.floor(rR * x);

      for (let y = 0; y <= YMAX; y++) {
        let z = 0;
        if (dumplings0 < y + reserveD) {
          if (rD <= 0) continue;
          const need = (y + reserveD) - dumplings0;
          z = ceilDiv(need, rD);
          while (Math.floor(rD * z) < need) z++;
        }

        if (!Number.isFinite(z) || z > 1e12) continue;

        const farming = x + y + z;
        if (farming > remHunts) break;

        const huntsLeft = remHunts - farming;

        const producedD = Math.floor(rD * z);
        if (dumplings0 + producedD - y < reserveD) continue;

        const whiteFromD = Math.floor(rW * y);

        const whiteTotalBase = whiteInv0 + whiteFromNGDBase + whiteFromD;
        const redTotalBase = redInv0 + redFromNGDBase;

        let rewardNGD = 0;
        let rewardRed = 0;

        let spendRed = 0;
        let spendWhite = 0;
        let endHeight = currentHeight;
        let spendBudget = 0;

        for (let iter = 0; iter < 12; iter++) {
          const spendableWhite = Math.max(0, whiteTotalBase - reserveW);
          const spendableRed = Math.max(0, (redTotalBase + rewardRed) - reserveR);
          const spendableCandles = spendableWhite + spendableRed;

          spendBudget = Math.min(huntsLeft, spendableCandles);
          spendRed = Math.min(spendableRed, spendBudget);
          spendWhite = spendBudget - spendRed;

          const gain = Math.min(maxGain, spendWhite + 2 * spendRed);
          endHeight = Math.min(MAX_FEET, currentHeight + gain);

          const rwd = rewardBetween(currentHeight, endHeight);
          if (rwd.ngd === rewardNGD && rwd.red === rewardRed) break;

          rewardNGD = rwd.ngd;
          rewardRed = rwd.red;
        }

        if (ngd0 + rewardNGD - x < reserveN) continue;

        const afterWhite = whiteTotalBase - spendWhite;
        const afterRed = (redTotalBase + rewardRed) - spendRed;

        if (afterWhite < reserveW) continue;
        if (afterRed < reserveR) continue;

        const gainFinal = Math.min(maxGain, spendWhite + 2 * spendRed);
        const endHeightFinal = Math.min(MAX_FEET, currentHeight + gainFinal);

        const canKeepUntilEnd = (spendBudget >= huntsLeft);

        const dumplingsAfter = dumplings0 + producedD - y;
        const ngdAfter = ngd0 + rewardNGD - x;

        const key = [-endHeightFinal, canKeepUntilEnd ? 0 : 1, -spendBudget, farming];

        if (!best || lexLess(key, best.key)) {
          best = {
            key,
            huntsPerDay,
            planStartMs: planStart,
            remDays,
            remHunts,
            totalHunts,

            currentHeight,
            endHeight: endHeightFinal,
            gain: gainFinal,
            maxGain,

            x, y, z,
            farming,
            huntsLeft,

            spendBudget,
            canKeepUntilEnd,
            spendRed,
            spendWhite,

            rD, rW, rR,

            chN, chR,
            chestD, chestW,

            dumplings0_raw,
            ngd0_raw,
            whiteInv0_raw,
            redInv0_raw,

            dumplings0, ngd0, whiteInv0, redInv0,
            reserveD, reserveN, reserveW, reserveR,

            producedD,
            whiteFromNGD: whiteFromNGDBase,
            redFromNGD: redFromNGDBase,
            whiteFromD,

            rewardNGD,
            rewardRed,

            whiteTotalBase,
            redTotalBase,

            dumplingsAfter,
            ngdAfter,
            whiteAfter: afterWhite,
            redAfter: afterRed,

            farmedDumplings: producedD,
            farmedWhite: whiteFromNGDBase + whiteFromD,
            farmedRed: redFromNGDBase,
          };
        }
      }
    }

    if (!best) {
      const huntsLeft = remHunts;

      const whiteTotalBase = whiteInv0;
      const redTotalBase = redInv0;

      let rewardNGD = 0;
      let rewardRed = 0;

      let spendRed = 0;
      let spendWhite = 0;
      let endHeight = currentHeight;
      let spendBudget = 0;

      for (let iter = 0; iter < 12; iter++) {
        const spendableWhite = Math.max(0, whiteTotalBase - reserveW);
        const spendableRed = Math.max(0, (redTotalBase + rewardRed) - reserveR);
        const spendableCandles = spendableWhite + spendableRed;

        spendBudget = Math.min(huntsLeft, spendableCandles);
        spendRed = Math.min(spendableRed, spendBudget);
        spendWhite = spendBudget - spendRed;

        const gain = Math.min(MAX_FEET - currentHeight, spendWhite + 2 * spendRed);
        endHeight = Math.min(MAX_FEET, currentHeight + gain);

        const rwd = rewardBetween(currentHeight, endHeight);
        if (rwd.ngd === rewardNGD && rwd.red === rewardRed) break;

        rewardNGD = rwd.ngd;
        rewardRed = rwd.red;
      }

      const afterWhite = whiteTotalBase - spendWhite;
      const afterRed = (redTotalBase + rewardRed) - spendRed;

      best = {
        key: [-endHeight, 1, -spendBudget, 0],
        huntsPerDay,
        planStartMs: planStart,
        remDays,
        remHunts,
        totalHunts,

        currentHeight,
        endHeight,
        gain: Math.min(MAX_FEET - currentHeight, spendWhite + 2 * spendRed),
        maxGain: MAX_FEET - currentHeight,

        x: 0, y: 0, z: 0,
        farming: 0,
        huntsLeft,

        spendBudget,
        canKeepUntilEnd: (spendBudget >= huntsLeft),
        spendRed,
        spendWhite,

        rD, rW, rR,

        chN, chR,
        chestD, chestW,

        dumplings0_raw,
        ngd0_raw,
        whiteInv0_raw,
        redInv0_raw,

        dumplings0, ngd0, whiteInv0, redInv0,
        reserveD, reserveN, reserveW, reserveR,

        producedD: 0,
        whiteFromNGD: 0,
        redFromNGD: 0,
        whiteFromD: 0,

        rewardNGD,
        rewardRed,

        whiteTotalBase,
        redTotalBase,

        dumplingsAfter: dumplings0,
        ngdAfter: ngd0 + rewardNGD,
        whiteAfter: afterWhite,
        redAfter: afterRed,

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
    const daysAtRateRem = plan.huntsPerDay > 0 ? (plan.remHunts / plan.huntsPerDay) : 0;
    const daysAtRateTotal = plan.huntsPerDay > 0 ? (plan.totalHunts / plan.huntsPerDay) : 0;

    const days = (hunts) => (plan.huntsPerDay > 0 ? (hunts / plan.huntsPerDay) : 0);

    const summary = `
      <div class="kv">
        <div class="tile">
          <div class="k">Total hunts (full event)</div>
          <div class="v">${fmt(plan.totalHunts)} (${fmt2(daysAtRateTotal)} days at ${fmt(plan.huntsPerDay)}/day)</div>
        </div>
        <div class="tile">
          <div class="k">Remaining hunts (from planning start)</div>
          <div class="v">${fmt(plan.remHunts)} (${fmt2(daysAtRateRem)} days)</div>
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
            <th class="right">Days</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Farm dumplings</td>
            <td class="right mono">${fmt(plan.z)}</td>
            <td class="right mono">${fmt2(days(plan.z))}</td>
          </tr>
          <tr>
            <td>Farm white candles (dumpling cheese)</td>
            <td class="right mono">${fmt(plan.y)}</td>
            <td class="right mono">${fmt2(days(plan.y))}</td>
          </tr>
          <tr>
            <td>Farm candles (NGD)</td>
            <td class="right mono">${fmt(plan.x)}</td>
            <td class="right mono">${fmt2(days(plan.x))}</td>
          </tr>
          <tr>
            <td>Burn candles (red-first)</td>
            <td class="right mono">${fmt(plan.spendBudget)}</td>
            <td class="right mono">${fmt2(days(plan.spendBudget))}</td>
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
            <th class="right">Chests</th>
            <th class="right">Farmed</th>
            <th class="right">Reward track</th>
            <th class="right">Reserve</th>
            <th class="right">After event</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dumplings</td>
            <td class="right mono">${fmt(plan.dumplings0_raw)}</td>
            <td class="right mono">${fmt(plan.chestD)}</td>
            <td class="right mono">${fmt(plan.farmedDumplings)}</td>
            <td class="right mono">0</td>
            <td class="right mono">${fmt(plan.reserveD)}</td>
            <td class="right mono">${fmt(plan.dumplingsAfter)}</td>
          </tr>
          <tr>
            <td>NGD</td>
            <td class="right mono">${fmt(plan.ngd0_raw)}</td>
            <td class="right mono">0</td>
            <td class="right mono">0</td>
            <td class="right mono">${fmt(plan.rewardNGD)}</td>
            <td class="right mono">${fmt(plan.reserveN)}</td>
            <td class="right mono">${fmt(plan.ngdAfter)}</td>
          </tr>
          <tr>
            <td>White candles</td>
            <td class="right mono">${fmt(plan.whiteInv0_raw)}</td>
            <td class="right mono">${fmt(plan.chestW)}</td>
            <td class="right mono">${fmt(plan.farmedWhite)}</td>
            <td class="right mono">0</td>
            <td class="right mono">${fmt(plan.reserveW)}</td>
            <td class="right mono">${fmt(plan.whiteAfter)}</td>
          </tr>
          <tr>
            <td>Red candles</td>
            <td class="right mono">${fmt(plan.redInv0_raw)}</td>
            <td class="right mono">0</td>
            <td class="right mono">${fmt(plan.farmedRed)}</td>
            <td class="right mono">${fmt(plan.rewardRed)}</td>
            <td class="right mono">${fmt(plan.reserveR)}</td>
            <td class="right mono">${fmt(plan.redAfter)}</td>
          </tr>
        </tbody>
      </table>
    `;

    resultEl.innerHTML = summary + alloc + resources;
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
      chestsNormal: inp.chestsNormal.value,
      chestsRare: inp.chestsRare.value,
      reserveDumplings: inp.reserveDumplings.value,
      reserveNGD: inp.reserveNGD.value,
      reserveWhite: inp.reserveWhite.value,
      reserveRed: inp.reserveRed.value,
      rateDumplings: inp.rateDumplings.value,
      rateWhite: inp.rateWhite.value,
      rateRed: inp.rateRed.value,
    };
  }

  async function loadEventFromRepo() {
    try {
      const res = await fetch("./data/event.json", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const s = Date.parse(j.start_utc);
      const e = Date.parse(j.end_utc);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
        EVENT_START_UTC_MS = s;
        EVENT_END_UTC_MS = e;
      }
    } catch {}
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

  window.addEventListener("DOMContentLoaded", async () => {
    await loadEventFromRepo();
    init();
    setStatus("Ready", "ok");
  });
})();
