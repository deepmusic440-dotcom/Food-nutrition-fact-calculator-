/* NutriLog: nutrition facts calculator and daily intake tracker. All data lives in localStorage. */
(function () {
  "use strict";

  // ---------- Constants ----------
  const NUTRIENTS = [
    { key: "kcal", label: "Calories", unit: "kcal" },
    { key: "pro", label: "Protein", unit: "g", dv: 50 },
    { key: "carb", label: "Carbohydrates", unit: "g", dv: 275 },
    { key: "fat", label: "Fat", unit: "g", dv: 78 },
    { key: "fib", label: "Fiber", unit: "g", dv: 28 },
    { key: "sug", label: "Sugars", unit: "g" },
    { key: "sat", label: "Saturated fat", unit: "g", dv: 20 },
    { key: "chol", label: "Cholesterol", unit: "mg", dv: 300 },
    { key: "na", label: "Sodium", unit: "mg", dv: 2300 },
  ];
  const NK = NUTRIENTS.map((n) => n.key);
  const NBY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]));
  const MEALS = [
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "snacks", label: "Snacks" },
  ];
  const OZ = 28.3495;
  const GLASS_OZ = 8; // one glass of water, in fluid ounces
  const STORE_KEY = "nutrilog:v1";
  const DEFAULT_GOALS = { kcal: 2000, pro: 100, carb: 250, fat: 70, fib: 28, sug: 50, sat: 20, chol: 300, na: 2300 };
  // "Limit" nutrients turn red when exceeded; others are targets to reach.
  const LIMITS = new Set(["kcal", "sug", "sat", "chol", "na", "fat", "carb"]);

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const zero = () => Object.fromEntries(NK.map((k) => [k, 0]));
  const round = (v, d = 0) => { const m = 10 ** d; return Math.round((v + Number.EPSILON) * m) / m; };
  const fmt = (v, key) => {
    if (key === "kcal" || key === "na" || key === "chol") return Math.round(v).toLocaleString();
    return v < 10 ? String(round(v, 1)) : String(Math.round(v));
  };
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
  const todayKey = () => dateKey(new Date());

  function scale(per100, grams) {
    const out = zero();
    for (const k of NK) out[k] = ((per100 && per100[k]) || 0) * grams / 100;
    return out;
  }
  function sum(list) {
    const t = zero();
    for (const n of list) for (const k of NK) t[k] += (n && n[k]) || 0;
    return t;
  }
  function toGrams(food, amount, unit) {
    const a = Number(amount) || 0;
    if (unit === "oz") return a * OZ;
    if (unit === "serving") return a * ((food.serving && food.serving.g) || 100);
    return a;
  }
  function unitText(food, amount, unit) {
    const a = round(Number(amount) || 0, 2);
    if (unit === "g") return `${a} g`;
    if (unit === "oz") return `${a} oz`;
    const s = food.serving ? food.serving.label : "serving";
    return a === 1 ? s : `${a} × ${s}`;
  }

  // ---------- Storage ----------
  function defaultState() {
    return { log: {}, water: {}, exercise: {}, weights: {}, units: "imperial", custom: [], goals: { ...DEFAULT_GOALS }, waterGoal: 8, recent: [], draft: { name: "", servings: 1, items: [] } };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return null;
  }
  function waterList(v) {
    if (Array.isArray(v)) return v.map(Number).filter((x) => x > 0);
    const n = Number(v) || 0;
    return n > 0 ? [n * GLASS_OZ] : [];
  }
  const waterOz = (k) => (state.water[k] || []).reduce((a, x) => a + x, 0);
  function normalize(s) {
    const d = defaultState();
    const out = { ...d, ...s };
    out.goals = { ...DEFAULT_GOALS, ...(s.goals || {}) };
    out.draft = { ...d.draft, ...(s.draft || {}) };
    if (!Array.isArray(out.draft.items)) out.draft.items = [];
    if (!Array.isArray(out.custom)) out.custom = [];
    if (!Array.isArray(out.recent)) out.recent = [];
    if (typeof out.log !== "object" || !out.log) out.log = {};
    if (typeof out.water !== "object" || !out.water) out.water = {};
    // Water is a list of fl oz amounts per day; older saves stored a glass count.
    for (const k of Object.keys(out.water)) out.water[k] = waterList(out.water[k]);
    if (typeof out.exercise !== "object" || !out.exercise) out.exercise = {};
    if (typeof out.weights !== "object" || !out.weights) out.weights = {};
    if (out.units !== "metric") out.units = "imperial";
    return out;
  }
  // Two storage backends: localStorage when opened as plain files, and the artifact's
  // database when hosted on claude.ai (so entries added from chat show up live).
  // In db mode each day is one document `days/<YYYY-MM-DD>` and settings live in `config/main`.
  const store = { mode: window.claude && typeof window.claude.use === "function" ? "pending" : "local", db: null, written: new Map(), timer: null, chain: Promise.resolve() };
  const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x));
  const dayBody = (k) => ({ entries: state.log[k] || [], water: state.water[k] || [], exercise: state.exercise[k] || [] });
  const configBody = () => ({ goals: state.goals, waterGoal: state.waterGoal, units: state.units, weights: state.weights, custom: state.custom, recent: state.recent, draft: state.draft });

  function save() {
    if (store.mode === "db") {
      clearTimeout(store.timer);
      store.timer = setTimeout(flushDb, 300);
      return;
    }
    if (store.mode !== "local") return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function flushDb() {
    const writes = [];
    const days = new Set([...Object.keys(state.log), ...Object.keys(state.water), ...Object.keys(state.exercise)]);
    for (const p of store.written.keys()) if (p.startsWith("days/")) days.add(p.slice(5));
    for (const k of days) {
      const path = "days/" + k;
      const body = dayBody(k);
      const empty = !body.entries.length && !body.water.length && !body.exercise.length;
      const prev = store.written.get(path);
      if (empty) {
        if (prev !== undefined) { store.written.delete(path); writes.push(() => store.db.doc(path).delete()); }
      } else {
        const c = canon(body);
        if (c !== prev) { store.written.set(path, c); writes.push(() => store.db.doc(path).set(JSON.parse(JSON.stringify(body)))); }
      }
    }
    const cb = configBody();
    const cc = canon(cb);
    if (cc !== store.written.get("config/main")) { store.written.set("config/main", cc); writes.push(() => store.db.doc("config/main").set(JSON.parse(JSON.stringify(cb)))); }
    // One write at a time, in order
    for (const w of writes) {
      store.chain = store.chain.then(w).catch((e) => {
        const code = (e && e.code) || "unknown";
        store.lastError = code;
        toast(code === "quota_exceeded" ? "Storage is full. Delete old days to keep saving." : `Couldn't save that change (${code}). Check your connection and try again.`);
        document.dispatchEvent(new CustomEvent("nutrilog:save-error", { detail: code }));
      });
    }
  }

  let state = store.mode === "local" ? load() : null;
  const firstRun = store.mode === "local" && !state;
  if (!state) state = defaultState();

  // ---------- Food lookup ----------
  function allFoods() { return state.custom.concat(BUILTIN_FOODS); }
  function findFood(id) { return allFoods().find((f) => f.id === id); }
  function snapshot(food) {
    return { id: food.id, name: food.name, brand: food.brand || "", per100: { ...food.per100 }, serving: food.serving ? { ...food.serving } : null, source: food.source };
  }
  function pushRecent(food) {
    state.recent = [food.id].concat(state.recent.filter((id) => id !== food.id)).slice(0, 12);
  }
  // Foods that came from the online search are remembered so they stay pickable from "Recent".
  const onlineCache = new Map();

  function searchFoods(q, cat) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const pool = allFoods().filter((f) => !cat || (cat === "Mine" ? f.source === "custom" : f.cat === cat));
    if (!words.length) return pool;
    const scored = [];
    for (const f of pool) {
      const name = f.name.toLowerCase();
      let score = 0;
      let ok = true;
      for (const w of words) {
        const i = name.indexOf(w);
        if (i < 0) { ok = false; break; }
        score += i === 0 ? 3 : /\W/.test(name[i - 1]) ? 2 : 1;
      }
      if (ok) scored.push([score + (f.source === "custom" ? 1 : 0), f]);
    }
    return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).map((x) => x[1]);
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2400);
  }

  // ---------- Tabs ----------
  const views = ["today", "calc", "foods", "history", "goals"];
  function showView(v) {
    if (!views.includes(v)) v = "today";
    for (const name of views) {
      $("#view-" + name).hidden = name !== v;
      $("#tab-" + name).setAttribute("aria-selected", String(name === v));
    }
    try { localStorage.setItem("nutrilog:view", v); } catch (e) { /* ignore */ }
    if (v === "history") renderHistory();
    if (v === "calc") renderCalc();
    if (v === "foods") renderCustomList();
  }
  $$(".tab").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

  // ---------- TODAY ----------
  let currentDay = todayKey();
  const dayEntries = (k = currentDay) => state.log[k] || [];

  function dayLabel(k) {
    const t = todayKey();
    if (k === t) return "Today";
    if (k === addDays(t, -1)) return "Yesterday";
    if (k === addDays(t, 1)) return "Tomorrow";
    return parseKey(k).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  // Ring that fills toward a goal. `label` sits in the middle; `sub` underneath it.
  function ringSVG(value, goal, { size = 120, stroke = 10, color = "var(--accent)", label = "", sub = "", aria = "" } = {}) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, m = size / 2;
    const p = goal > 0 ? Math.min(value / goal, 1) : 0;
    const over = goal > 0 && value > goal * 1.0001;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(aria)}">
      <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="${stroke}"/>
      <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${over ? "var(--bad)" : color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${m} ${m})"/>
      <text x="${m}" y="${sub ? m + size * 0.02 : m + size * 0.07}" text-anchor="middle" fill="var(--ink)" style="font:800 ${size * 0.2}px var(--f-display)">${label}</text>
      ${sub ? `<text x="${m}" y="${m + size * 0.17}" text-anchor="middle" fill="var(--muted)" style="font:500 ${size * 0.095}px var(--f-body)">${sub}</text>` : ""}
    </svg>`;
  }

  const exerciseKcal = (k = currentDay) => (state.exercise[k] || []).reduce((a, x) => a + (Number(x.kcal) || 0), 0);
  function streakDays() {
    let k = todayKey();
    if (!dayEntries(k).length) k = addDays(k, -1);
    let n = 0;
    while (dayEntries(k).length) { n++; k = addDays(k, -1); }
    return n;
  }
  // Cronometer-style status for a nutrient: targets to reach vs limits to stay under.
  function nutrientStatus(key, v, goal) {
    if (!(goal > 0)) return { cls: "", text: "" };
    const r = v / goal;
    if (key === "pro" || key === "fib") {
      if (r >= 0.9) return { cls: "good", text: "Met" };
      if (r >= 0.5) return { cls: "", text: `${fmt(goal - v, key)} ${NBY[key].unit} to go` };
      return { cls: "low", text: "Low" };
    }
    if (r > 1) return { cls: "bad", text: "Over" };
    if (r > 0.85) return { cls: "warn", text: "Near limit" };
    return { cls: "good", text: "Under limit" };
  }

  function renderToday() {
    const entries = dayEntries();
    const totals = sum(entries.map((e) => e.n));
    const g = state.goals;

    $("#day-label").textContent = dayLabel(currentDay);
    $("#day-picker").value = currentDay;
    $("#day-today").hidden = currentDay === todayKey();
    const streak = streakDays();
    $("#streak").hidden = streak < 2;
    $("#streak").textContent = `${streak}-day streak`;

    // Calorie budget: goal - food + exercise = remaining (the MyFitnessPal equation)
    const ex = exerciseKcal();
    const budget = g.kcal + ex;
    const remaining = budget - totals.kcal;
    const over = remaining < 0;
    $("#cal-ring").innerHTML = ringSVG(totals.kcal, budget, {
      size: 148, stroke: 12, label: Math.abs(Math.round(remaining)).toLocaleString(), sub: over ? "kcal over" : "kcal left",
      aria: `${Math.round(totals.kcal)} of ${Math.round(budget)} calories eaten`,
    });
    const term = (v, l, cls = "") => `<div class="eq-term ${cls}"><b>${Math.round(v).toLocaleString()}</b><span>${l}</span></div>`;
    $("#budget-eq").innerHTML = `
      <div class="eyebrow">Calories</div>
      <div class="eq">${term(g.kcal, "Goal")}<i>−</i>${term(totals.kcal, "Food")}<i>+</i>${term(ex, "Exercise")}<i>=</i>${term(Math.abs(remaining), over ? "Over" : "Remaining", over ? "bad" : "ok")}</div>`;

    $("#macro-rings").innerHTML = ["pro", "carb", "fat"].map((k) => {
      const v = totals[k], goal = g[k] || 0;
      const left = goal - v;
      const name = k === "carb" ? "Carbs" : NBY[k].label;
      return `<div class="macro-ring">
        ${ringSVG(v, goal, { size: 76, stroke: 8, color: `var(--${k})`, label: fmt(v), aria: `${name} ${fmt(v)} of ${fmt(goal)} grams` })}
        <div><b>${name}</b><span class="num">${fmt(v)} / ${fmt(goal)} g</span><small class="${left < 0 ? "over" : ""}">${left >= 0 ? `${fmt(left)} g left` : `${fmt(-left)} g over`}</small></div>
      </div>`;
    }).join("");

    $("#nutrient-bars").innerHTML = ["fib", "sug", "sat", "chol", "na"].map((key) => {
      const n = NBY[key];
      const v = totals[key], goal = g[key] || 0;
      const p = goal > 0 ? Math.min((v / goal) * 100, 100) : 0;
      const st = nutrientStatus(key, v, goal);
      return `<div class="target ${st.cls}">
        <div class="bar-top"><b>${n.label}</b><span class="num">${fmt(v, key)} / ${fmt(goal, key)} ${n.unit}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div>
        <span class="pill">${st.text}</span>
      </div>`;
    }).join("");

    renderExercise();
    renderWeight();
    renderWater();

    $("#meals").innerHTML = MEALS.map((m) => {
      const list = entries.filter((e) => e.meal === m.id);
      const kcal = list.reduce((a, e) => a + e.n.kcal, 0);
      const items = list.length
        ? `<ul class="entry-list">${list.map((e) => `
            <li class="entry">
              <div class="entry-name" data-edit="${e.id}" tabindex="0" role="button" aria-label="Edit ${esc(e.name)}">
                <b>${esc(e.name)}</b>
                <small>${esc(e.amountText || "")}${e.n.pro || e.n.carb || e.n.fat ? ` · P ${fmt(e.n.pro)} · C ${fmt(e.n.carb)} · F ${fmt(e.n.fat)}` : ""}</small>
              </div>
              <span class="entry-kcal">${Math.round(e.n.kcal)} kcal</span>
              <button class="entry-del" data-del="${e.id}" aria-label="Remove ${esc(e.name)}">&times;</button>
            </li>`).join("")}</ul>`
        : `<div class="meal-empty">Nothing logged yet.</div>`;
      return `<div class="meal">
        <div class="meal-head"><h2>${m.label}</h2><span class="meal-kcal">${Math.round(kcal)} kcal</span></div>
        ${items}
        <div class="meal-foot"><button class="btn ghost small" data-addmeal="${m.id}">+ Add food</button>${!list.length && dayEntries(addDays(currentDay, -1)).some((e) => e.meal === m.id) ? `<button class="btn ghost small" data-copymeal="${m.id}">Copy yesterday's ${m.label.toLowerCase()}</button>` : ""}</div>
      </div>`;
    }).join("");
  }

  function renderWater() {
    const oz = waterOz(currentDay);
    const goalOz = Math.round((state.waterGoal || 8) * GLASS_OZ);
    const glasses = oz / GLASS_OZ;
    const count = Math.max(Math.ceil(goalOz / GLASS_OZ), Math.ceil(glasses) + 1);
    $("#glasses").innerHTML = Array.from({ length: count }, (_, i) => {
      const fill = Math.max(0, Math.min(1, glasses - i));
      return `<button type="button" class="glass${fill > 0 ? " on" : ""}" style="--fill:${fill}" data-glass="${i}"
        aria-label="${fill >= 1 ? `Remove ${GLASS_OZ} fl oz` : `Add ${GLASS_OZ} fl oz`}" title="${fill >= 1 ? "Tap to remove 8 oz" : "Tap to add 8 oz"}"></button>`;
    }).join("");
    $("#water-count").textContent = `${Math.round(oz)} of ${goalOz} fl oz · ${round(glasses, 1)} of ${round(goalOz / GLASS_OZ, 1)} glasses`;
    $("#water-undo").hidden = !(state.water[currentDay] || []).length;
  }
  // Take `oz` off the most recent amounts (a full glass tapped off).
  function removeWater(oz) {
    const list = state.water[currentDay] || [];
    let need = oz;
    while (need > 0 && list.length) {
      const last = list.pop();
      if (last > need) { list.push(Math.round((last - need) * 10) / 10); need = 0; } else need -= last;
    }
    if (!list.length) delete state.water[currentDay];
    save();
    renderWater();
  }
  $("#glasses").addEventListener("click", (e) => {
    const b = e.target.closest("[data-glass]");
    if (!b) return;
    const full = waterOz(currentDay) / GLASS_OZ - Number(b.dataset.glass) >= 1;
    if (full) removeWater(GLASS_OZ); else addWater(GLASS_OZ);
  });
  // ---------- Exercise ----------
  // MET values from the Compendium of Physical Activities; kcal = MET x kg x hours.
  const ACTIVITIES = [
    ["Walking, brisk", 4.3], ["Running, 6 mph", 9.8], ["Cycling, moderate", 7.5], ["Strength training", 5.0],
    ["Swimming laps", 6.0], ["Hiking", 6.0], ["HIIT / circuit", 8.0], ["Yoga", 2.5], ["Dancing", 5.0], ["Other", 0],
  ];
  const KG_PER_LB = 0.453592;
  function latestWeightKg(onOrBefore = currentDay) {
    const keys = Object.keys(state.weights).filter((k) => k <= onOrBefore).sort();
    return keys.length ? state.weights[keys[keys.length - 1]] : null;
  }
  function estimateExercise() {
    const met = Number($("#ex-type").value) || 0;
    const min = Number($("#ex-min").value) || 0;
    const kg = latestWeightKg() || 70;
    if (met > 0) $("#ex-kcal").value = Math.round(met * kg * (min / 60));
    $("#ex-name-l").hidden = met > 0;
    $("#ex-hint").textContent = met > 0
      ? `Estimated for ${state.units === "metric" ? `${round(kg, 1)} kg` : `${round(kg / KG_PER_LB, 1)} lb`}${latestWeightKg() ? "" : " (log a weigh-in for a closer estimate)"}. Edit the number if your watch says otherwise.`
      : "Enter the calories your watch or machine reports.";
  }
  $("#ex-type").innerHTML = ACTIVITIES.map(([n, met]) => `<option value="${met}">${n}</option>`).join("");
  $("#ex-type").addEventListener("change", estimateExercise);
  $("#ex-min").addEventListener("input", estimateExercise);
  $("#ex-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const sel = $("#ex-type");
    const met = Number(sel.value) || 0;
    const name = met > 0 ? sel.options[sel.selectedIndex].text : ($("#ex-name").value.trim() || "Exercise");
    const kcal = Math.max(0, Math.round(Number($("#ex-kcal").value) || 0));
    const min = Math.max(0, Math.round(Number($("#ex-min").value) || 0));
    if (!kcal) { $("#ex-kcal").focus(); return; }
    (state.exercise[currentDay] || (state.exercise[currentDay] = [])).push({ id: uid(), name, min, kcal });
    save();
    renderToday();
    toast(`Added ${name}: ${kcal} kcal`);
  });
  $("#ex-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-exdel]");
    if (!b) return;
    const list = state.exercise[currentDay] || [];
    const i = list.findIndex((x) => x.id === b.dataset.exdel);
    if (i < 0) return;
    list.splice(i, 1);
    if (!list.length) delete state.exercise[currentDay];
    save();
    renderToday();
  });
  function renderExercise() {
    const list = state.exercise[currentDay] || [];
    $("#ex-total").textContent = `${Math.round(exerciseKcal()).toLocaleString()} kcal`;
    $("#ex-list").innerHTML = list.length
      ? list.map((x) => `<li class="entry"><div class="entry-name"><b>${esc(x.name)}</b><small>${x.min ? `${x.min} min` : ""}</small></div>
          <span class="entry-kcal">${Math.round(x.kcal)} kcal</span>
          <button class="entry-del" data-exdel="${x.id}" aria-label="Remove ${esc(x.name)}">&times;</button></li>`).join("")
      : `<li class="meal-empty">No exercise logged. Calories you burn are added to today's budget.</li>`;
    estimateExercise();
  }

  // ---------- Weight ----------
  const toDisplay = (kg) => (state.units === "metric" ? kg : kg / KG_PER_LB);
  const unitLabel = () => (state.units === "metric" ? "kg" : "lb");
  // Exponentially smoothed trend (alpha 0.1), the approach MacroFactor and Libra use to filter daily water swings.
  function weightTrend() {
    const keys = Object.keys(state.weights).sort();
    let t = null;
    return keys.map((k) => {
      const w = state.weights[k];
      t = t == null ? w : t + 0.1 * (w - t);
      return { k, w, t };
    });
  }
  function renderWeight() {
    $("#weigh-label").textContent = `Weight (${unitLabel()})`;
    const w = state.weights[currentDay];
    const input = $("#weigh-input");
    if (document.activeElement !== input) input.value = w ? round(toDisplay(w), 1) : "";
    $("#weigh-save").textContent = w ? "Update" : "Save";
    $("#weigh-del").hidden = !w;
    const tr = weightTrend().filter((x) => x.k <= currentDay);
    if (!tr.length) { $("#weight-summary").textContent = "No weigh-ins yet"; return; }
    const last = tr[tr.length - 1];
    const ref = tr.filter((x) => x.k <= addDays(last.k, -7)).pop() || tr[0];
    const delta = toDisplay(last.t) - toDisplay(ref.t);
    const days = Math.round((parseKey(last.k) - parseKey(ref.k)) / 864e5);
    $("#weight-summary").textContent = `Trend ${round(toDisplay(last.t), 1)} ${unitLabel()}` +
      (days > 0 ? ` · ${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(round(delta, 1))} in ${days} days` : "");
  }
  $("#weigh-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number($("#weigh-input").value);
    if (!(v > 0)) { $("#weigh-input").focus(); return; }
    state.weights[currentDay] = round(state.units === "metric" ? v : v * KG_PER_LB, 3);
    save();
    $("#weigh-input").blur();
    renderToday();
    toast("Weigh-in saved");
  });
  $("#weigh-del").addEventListener("click", () => {
    delete state.weights[currentDay];
    save();
    renderToday();
  });

  function addWater(oz) {
    if (!(oz > 0)) return;
    (state.water[currentDay] || (state.water[currentDay] = [])).push(Math.round(oz * 10) / 10);
    save();
    renderWater();
    toast(`Added ${oz} fl oz of water`);
  }
  $("#water-quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-oz]");
    if (b) addWater(Number(b.dataset.oz));
  });
  $("#water-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number($("#water-input").value);
    if (!(v > 0)) { $("#water-input").focus(); return; }
    addWater(v);
    $("#water-input").value = "";
  });
  $("#water-undo").addEventListener("click", () => {
    const list = state.water[currentDay] || [];
    const last = list.pop();
    if (!list.length) delete state.water[currentDay];
    save();
    renderWater();
    if (last) toast(`Removed ${last} fl oz`);
  });

  $("#meals").addEventListener("click", (e) => {
    const add = e.target.closest("[data-addmeal]");
    if (add) return openPicker({ mode: "log", meal: add.dataset.addmeal });
    const copy = e.target.closest("[data-copymeal]");
    if (copy) {
      const meal = copy.dataset.copymeal;
      const src = dayEntries(addDays(currentDay, -1)).filter((x) => x.meal === meal);
      const list = state.log[currentDay] || (state.log[currentDay] = []);
      for (const x of src) list.push({ ...JSON.parse(JSON.stringify(x)), id: uid() });
      save();
      renderToday();
      toast(`Copied ${src.length} item${src.length === 1 ? "" : "s"} from yesterday`);
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const list = dayEntries();
      const idx = list.findIndex((x) => x.id === del.dataset.del);
      if (idx >= 0) {
        const [removed] = list.splice(idx, 1);
        if (!list.length) delete state.log[currentDay];
        save();
        renderToday();
        toast(`Removed ${removed.name}`);
      }
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) editEntry(ed.dataset.edit);
  });
  $("#meals").addEventListener("keydown", (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); editEntry(ed.dataset.edit); }
  });

  function editEntry(id) {
    const entry = dayEntries().find((x) => x.id === id);
    if (!entry) return;
    if (!entry.food) return toast("Quick-add entries can be removed and re-added");
    openPicker({ mode: "log", meal: entry.meal, editId: id, food: entry.food, amount: entry.amount, unit: entry.unit });
  }

  $("#day-prev").addEventListener("click", () => { currentDay = addDays(currentDay, -1); renderToday(); });
  $("#day-next").addEventListener("click", () => { currentDay = addDays(currentDay, 1); renderToday(); });
  $("#day-today").addEventListener("click", () => { currentDay = todayKey(); renderToday(); });
  $("#day-picker").addEventListener("change", (e) => { if (e.target.value) { currentDay = e.target.value; renderToday(); } });

  function logFood(food, amount, unit, meal, day = currentDay, editId = null) {
    const grams = toGrams(food, amount, unit);
    const entry = {
      id: editId || uid(),
      meal,
      name: food.name + (food.brand ? ` (${food.brand})` : ""),
      food: snapshot(food),
      amount: Number(amount),
      unit,
      grams,
      amountText: unit === "g" ? unitText(food, amount, unit) : unitText(food, amount, unit).replace(/\s*\([^)]*\d\s*g\)/g, "") + ` (${Math.round(grams)} g)`,
      n: scale(food.per100, grams),
    };
    const list = state.log[day] || (state.log[day] = []);
    const idx = editId ? list.findIndex((x) => x.id === editId) : -1;
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    if (food.source === "off") onlineCache.set(food.id, food);
    else if (food.source !== "recipe-log" && food.source !== "photo") pushRecent(food);
    save();
    return entry;
  }

  // ---------- Picker ----------
  let picker = null; // { mode: 'log'|'calc'|'lookup', meal, editId, onPick, food }
  let pickerCat = "";
  const CATS = ["", "Mine", ...Array.from(new Set(BUILTIN_FOODS.map((f) => f.cat)))];

  function mealOptions(sel) {
    return MEALS.map((m) => `<option value="${m.id}"${m.id === sel ? " selected" : ""}>${m.label}</option>`).join("");
  }
  function defaultMeal() {
    const h = new Date().getHours();
    return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snacks";
  }

  function openPicker(opts) {
    picker = opts;
    const m = $("#picker");
    m.hidden = false;
    document.body.style.overflow = "hidden";
    $("#picker-title").textContent = opts.mode === "calc" ? "Add ingredient" : opts.mode === "lookup" ? "Look up a food" : opts.editId ? "Edit entry" : `Add to ${MEALS.find((x) => x.id === opts.meal).label}`;
    $("#picker-quick").hidden = opts.mode !== "log";
    $("#picker-online-msg").textContent = "";
    if (opts.food) {
      showDetail(opts.food, opts.amount, opts.unit);
    } else {
      showSearch();
      $("#picker-q").value = "";
      renderResults();
      setTimeout(() => $("#picker-q").focus(), 30);
    }
  }
  function closePicker() {
    $("#picker").hidden = true;
    document.body.style.overflow = "";
    picker = null;
  }
  function showSearch() {
    $("#picker-search").hidden = false;
    $("#picker-detail").hidden = true;
    $("#picker-quickform").hidden = true;
  }
  $$("#picker [data-close]").forEach((b) => b.addEventListener("click", closePicker));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#picker").hidden) closePicker(); });

  $("#picker-cats").innerHTML = CATS.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === "" ? "true" : "false"}">${c === "" ? "All" : c === "Mine" ? "My foods" : esc(c)}</button>`).join("");
  $("#picker-cats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    pickerCat = b.dataset.cat;
    $$("#picker-cats .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    renderResults();
  });
  $("#picker-q").addEventListener("input", renderResults);
  $("#picker-q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = $("#picker-results [data-food]");
      if (first) first.click();
    }
  });

  let resultFoods = new Map();
  function resultRow(f) {
    resultFoods.set(f.id, f);
    const s = f.serving;
    const kcal = s ? `${Math.round((f.per100.kcal * s.g) / 100)} kcal / ${esc(s.label)}` : `${Math.round(f.per100.kcal)} kcal / 100 g`;
    const sub = f.source === "custom" ? `<span class="tag">Mine</span>` : f.source === "off" ? esc(f.brand || "Packaged food") : esc(f.cat);
    return `<li><button data-food="${esc(f.id)}"><span class="r-name">${esc(f.name)}${f.source === "custom" ? sub : ""}<small>${f.source === "custom" ? esc(s ? s.label + " · " + Math.round(s.g) + " g" : "") : sub}</small></span><span class="r-kcal">${kcal}</span></button></li>`;
  }
  function renderResults() {
    const q = $("#picker-q").value.trim();
    resultFoods = new Map();
    let html = "";
    if (!q && !pickerCat) {
      const recent = state.recent.map((id) => findFood(id) || onlineCache.get(id)).filter(Boolean);
      if (recent.length) html += `<li class="r-head">Recent</li>` + recent.map(resultRow).join("");
      html += `<li class="r-head">All foods</li>`;
    }
    const res = searchFoods(q, pickerCat);
    html += res.length ? res.slice(0, 80).map(resultRow).join("") : `<li class="r-none">No match in the database. Try “Search packaged foods online”, or add it under My foods.</li>`;
    $("#picker-results").innerHTML = html;
  }
  $("#picker-results").addEventListener("click", (e) => {
    const b = e.target.closest("[data-food]");
    if (!b) return;
    const f = resultFoods.get(b.dataset.food);
    if (f) showDetail(f);
  });

  // Online search: Open Food Facts (free, no key). Falls back gracefully when the network is blocked.
  $("#picker-online").addEventListener("click", async () => {
    const q = $("#picker-q").value.trim();
    const msg = $("#picker-online-msg");
    if (!q) { msg.textContent = "Type a product name first, e.g. “Clif bar” or “Chobani”."; $("#picker-q").focus(); return; }
    msg.textContent = "Searching Open Food Facts…";
    try {
      const url = "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=24&search_terms=" +
        encodeURIComponent(q) + "&fields=code,product_name,brands,nutriments,serving_size,serving_quantity";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const foods = (data.products || []).map(fromOFF).filter(Boolean);
      if (!foods.length) { msg.textContent = `No packaged foods found for “${q}”.`; return; }
      resultFoods = new Map();
      $("#picker-results").innerHTML = `<li class="r-head">Open Food Facts</li>` + foods.map(resultRow).join("");
      msg.textContent = `${foods.length} products found. Values come from the product label as entered by contributors.`;
    } catch (err) {
      msg.textContent = "Online search is unavailable right now. Check your connection, or add the food yourself under My foods.";
    }
  });
  function fromOFF(p) {
    const n = p.nutriments || {};
    let kcal = n["energy-kcal_100g"];
    if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
    if (kcal == null || !p.product_name) return null;
    const num = (v, mult = 1) => (v == null || isNaN(v) ? 0 : Number(v) * mult);
    const sg = Number(p.serving_quantity);
    return {
      id: "off:" + (p.code || uid()),
      name: p.product_name.trim(),
      brand: (p.brands || "").split(",")[0].trim(),
      cat: "Packaged",
      source: "off",
      per100: {
        kcal: num(kcal), pro: num(n.proteins_100g), carb: num(n.carbohydrates_100g), fat: num(n.fat_100g),
        fib: num(n.fiber_100g), sug: num(n.sugars_100g), sat: num(n["saturated-fat_100g"]),
        chol: num(n.cholesterol_100g, 1000), na: num(n.sodium_100g, 1000),
      },
      serving: sg > 0 ? { label: p.serving_size || `${sg} g`, g: sg } : null,
    };
  }

  // Quick add (calories only, for restaurant meals etc.)
  $("#picker-quick").addEventListener("click", () => {
    $("#picker-search").hidden = true;
    $("#picker-quickform").hidden = false;
    $("#q-meal").innerHTML = mealOptions(picker.meal);
    $("#q-name").value = $("#picker-q").value.trim();
    $("#q-kcal").value = "";
    ["pro", "carb", "fat"].forEach((k) => ($("#q-" + k).value = ""));
    $("#q-name").focus();
  });
  $("#quick-back").addEventListener("click", showSearch);
  $("#picker-quickform").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = zero();
    n.kcal = Number($("#q-kcal").value) || 0;
    ["pro", "carb", "fat"].forEach((k) => (n[k] = Number($("#q-" + k).value) || 0));
    const meal = $("#q-meal").value;
    const list = state.log[currentDay] || (state.log[currentDay] = []);
    list.push({ id: uid(), meal, name: $("#q-name").value.trim() || "Quick add", food: null, amountText: "Quick add", n });
    save();
    closePicker();
    renderToday();
    toast("Added to " + MEALS.find((m) => m.id === meal).label);
  });

  // Detail pane
  let detailFood = null;
  function showDetail(food, amount, unit) {
    detailFood = food;
    $("#picker-search").hidden = true;
    $("#picker-quickform").hidden = true;
    $("#picker-detail").hidden = false;
    $("#picker-back").hidden = !!(picker && picker.editId) || !!(picker && picker.food && picker.mode !== "lookup");
    $("#pd-name").textContent = food.name;
    const meta = [food.brand, food.serving ? `1 serving = ${food.serving.label} (${round(food.serving.g, 1)} g)` : null, `${Math.round(food.per100.kcal)} kcal per 100 g`].filter(Boolean);
    $("#pd-meta").textContent = meta.join(" · ");
    const units = [];
    if (food.serving) units.push(["serving", `serving (${food.serving.label}, ${round(food.serving.g, 1)} g)`]);
    units.push(["g", "grams"], ["oz", "ounces"]);
    const u = unit || (food.serving ? "serving" : "g");
    $("#pd-unit").innerHTML = units.map(([v, l]) => `<option value="${v}"${v === u ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("#pd-unit").dataset.prev = u;
    $("#pd-amount").value = amount != null ? amount : (u === "g" ? 100 : 1);
    const isLog = picker.mode === "log";
    $("#pd-meal-l").hidden = !isLog;
    if (isLog) $("#pd-meal").innerHTML = mealOptions(picker.meal);
    $("#pd-add").textContent = picker.mode === "calc" ? "Add to recipe" : picker.mode === "lookup" ? "Show nutrition label" : picker.editId ? "Save changes" : "Add to log";
    updatePreview();
    setTimeout(() => $("#pd-amount").select(), 30);
  }
  function updatePreview() {
    if (!detailFood) return;
    const g = toGrams(detailFood, $("#pd-amount").value, $("#pd-unit").value);
    const n = scale(detailFood.per100, g);
    $("#pd-preview").innerHTML =
      `<div><b>${Math.round(n.kcal)}</b><span>kcal · ${Math.round(g)} g</span></div>` +
      ["pro", "carb", "fat"].map((k) => `<div class="k-${k}"><b>${fmt(n[k])} g</b><span>${k === "carb" ? "Carbs" : NBY[k].label}</span></div>`).join("");
  }
  $("#pd-amount").addEventListener("input", updatePreview);
  $("#pd-unit").addEventListener("change", (e) => {
    // Keep the same weight when switching units
    const prevG = toGrams(detailFood, $("#pd-amount").value, e.target.dataset.prev || e.target.value);
    const u = e.target.value;
    const per = u === "g" ? 1 : u === "oz" ? OZ : detailFood.serving.g;
    if (prevG > 0) $("#pd-amount").value = round(prevG / per, u === "g" ? 0 : 2);
    e.target.dataset.prev = u;
    updatePreview();
  });
  $("#pd-unit").addEventListener("focus", (e) => (e.target.dataset.prev = e.target.value));
  $("#pd-amount").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#pd-add").click(); } });
  $("#picker-back").addEventListener("click", () => { showSearch(); renderResults(); });

  $("#pd-add").addEventListener("click", () => {
    const amount = Number($("#pd-amount").value);
    const unit = $("#pd-unit").value;
    if (!(amount > 0)) { $("#pd-amount").focus(); return; }
    const food = detailFood;
    const mode = picker.mode;
    if (mode === "log") {
      const meal = $("#pd-meal").value;
      const editId = picker.editId;
      logFood(food, amount, unit, meal, currentDay, editId);
      closePicker();
      renderToday();
      toast(editId ? "Entry updated" : `Added ${food.name}`);
    } else if (mode === "calc") {
      state.draft.items.push({ id: uid(), food: snapshot(food), amount, unit });
      if (food.source !== "off") pushRecent(food); else onlineCache.set(food.id, food);
      save();
      closePicker();
      renderCalc();
    } else if (mode === "lookup") {
      const g = toGrams(food, amount, unit);
      $("#lookup-label").innerHTML = labelHTML(scale(food.per100, g), { title: food.name, sizeText: `${unitText(food, amount, unit)} (${Math.round(g)}g)`, servings: null });
      closePicker();
    }
  });

  // ---------- Nutrition Facts label ----------
  function dv(key, v) { const d = NBY[key].dv; return d ? Math.round((v / d) * 100) + "%" : ""; }
  function labelHTML(n, { title, sizeText, servings }) {
    const row = (label, key, cls = "", bold = true) =>
      `<div class="row ${cls}"><span>${bold ? `<b>${label}</b>` : label} ${fmt(n[key], key)}${NBY[key].unit}</span><b>${dv(key, n[key])}</b></div>`;
    return `<div class="nf" aria-label="Nutrition facts">
      <h4>Nutrition Facts</h4>
      ${title ? `<div class="servings">${esc(title)}</div>` : ""}
      ${servings ? `<div class="servings">${servings} serving${servings === 1 ? "" : "s"} per recipe</div>` : ""}
      <div class="rule-thin"></div>
      <div class="size"><span>Serving size</span><span>${esc(sizeText)}</span></div>
      <div class="rule-thick"></div>
      <div class="amount">Amount per serving</div>
      <div class="cal"><span>Calories</span><span>${Math.round(n.kcal)}</span></div>
      <div class="rule-med"></div>
      <div class="dvh">% Daily Value*</div>
      <div class="rule-thin"></div>
      ${row("Total Fat", "fat")}
      ${row("Saturated Fat", "sat", "indent", false)}
      ${row("Cholesterol", "chol")}
      ${row("Sodium", "na")}
      ${row("Total Carbohydrate", "carb")}
      ${row("Dietary Fiber", "fib", "indent", false)}
      <div class="row indent"><span>Total Sugars ${fmt(n.sug, "sug")}g</span><span></span></div>
      <div class="row"><span><b>Protein</b> ${fmt(n.pro, "pro")}g</span><b>${dv("pro", n.pro)}</b></div>
      <div class="rule-thick"></div>
      <div class="nf-foot">* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div>
    </div>`;
  }

  // ---------- CALCULATOR ----------
  function calcTotals() {
    const items = state.draft.items;
    let grams = 0;
    const parts = items.map((it) => {
      const g = toGrams(it.food, it.amount, it.unit);
      grams += g;
      return scale(it.food.per100, g);
    });
    return { total: sum(parts), grams };
  }
  function renderCalc() {
    const d = state.draft;
    $("#calc-name").value = d.name;
    $("#calc-servings").value = d.servings;
    $("#calc-meal").innerHTML = mealOptions(defaultMeal());
    const box = $("#calc-items");
    if (!d.items.length) {
      box.innerHTML = `<div class="ing-empty">No ingredients yet. Add the first one to see its nutrition label.</div>`;
    } else {
      box.innerHTML = d.items.map((it) => {
        const g = toGrams(it.food, it.amount, it.unit);
        const kcal = (it.food.per100.kcal * g) / 100;
        const units = (it.food.serving ? [["serving", it.food.serving.label]] : []).concat([["g", "g"], ["oz", "oz"]]);
        return `<div class="ing" data-id="${it.id}">
          <div class="ing-name"><b>${esc(it.food.name)}</b><small>${Math.round(g)} g · ${Math.round(kcal)} kcal</small></div>
          <input type="number" min="0" step="any" value="${it.amount}" data-amt="${it.id}" aria-label="Amount of ${esc(it.food.name)}">
          <select data-unit="${it.id}" aria-label="Unit for ${esc(it.food.name)}">${units.map(([v, l]) => `<option value="${v}"${v === it.unit ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
          <button class="entry-del" data-rm="${it.id}" aria-label="Remove ${esc(it.food.name)}" title="Remove">&times;</button>
        </div>`;
      }).join("");
    }
    renderCalcLabel();
  }
  function renderCalcLabel() {
    const { total, grams } = calcTotals();
    const s = Math.max(1, Number(state.draft.servings) || 1);
    const per = {};
    for (const k of NK) per[k] = total[k] / s;
    $("#calc-label").innerHTML = labelHTML(per, {
      title: state.draft.name || null,
      sizeText: grams ? `1 serving (${Math.round(grams / s)}g)` : "—",
      servings: s,
    });
    $("#calc-weight").textContent = `${Math.round(grams)} g`;
    // refresh per-row meta without re-rendering inputs (keeps focus)
    for (const it of state.draft.items) {
      const row = $(`.ing[data-id="${it.id}"] small`);
      if (row) {
        const g = toGrams(it.food, it.amount, it.unit);
        row.textContent = `${Math.round(g)} g · ${Math.round((it.food.per100.kcal * g) / 100)} kcal`;
      }
    }
  }
  $("#calc-items").addEventListener("input", (e) => {
    const id = e.target.dataset.amt;
    if (!id) return;
    const it = state.draft.items.find((x) => x.id === id);
    if (it) { it.amount = Number(e.target.value) || 0; save(); renderCalcLabel(); }
  });
  $("#calc-items").addEventListener("change", (e) => {
    const id = e.target.dataset.unit;
    if (!id) return;
    const it = state.draft.items.find((x) => x.id === id);
    if (!it) return;
    const g = toGrams(it.food, it.amount, it.unit);
    it.unit = e.target.value;
    const per = it.unit === "g" ? 1 : it.unit === "oz" ? OZ : it.food.serving.g;
    it.amount = round(g / per, it.unit === "g" ? 0 : 2);
    save();
    renderCalc();
  });
  $("#calc-items").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (!b) return;
    state.draft.items = state.draft.items.filter((x) => x.id !== b.dataset.rm);
    save();
    renderCalc();
  });
  $("#calc-name").addEventListener("input", (e) => { state.draft.name = e.target.value; save(); renderCalcLabel(); });
  $("#calc-servings").addEventListener("input", (e) => { state.draft.servings = Math.max(1, Number(e.target.value) || 1); save(); renderCalcLabel(); });
  $("#calc-add").addEventListener("click", () => openPicker({ mode: "calc" }));
  $("#calc-clear").addEventListener("click", () => {
    state.draft = { name: "", servings: 1, items: [] };
    save();
    renderCalc();
    calcMsg("");
  });
  function calcMsg(t) { $("#calc-msg").textContent = t; }
  function draftAsFood() {
    const { total, grams } = calcTotals();
    if (!state.draft.items.length || grams <= 0) return null;
    const s = Math.max(1, Number(state.draft.servings) || 1);
    const per100 = {};
    for (const k of NK) per100[k] = (total[k] / grams) * 100;
    return {
      id: "c:" + uid(),
      name: state.draft.name.trim() || "My recipe",
      cat: "Mine",
      source: "custom",
      recipe: true,
      per100,
      serving: { label: "1 serving", g: grams / s },
    };
  }
  $("#calc-save").addEventListener("click", () => {
    const f = draftAsFood();
    if (!f) return calcMsg("Add at least one ingredient first.");
    state.custom.unshift(f);
    pushRecent(f);
    save();
    calcMsg(`Saved “${f.name}” to My foods. You can now log it from any meal.`);
    toast("Recipe saved");
  });
  $("#calc-log").addEventListener("click", () => {
    const f = draftAsFood();
    if (!f) return calcMsg("Add at least one ingredient first.");
    f.source = "recipe-log";
    const meal = $("#calc-meal").value;
    logFood(f, 1, "serving", meal, todayKey());
    calcMsg(`Logged 1 serving of “${f.name}” to today's ${MEALS.find((m) => m.id === meal).label.toLowerCase()}.`);
    toast("Logged to today");
    if (currentDay === todayKey()) renderToday();
  });

  // ---------- MY FOODS ----------
  $("#cf-nutrients").innerHTML = NUTRIENTS.map((n) =>
    `<label class="field"><span>${n.label} (${n.unit})</span><input type="text" inputmode="decimal" id="cf-${n.key}"></label>`).join("");

  function resetCustomForm() {
    $("#custom-form").reset();
    formError(null);
    $("#cf-id").value = "";
    $("#cf-serving").value = "1 serving";
    $("#cf-grams").value = 100;
    $("#custom-form-title").textContent = "Add a custom food";
    $("#cf-submit").textContent = "Save food";
    $("#cf-cancel").hidden = true;
  }
  $("#cf-cancel").addEventListener("click", resetCustomForm);
  // Accepts "0,5", " 12 ", "1,200" style input that iPhone keyboards produce in some regions.
  function parseAmount(str) {
    let t = String(str ?? "").trim().replace(/\s+/g, "");
    if (!t) return null;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ""); // 1,200 -> 1200
    else t = t.replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }
  function formError(input, text) {
    const err = $("#cf-error");
    $$("#custom-form .invalid").forEach((el) => el.classList.remove("invalid"));
    if (!input) { err.hidden = true; err.textContent = ""; return; }
    input.classList.add("invalid");
    err.textContent = text;
    err.hidden = false;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => input.focus({ preventScroll: true }), 300);
  }
  $("#custom-form").addEventListener("input", (e) => { if (e.target.classList.contains("invalid")) formError(null); });
  function cfStatus(text) {
    const el = $("#cf-status");
    el.textContent = text || "";
    el.hidden = !text;
  }
  $("#cf-submit").addEventListener("click", () => {
    try { saveCustomFood(); } catch (err) {
      formError($("#cf-name"), `Something went wrong while saving (${err && err.message ? err.message : err}). Send this message to Claude in chat.`);
    }
  });
  $("#custom-form").addEventListener("submit", (e) => { e.preventDefault(); $("#cf-submit").click(); });
  $("#custom-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input[type=text]")) { e.preventDefault(); $("#cf-submit").click(); }
  });
  document.addEventListener("nutrilog:save-error", (e) => {
    if (!$("#cf-status").hidden) { cfStatus(""); formError($("#cf-submit"), `Your food is on this screen but didn't reach your saved data (${e.detail}). Check your connection and press Save food again.`); }
  });
  function saveCustomFood() {
    cfStatus("");
    const name = $("#cf-name").value.trim();
    if (!name) return formError($("#cf-name"), "Enter a name for this food, then press Save food.");
    const g = parseAmount($("#cf-grams").value);
    if (!(g > 0)) return formError($("#cf-grams"), "Enter the serving weight in grams (for example 30). It's on the label next to the serving size.");
    const vals = {};
    for (const k of NK) {
      const v = parseAmount($("#cf-" + k).value);
      if (Number.isNaN(v)) return formError($("#cf-" + k), `${NBY[k].label} needs to be a number, like 12 or 0.5.`);
      vals[k] = v || 0;
    }
    if (parseAmount($("#cf-kcal").value) == null) return formError($("#cf-kcal"), "Enter the calories per serving.");
    formError(null);
    const per100 = {};
    for (const k of NK) per100[k] = (vals[k] / g) * 100;
    const id = $("#cf-id").value;
    const existing = id && state.custom.find((f) => f.id === id);
    const food = {
      id: id || "c:" + uid(),
      name,
      cat: "Mine",
      source: "custom",
      recipe: existing ? existing.recipe : false,
      per100,
      serving: { label: $("#cf-serving").value.trim() || "1 serving", g },
    };
    if (existing) state.custom[state.custom.indexOf(existing)] = food; else state.custom.unshift(food);
    save();
    resetCustomForm();
    renderCustomList();
    toast(existing ? "Food updated" : "Food saved");
    cfStatus(`Saved “${food.name}”. It's in your list below and shows up when you search to log a meal.`);
  }

  function renderCustomList() {
    const box = $("#custom-list");
    if (!state.custom.length) {
      box.innerHTML = `<p class="hint">No saved foods yet. Add one with the form, or save a recipe from the Calculator.</p>`;
      return;
    }
    box.innerHTML = state.custom.map((f) => {
      const s = f.serving;
      const n = scale(f.per100, s.g);
      return `<div class="custom-item">
        <div><b>${esc(f.name)}</b>${f.recipe ? `<span class="tag">Recipe</span>` : ""}
          <small class="num">${esc(s.label)} (${Math.round(s.g)} g) · ${Math.round(n.kcal)} kcal · P ${fmt(n.pro)} · C ${fmt(n.carb)} · F ${fmt(n.fat)}</small></div>
        <div class="row gap">
          <button class="btn small" data-cedit="${f.id}">Edit</button>
          <button class="btn small danger" data-cdel="${f.id}" aria-label="Delete ${esc(f.name)}">Delete</button>
        </div>
      </div>`;
    }).join("");
  }
  $("#custom-list").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-cedit]");
    const del = e.target.closest("[data-cdel]");
    if (ed) {
      const f = state.custom.find((x) => x.id === ed.dataset.cedit);
      if (!f) return;
      $("#cf-id").value = f.id;
      $("#cf-name").value = f.name;
      $("#cf-serving").value = f.serving.label;
      $("#cf-grams").value = round(f.serving.g, 1);
      const n = scale(f.per100, f.serving.g);
      for (const k of NK) $("#cf-" + k).value = round(n[k], k === "kcal" || k === "na" || k === "chol" ? 0 : 1);
      $("#custom-form-title").textContent = "Edit food";
      $("#cf-submit").textContent = "Save changes";
      $("#cf-cancel").hidden = false;
      $("#cf-name").focus();
    } else if (del) {
      if (del.dataset.armed !== "1") {
        del.dataset.armed = "1";
        del.textContent = "Confirm";
        setTimeout(() => { if (del.isConnected) { del.dataset.armed = ""; del.textContent = "Delete"; } }, 3000);
        return;
      }
      state.custom = state.custom.filter((x) => x.id !== del.dataset.cdel);
      state.recent = state.recent.filter((id) => id !== del.dataset.cdel);
      save();
      renderCustomList();
      toast("Food deleted. Past log entries keep their values.");
    }
  });
  $("#lookup-btn").addEventListener("click", () => openPicker({ mode: "lookup" }));

  // ---------- HISTORY ----------
  let range = 7;
  $$(".seg-btn").forEach((b) => b.addEventListener("click", () => {
    range = Number(b.dataset.range);
    $$(".seg-btn").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderHistory();
  }));

  function niceMax(v) {
    if (v <= 0) return 500;
    const step = v > 3000 ? 1000 : 500;
    return Math.ceil(v / step) * step;
  }
  function renderHistory() {
    const end = todayKey();
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const k = addDays(end, -i);
      const e = state.log[k] || [];
      days.push({ k, n: sum(e.map((x) => x.n)), count: e.length });
    }
    const goal = state.goals.kcal;
    const W = Math.max(300, Math.round($("#chart").clientWidth || 640)), H = W < 500 ? 200 : 240, L = 44, R = 8, T = 10, B = 26;
    const max = niceMax(Math.max(goal * 1.1, ...days.map((d) => d.n.kcal)));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const bw = (W - L - R) / days.length;
    const barW = Math.max(4, Math.min(36, bw - 6));
    const step = max > 3000 ? 1000 : 500;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day for the last ${range} days">`;
    for (let v = 0; v <= max; v += step) {
      svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-t" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v.toLocaleString()}</text>`;
    }
    const labelEvery = Math.max(1, Math.ceil(range / Math.floor((W - L - R) / 44)));
    days.forEach((d, i) => {
      const cx = L + bw * i + bw / 2;
      const v = d.n.kcal;
      const top = y(v);
      const h = Math.max(0, y(0) - top);
      const cls = d.count === 0 ? "bar dim" : v > goal ? "bar over" : "bar";
      const hh = d.count === 0 ? 3 : h;
      const r = Math.min(4, barW / 2, hh);
      const x0 = cx - barW / 2, y0 = y(0) - hh;
      svg += `<rect class="hit" x="${L + bw * i}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}"/>`;
      svg += `<path class="${cls}" data-bar="${i}" d="M${x0},${y(0)} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${y(0)} Z"/>`;
      if ((range - 1 - i) % labelEvery === 0) {
        const dt = parseKey(d.k);
        const lab = range <= 7 && bw > 40 ? dt.toLocaleDateString(undefined, { weekday: "short" }) : `${dt.getMonth() + 1}/${dt.getDate()}`;
        svg += `<text class="axis-t" x="${cx}" y="${H - 8}" text-anchor="middle">${lab}</text>`;
      }
    });
    svg += `<line class="goal" x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}"/>`;
    svg += `</svg><div class="tip" id="chart-tip" hidden></div>`;
    const chart = $("#chart");
    chart.innerHTML = svg;
    const tip = $("#chart-tip");
    chart.onmousemove = (e) => {
      const hit = e.target.closest(".hit");
      $$(".bar.hover", chart).forEach((b) => b.classList.remove("hover"));
      if (!hit) { tip.hidden = true; return; }
      const i = Number(hit.dataset.i);
      const d = days[i];
      $(`[data-bar="${i}"]`, chart).classList.add("hover");
      const rect = chart.getBoundingClientRect();
      tip.innerHTML = `<b>${parseKey(d.k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</b> · ${d.count ? `${Math.round(d.n.kcal).toLocaleString()} kcal · P ${fmt(d.n.pro)} C ${fmt(d.n.carb)} F ${fmt(d.n.fat)}` : "nothing logged"}`;
      tip.hidden = false;
      const x = Math.min(Math.max(e.clientX - rect.left, 90), rect.width - 90);
      tip.style.left = x + "px";
      tip.style.top = (e.clientY - rect.top) + "px";
    };
    chart.onmouseleave = () => { tip.hidden = true; $$(".bar.hover", chart).forEach((b) => b.classList.remove("hover")); };

    renderWeightChart(days.map((d) => d.k));

    const logged = days.filter((d) => d.count > 0);
    const avg = logged.length ? sum(logged.map((d) => d.n)) : zero();
    if (logged.length) for (const k of NK) avg[k] /= logged.length;
    const onTarget = logged.filter((d) => Math.abs(d.n.kcal - goal) <= goal * 0.1).length;
    $("#history-stats").innerHTML = [
      ["Days logged", `${logged.length}<small> / ${range}</small>`],
      ["Avg calories", `${Math.round(avg.kcal).toLocaleString()}<small> kcal</small>`],
      ["Avg protein", `${fmt(avg.pro)}<small> g</small>`],
      ["Within 10% of goal", `${onTarget}<small> days</small>`],
    ].map(([l, v]) => `<div class="stat"><div class="eyebrow">${l}</div><div class="v">${v}</div></div>`).join("");

    const cols = ["kcal", "pro", "carb", "fat", "fib", "sug", "na"];
    const head = `<tr><th>Date</th>${cols.map((k) => `<th>${k === "carb" ? "Carbs" : NBY[k].label} (${NBY[k].unit})</th>`).join("")}</tr>`;
    const rows = days.slice().reverse().map((d) => d.count
      ? `<tr><td>${parseKey(d.k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</td>${cols.map((k) => `<td>${fmt(d.n[k], k)}</td>`).join("")}</tr>`
      : `<tr class="empty"><td>${parseKey(d.k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</td>${cols.map(() => "<td>–</td>").join("")}</tr>`).join("");
    $("#history-table").innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
  }

  function renderWeightChart(dayKeys) {
    const box = $("#weight-chart");
    const all = weightTrend();
    const pts = all.filter((x) => x.k >= dayKeys[0] && x.k <= dayKeys[dayKeys.length - 1]);
    const u = unitLabel();
    if (!pts.length) {
      $("#weight-legend").textContent = "";
      box.innerHTML = `<p class="hint chart-empty">No weigh-ins in this range. Log your weight on the Today page to see your trend here.</p>`;
      return;
    }
    $("#weight-legend").innerHTML = `<span class="lg-dot"></span>scale <span class="lg-line"></span>trend`;
    const W = Math.max(300, Math.round(box.clientWidth || 640)), H = W < 500 ? 180 : 210, L = 44, R = 12, T = 12, B = 26;
    const vals = pts.flatMap((x) => [toDisplay(x.w), toDisplay(x.t)]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = Math.max(hi - lo, u === "kg" ? 1 : 2);
    const step = [0.5, 1, 2, 5, 10, 20].find((st) => span / st <= 5) || 50;
    lo = Math.floor((lo - span * 0.1) / step) * step;
    hi = Math.ceil((hi + span * 0.1) / step) * step;
    const n = dayKeys.length;
    const idx = Object.fromEntries(dayKeys.map((k, i) => [k, i]));
    const x = (k) => L + ((W - L - R) * (idx[k] + 0.5)) / n;
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight and trend for the last ${n} days">`;
    for (let v = lo; v <= hi + 1e-9; v += step) {
      svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-t" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${round(v, 1)}</text>`;
    }
    const labelEvery = Math.max(1, Math.ceil(n / Math.floor((W - L - R) / 44)));
    dayKeys.forEach((k, i) => {
      if ((n - 1 - i) % labelEvery) return;
      const dt = parseKey(k);
      svg += `<text class="axis-t" x="${x(k)}" y="${H - 8}" text-anchor="middle">${dt.getMonth() + 1}/${dt.getDate()}</text>`;
    });
    svg += `<path class="trend" d="${pts.map((p, i) => `${i ? "L" : "M"}${x(p.k)},${y(toDisplay(p.t))}`).join(" ")}"/>`;
    for (const p of pts) svg += `<circle class="scale-dot" cx="${x(p.k)}" cy="${y(toDisplay(p.w))}" r="4"/>`;
    const last = pts[pts.length - 1];
    svg += `<circle class="trend-end" cx="${x(last.k)}" cy="${y(toDisplay(last.t))}" r="4.5"/>`;
    svg += `</svg><div class="tip" hidden></div>`;
    box.innerHTML = svg;
    const tip = $(".tip", box);
    box.onmousemove = (e) => {
      const rect = box.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      let best = null;
      for (const p of pts) if (!best || Math.abs(x(p.k) - px) < Math.abs(x(best.k) - px)) best = p;
      if (!best || Math.abs(x(best.k) - px) > (W - L - R) / n) { tip.hidden = true; return; }
      tip.innerHTML = `<b>${parseKey(best.k).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</b> · scale ${round(toDisplay(best.w), 1)} ${u} · trend ${round(toDisplay(best.t), 1)} ${u}`;
      tip.hidden = false;
      tip.style.left = Math.min(Math.max(e.clientX - rect.left, 110), rect.width - 110) + "px";
      tip.style.top = (y(toDisplay(best.w)) / H) * rect.height + "px";
    };
    box.onmouseleave = () => (tip.hidden = true);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!$("#view-history").hidden) renderHistory(); }, 150);
  });

  // ---------- GOALS ----------
  $("#goal-inputs").innerHTML = NUTRIENTS.map((n) =>
    `<label class="field"><span>${n.label} (${n.unit})</span><input type="number" min="0" step="any" id="g-${n.key}"></label>`).join("");
  function fillGoals() {
    for (const k of NK) $("#g-" + k).value = round(state.goals[k], 0);
    $("#goal-units").value = state.units;
    $("#goal-water").value = round(state.waterGoal, 1);
    $("#goal-water-oz").value = Math.round(state.waterGoal * GLASS_OZ);
  }
  $("#goal-water-oz").addEventListener("input", (e) => {
    const oz = Number(e.target.value);
    if (oz > 0) $("#goal-water").value = round(oz / GLASS_OZ, 1);
  });
  $("#goal-water").addEventListener("input", (e) => {
    const g = Number(e.target.value);
    if (g > 0) $("#goal-water-oz").value = Math.round(g * GLASS_OZ);
  });
  $("#goals-form").addEventListener("submit", (e) => {
    e.preventDefault();
    for (const k of NK) { const v = Number($("#g-" + k).value); if (v >= 0) state.goals[k] = v; }
    const oz = Number($("#goal-water-oz").value);
    state.waterGoal = oz > 0 ? Math.max(1, oz / GLASS_OZ) : 8;
    state.units = $("#goal-units").value === "metric" ? "metric" : "imperial";
    save();
    renderToday();
    $("#goals-msg").textContent = "Targets saved.";
    toast("Targets saved");
  });

  // Calorie change from maintenance and protein per kg of body weight for each goal.
  // Protein follows the ISSN range of 1.6-2.2 g/kg for people doing resistance training.
  const GOAL_PLANS = {
    "lose": { kcal: -500, proKg: 1.8, fatPct: 0.28, note: "Higher protein helps you keep muscle while losing fat." },
    "lose-slow": { kcal: -250, proKg: 1.8, fatPct: 0.28, note: "A gentler deficit that's easier to stick with." },
    "maintain": { kcal: 0, proKg: 1.6, fatPct: 0.28, note: "" },
    "muscle": { kcal: 300, proKg: 2.0, fatPct: 0.25, note: "A small surplus with high protein. Lift weights at least 3 days a week, and aim to gain about 0.25 to 0.5% of your body weight per week. If the trend on History rises faster, lower calories by 100 to 200." },
    "recomp": { kcal: -200, proKg: 2.2, fatPct: 0.25, note: "A slight deficit with very high protein. Works best if you're new to lifting or returning after a break. Train each muscle group at least twice a week, and judge progress by strength and measurements as much as the scale." },
    "gain": { kcal: 500, proKg: 1.6, fatPct: 0.28, note: "A larger surplus for gaining weight. Without strength training, more of it will be fat." },
  };
  function calcTDEE() {
    const imperial = $("#t-units").value === "imperial";
    let kg = Number($("#t-weight").value), cm = Number($("#t-height").value);
    if (imperial) { kg *= 0.453592; cm *= 2.54; }
    const age = Number($("#t-age").value);
    if (!(kg > 0 && cm > 0 && age > 0)) return null;
    const bmr = 10 * kg + 6.25 * cm - 5 * age + ($("#t-sex").value === "m" ? 5 : -161);
    const tdee = bmr * Number($("#t-activity").value);
    const floor = $("#t-sex").value === "m" ? 1500 : 1200;
    const plan = GOAL_PLANS[$("#t-goal").value] || GOAL_PLANS.maintain;
    const target = Math.max(floor, Math.round((tdee + plan.kcal) / 10) * 10);
    // Protein by goal (capped at 40% of kcal), fat as a share of kcal, rest carbs
    const pro = Math.min(Math.round(plan.proKg * kg), Math.round((target * 0.4) / 4));
    const fat = Math.round((target * plan.fatPct) / 9);
    const carb = Math.max(0, Math.round((target - pro * 4 - fat * 9) / 4));
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), target, pro, fat, carb, kg };
  }
  function renderTDEE() {
    const imperial = $("#t-units").value === "imperial";
    $("#t-weight-l").textContent = imperial ? "Weight (lb)" : "Weight (kg)";
    $("#t-height-l").textContent = imperial ? "Height (in)" : "Height (cm)";
    const r = calcTDEE();
    const plan = GOAL_PLANS[$("#t-goal").value] || GOAL_PLANS.maintain;
    $("#t-goal-note").textContent = plan.note
      ? `${plan.kcal > 0 ? "+" : plan.kcal < 0 ? "−" : ""}${Math.abs(plan.kcal)} kcal vs maintenance · protein ${plan.proKg} g per kg. ${plan.note}`
      : "";
    $("#tdee-out").innerHTML = r
      ? [["BMR", r.bmr + " kcal"], ["Maintenance", r.tdee + " kcal"], ["Daily target", r.target + " kcal"], ["Protein", r.pro + " g"], ["Carbs", r.carb + " g"], ["Fat", r.fat + " g"]]
        .map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join("")
      : `<p class="hint">Fill in age, weight and height.</p>`;
  }
  $("#t-units").addEventListener("change", () => {
    const imperial = $("#t-units").value === "imperial";
    const w = Number($("#t-weight").value), h = Number($("#t-height").value);
    if (w) $("#t-weight").value = round(imperial ? w / 0.453592 : w * 0.453592, 1);
    if (h) $("#t-height").value = round(imperial ? h / 2.54 : h * 2.54, 1);
    renderTDEE();
  });
  $("#tdee-form").addEventListener("input", renderTDEE);
  $("#tdee-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = calcTDEE();
    if (!r) return;
    Object.assign(state.goals, { kcal: r.target, pro: r.pro, carb: r.carb, fat: r.fat, sat: Math.round((r.target * 0.1) / 9) });
    save();
    fillGoals();
    renderToday();
    toast("Targets updated from your estimate");
  });

  // ---------- Backup ----------
  const dataMsg = (t) => ($("#data-msg").textContent = t);
  $("#export-btn").addEventListener("click", () => {
    $("#data-panel").hidden = false;
    $("#data-text").value = JSON.stringify(state, null, 1);
    $("#data-apply").hidden = true;
    $("#data-file-l").hidden = true;
    $("#data-copy").hidden = false;
    $("#data-download").hidden = false;
    dataMsg("Copy this text or download it as a file to keep a backup.");
  });
  $("#import-btn").addEventListener("click", () => {
    $("#data-panel").hidden = false;
    $("#data-text").value = "";
    $("#data-apply").hidden = false;
    $("#data-file-l").hidden = false;
    $("#data-copy").hidden = true;
    $("#data-download").hidden = true;
    $("#data-text").focus();
    dataMsg("Paste a backup, or choose a backup file. Restoring replaces the data in this browser.");
  });
  $("#data-copy").addEventListener("click", async () => {
    const ta = $("#data-text");
    try { await navigator.clipboard.writeText(ta.value); dataMsg("Copied to clipboard."); }
    catch (e) { ta.select(); dataMsg("Text selected. Press Ctrl+C (or ⌘C) to copy."); }
  });
  $("#data-download").addEventListener("click", () => {
    try {
      const blob = new Blob([$("#data-text").value], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nutrilog-backup-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { dataMsg("Download is blocked here. Use Copy instead."); }
  });
  $("#data-file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { $("#data-text").value = r.result; dataMsg("File loaded. Press “Restore from this text” to apply it."); };
    r.readAsText(f);
  });
  $("#data-apply").addEventListener("click", () => {
    try {
      const parsed = JSON.parse($("#data-text").value);
      if (!parsed || typeof parsed !== "object" || !("log" in parsed)) throw new Error("bad");
      state = normalize(parsed);
      save();
      renderAll();
      dataMsg("Backup restored.");
      toast("Backup restored");
    } catch (e) {
      dataMsg("That text is not a NutriLog backup. Paste the full text from “Show backup”.");
    }
  });
  $("#reset-btn").addEventListener("click", () => ($("#reset-confirm").hidden = false));
  $("#reset-no").addEventListener("click", () => ($("#reset-confirm").hidden = true));
  $("#reset-yes").addEventListener("click", () => {
    state = defaultState();
    save();
    $("#reset-confirm").hidden = true;
    renderAll();
    dataMsg("All data erased.");
  });

  // ---------- Photo estimate (hosted on claude.ai only) ----------
  const PHOTO_PROMPT = (note) => `You are estimating nutrition from photos of food someone ate.
Identify each distinct food or drink you can see and estimate the portion shown.
${note ? `The person adds: "${note}"\n` : ""}Reply with only JSON in this shape:
{"items":[{"name":"Grilled chicken breast","portion":"about 1 piece (150 g)","grams":150,"kcal":248,"pro":46.5,"carb":0,"fat":5.4,"fib":0,"sug":0,"sat":1.5,"chol":128,"na":111}],"note":"one short sentence about confidence or assumptions"}
Rules: values are totals for the portion shown, not per 100 g. kcal in kcal; pro, carb, fat, fib, sug, sat in grams; chol and na (sodium) in milligrams.
Include visible sauces, dressings, oils and drinks as their own items. Use typical USDA values. If there is no food in the photo, return {"items":[],"note":"..."}.`;

  let photoItems = [];
  function setupPhoto() {
    // The card is always shown. Whether Claude can look at images is checked in the
    // background and only matters when the person presses Estimate.
    let sample = null;
    let limits = null;
    const ready = (async () => {
      if (!window.claude || typeof window.claude.use !== "function") return;
      try { sample = await window.claude.use("sample"); } catch (e) { sample = null; }
      if (sample) limits = await sample.limits().catch(() => null);
    })();
    // Three ways in: camera, photo library, or any image file. Picks from all three collect into one set.
    const sources = ["#photo-camera", "#photo-library", "#photo-file"].map((id) => $(id));
    const types = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    let maxCount = 5;
    ready.then(() => {
      if (limits && limits.images) {
        limits.images.mediaTypes.forEach((t) => types.add(t));
        maxCount = limits.images.maxCount;
      }
    });
    let photoFiles = [];
    let ctl = null;
    $("#photo-meal").innerHTML = mealOptions(defaultMeal());

    function renderThumbs() {
      const box = $("#photo-thumbs");
      for (const img of box.querySelectorAll("img")) URL.revokeObjectURL(img.src);
      box.innerHTML = "";
      photoFiles.forEach((f, i) => {
        const wrap = document.createElement("div");
        wrap.className = "thumb";
        const img = document.createElement("img");
        img.alt = `Meal photo ${i + 1}`;
        img.src = URL.createObjectURL(f);
        const rm = document.createElement("button");
        rm.type = "button";
        rm.dataset.rmphoto = String(i);
        rm.setAttribute("aria-label", `Remove photo ${i + 1}`);
        rm.textContent = "×";
        wrap.append(img, rm);
        box.append(wrap);
      });
      $("#photo-go").disabled = !photoFiles.length;
      $("#photo-details").hidden = !photoFiles.length;
    }
    function addFiles(list) {
      const picked = Array.from(list || []);
      const ok = picked.filter((f) => types.has(f.type) || (!f.type && /\.(jpe?g|png|webp|gif)$/i.test(f.name)));
      const room = maxCount - photoFiles.length;
      photoFiles = photoFiles.concat(ok.slice(0, Math.max(0, room)));
      const msgs = [];
      if (ok.length < picked.length) msgs.push("Some files were skipped. Use JPEG, PNG, WebP or GIF images (HEIC: export as JPEG first).");
      if (ok.length > room) msgs.push(`Up to ${maxCount} photos per estimate.`);
      $("#photo-msg").textContent = msgs.join(" ");
      $("#photo-results").innerHTML = "";
      photoItems = [];
      renderThumbs();
    }
    for (const input of sources) {
      input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
    }
    $("#photo-thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rmphoto]");
      if (!b) return;
      photoFiles.splice(Number(b.dataset.rmphoto), 1);
      renderThumbs();
    });

    $("#photo-stop").addEventListener("click", () => ctl && ctl.abort());

    $("#photo-go").addEventListener("click", async () => {
      const files = photoFiles.slice();
      if (!files.length) return;
      $("#photo-msg").textContent = "Checking that photo estimates are available…";
      await ready;
      if (!sample || !limits || !limits.images) {
        $("#photo-msg").textContent = window.claude
          ? "Photo estimates aren't available in this view of the app. Send the photo to Claude in your chat instead, and it will be added to your log here."
          : "Photo estimates only work in the version hosted on claude.ai. Here, search for the foods instead.";
        return;
      }
      ctl = new AbortController();
      $("#photo-go").disabled = true;
      $("#photo-stop").hidden = false;
      $("#photo-results").innerHTML = "";
      $("#photo-msg").textContent = "Looking at your photo… this usually takes 10 to 40 seconds.";
      try {
        const out = await sample.json(PHOTO_PROMPT($("#photo-note").value.trim()), { images: files, signal: ctl.signal });
        const items = (out && Array.isArray(out.items) ? out.items : []).filter((x) => x && x.name);
        photoItems = items.map((x) => {
          const n = zero();
          for (const k of NK) n[k] = Math.max(0, Number(x[k]) || 0);
          return { name: String(x.name).slice(0, 120), portion: String(x.portion || "1 portion").slice(0, 80), grams: Number(x.grams) > 0 ? Number(x.grams) : 0, n, on: true, mult: 1 };
        });
        $("#photo-msg").textContent = photoItems.length ? (out.note ? String(out.note) : "") : (out && out.note ? String(out.note) : "No food found in that photo. Try a clearer or closer shot.");
        renderPhotoResults();
      } catch (e) {
        const code = e && e.code;
        $("#photo-msg").textContent =
          code === "cancelled" ? "Stopped." :
          code === "not_granted" || code === "sampling_disabled" ? "Photo estimates need permission to use Claude. You can allow it from this page's permissions." :
          code === "rate_limited" ? "Too many requests right now. Try again in a minute." :
          code === "image_rejected" ? "That image couldn't be read. Try a JPEG or PNG under 20 MB." :
          code === "invalid_json" ? "The estimate came back in an unexpected format. Press Estimate again." :
          "The estimate didn't finish. Press Estimate again.";
      } finally {
        $("#photo-go").disabled = false;
        $("#photo-stop").hidden = true;
        ctl = null;
      }
    });

    $("#photo-results").addEventListener("input", (e) => {
      const i = Number(e.target.dataset.i);
      if (!photoItems[i]) return;
      if (e.target.type === "checkbox") photoItems[i].on = e.target.checked;
      else photoItems[i].mult = Math.max(0, Number(e.target.value) || 0);
      updatePhotoTotals();
    });
    $("#photo-results").addEventListener("click", (e) => {
      if (!e.target.closest("#photo-add")) return;
      const meal = $("#photo-meal").value;
      let count = 0;
      for (const it of photoItems) {
        if (!it.on || !(it.mult > 0)) continue;
        const g = it.grams || 100;
        const per100 = {};
        for (const k of NK) per100[k] = (it.n[k] / g) * 100;
        const food = { id: "p:" + uid(), name: it.name, cat: "Photo", source: "photo", per100, serving: { label: it.portion, g } };
        logFood(food, it.mult, "serving", meal);
        count++;
      }
      if (!count) return;
      photoItems = [];
      $("#photo-results").innerHTML = "";
      photoFiles = [];
      renderThumbs();
      $("#photo-note").value = "";
      $("#photo-go").disabled = true;
      $("#photo-msg").textContent = "";
      renderToday();
      toast(`Added ${count} item${count === 1 ? "" : "s"} to ${MEALS.find((m) => m.id === meal).label}`);
    });
  }
  function renderPhotoResults() {
    if (!photoItems.length) { $("#photo-results").innerHTML = ""; return; }
    $("#photo-results").innerHTML = `<div class="est-list">${photoItems.map((it, i) => `
      <div class="est">
        <input type="checkbox" data-i="${i}" ${it.on ? "checked" : ""} aria-label="Include ${esc(it.name)}">
        <div class="est-name"><b>${esc(it.name)}</b><small>${esc(it.portion)} · P ${fmt(it.n.pro)} · C ${fmt(it.n.carb)} · F ${fmt(it.n.fat)}</small></div>
        <input type="number" min="0" step="0.25" value="${it.mult}" data-i="${i}" aria-label="Portions of ${esc(it.name)}" title="Portions eaten">
        <span class="est-kcal" data-k="${i}"></span>
      </div>`).join("")}</div>
      <div class="est-foot"><span class="est-total" id="photo-total"></span><button class="btn primary" id="photo-add">Add to log</button></div>
      <p class="hint">These are estimates from a photo. Portion sizes are the biggest source of error, so adjust the amount if you know it.</p>`;
    updatePhotoTotals();
  }
  function updatePhotoTotals() {
    let kcal = 0;
    photoItems.forEach((it, i) => {
      const k = it.n.kcal * it.mult;
      const el = $(`[data-k="${i}"]`);
      if (el) el.textContent = `${Math.round(k)} kcal`;
      if (it.on) kcal += k;
    });
    const t = $("#photo-total");
    if (t) t.textContent = `Total: ${Math.round(kcal).toLocaleString()} kcal`;
  }

  // ---------- Read a Nutrition Facts label into the custom food form ----------
  const LABEL_PROMPT = `These photos show a packaged food or drink: a Nutrition Facts (or nutrition information) panel, and possibly the front of the package.
Read the values exactly as printed for ONE serving. Reply with only JSON in this shape:
{"readable":true,"name":"Greek yogurt, vanilla","brand":"Chobani","servingLabel":"1 container","servingGrams":150,"kcal":120,"pro":12,"carb":15,"fat":0,"fib":0,"sug":13,"sat":0,"chol":10,"na":60,"note":""}
Rules: kcal in calories; pro, carb, fat, fib, sug, sat in grams; chol and na (sodium) in milligrams. Use 0 for nutrients the label lists as 0 and null for ones it doesn't show.
servingGrams is the weight in grams printed with the serving size. If only millilitres are printed, use that number and say so in note. If only a per-100 g column exists, use servingLabel "100 g" and servingGrams 100.
If the product name isn't visible, give a short descriptive name. If no nutrition panel is readable, return {"readable":false,"note":"what went wrong"}.`;

  function setupLabelScan() {
    let sample = null, limits = null;
    const ready = (async () => {
      if (!window.claude || typeof window.claude.use !== "function") return;
      try { sample = await window.claude.use("sample"); } catch (e) { sample = null; }
      if (sample) limits = await sample.limits().catch(() => null);
    })();
    const msg = (t) => ($("#lbl-msg").textContent = t);
    let ctl = null;
    $("#lbl-stop").addEventListener("click", () => ctl && ctl.abort());

    async function readLabel(fileList) {
      const okTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      let files = Array.from(fileList || []).filter((f) => okTypes.has(f.type) || (limits && limits.images && limits.images.mediaTypes.includes(f.type)));
      if (!files.length) { msg("Use a JPEG, PNG, WebP or GIF photo of the label."); return; }
      msg("Checking that label reading is available…");
      await ready;
      if (!sample || !limits || !limits.images) {
        msg(window.claude
          ? "Label reading isn't available in this view of the app. Send the label photo to Claude in your chat and it will add the food for you, or type the numbers below."
          : "Label reading only works in the version hosted on claude.ai. Type the numbers below instead.");
        return;
      }
      files = files.slice(0, limits.images.maxCount);
      ctl = new AbortController();
      $("#lbl-stop").hidden = false;
      msg("Reading the label… this usually takes 10 to 30 seconds.");
      try {
        const out = await sample.json(LABEL_PROMPT, { images: files, signal: ctl.signal });
        if (!out || out.readable === false) { msg((out && out.note ? String(out.note) + " " : "") + "Try a sharper, closer photo of the Nutrition Facts panel."); return; }
        const num = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
        const name = String(out.name || "").trim().slice(0, 100);
        const brand = String(out.brand || "").trim().slice(0, 60);
        resetCustomForm();
        const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})`.trim() : name;
        $("#cf-name").value = fullName.replace(/^\((.*)\)$/, "$1") || "Scanned product";
        $("#cf-serving").value = String(out.servingLabel || "1 serving").slice(0, 60);
        const g = num(out.servingGrams);
        $("#cf-grams").value = g > 0 ? round(g, 1) : 100;
        const missing = [];
        for (const k of NK) {
          const v = num(out[k]);
          $("#cf-" + k).value = v == null ? "" : round(v, k === "kcal" || k === "na" || k === "chol" ? 0 : 1);
          if (v == null) missing.push(NBY[k].label.toLowerCase());
        }
        for (const el of $$("#custom-form input:not([type=hidden]):not([type=file])")) {
          el.classList.remove("cf-filled"); void el.offsetWidth; el.classList.add("cf-filled");
        }
        msg(`Filled in from the label. Check the numbers, then press Save food.${!(g > 0) ? " The serving weight wasn't printed, so enter it in grams." : ""}${missing.length ? ` Not on the label: ${missing.join(", ")}.` : ""}${out.note ? " " + String(out.note) : ""}`);
        $("#cf-name").focus();
      } catch (e) {
        const code = e && e.code;
        msg(code === "cancelled" ? "Stopped." :
          code === "not_granted" || code === "sampling_disabled" ? "Label reading needs permission to use Claude. You can allow it from this page's permissions." :
          code === "rate_limited" ? "Too many requests right now. Try again in a minute." :
          code === "image_rejected" ? "That image couldn't be read. Try a JPEG or PNG under 20 MB." :
          "The label couldn't be read this time. Try again, or type the numbers below.");
      } finally {
        $("#lbl-stop").hidden = true;
        ctl = null;
      }
    }
    for (const id of ["#lbl-camera", "#lbl-library", "#lbl-file"]) {
      const input = $(id);
      input.addEventListener("change", () => { const f = input.files; readLabel(f); input.value = ""; });
    }
  }

  // ---------- Sample day on first run ----------
  function seedExample() {
    const t = todayKey();
    const add = (id, amount, unit, meal, day) => { const f = findFood(id); if (f) logFood(f, amount, unit, meal, day); };
    add("b:rolled-oats-dry", 1, "serving", "breakfast", t);
    add("b:milk-2", 1, "serving", "breakfast", t);
    add("b:banana-raw", 1, "serving", "breakfast", t);
    add("b:coffee-black", 1, "serving", "breakfast", t);
    add("b:chicken-breast-roasted-skinless", 4, "oz", "lunch", t);
    add("b:brown-rice-cooked", 1, "serving", "lunch", t);
    add("b:broccoli-raw", 1, "serving", "lunch", t);
    add("b:greek-yogurt-plain-nonfat", 1, "serving", "snacks", t);
    add("b:almonds", 1, "serving", "snacks", t);
    // A few earlier days so History has something to show
    const plans = [
      [["b:bagel-plain", 1, "breakfast"], ["b:cream-cheese", 2, "breakfast"], ["b:cheese-pizza", 2, "lunch"], ["b:salmon-atlantic-cooked", 1.5, "dinner"], ["b:quinoa-cooked", 1, "dinner"], ["b:apple-raw", 1, "snacks"]],
      [["b:egg-whole-raw", 2, "breakfast"], ["b:whole-wheat-bread", 2, "breakfast"], ["b:turkey-breast-deli-sliced", 3, "lunch"], ["b:hummus", 2, "lunch"], ["b:pasta-cooked", 2, "dinner"], ["b:marinara-sauce", 1, "dinner"], ["b:dark-chocolate-70-85", 1, "snacks"]],
      [["b:greek-yogurt-plain-nonfat", 1, "breakfast"], ["b:granola", 1, "breakfast"], ["b:cheeseburger-fast-food", 1, "lunch"], ["b:french-fries-fast-food", 1, "lunch"], ["b:lentils-cooked", 1, "dinner"], ["b:white-rice-cooked", 1, "dinner"]],
    ];
    plans.forEach((plan, i) => plan.forEach(([id, amt, meal]) => add(id, amt, "serving", meal, addDays(t, -(i + 1)))));
    state.water[t] = [16, 8];
    state.exercise[t] = [{ id: uid(), name: "Walking, brisk", min: 40, kcal: 210 }];
    // Two weeks of example weigh-ins drifting down about half a pound a week
    let lb = 162.4;
    for (let i = 20; i >= 0; i--) {
      if (i % 3 === 2) continue;
      const noise = Math.sin(i * 1.7) * 0.9;
      state.weights[addDays(t, -i)] = round((lb - (20 - i) * 0.07 + noise) * KG_PER_LB, 3);
    }
    state.draft = {
      name: "Chicken burrito bowl (example)",
      servings: 2,
      items: [
        ["b:chicken-breast-roasted-skinless", 8, "oz"], ["b:white-rice-cooked", 1.5, "serving"], ["b:black-beans-cooked", 1, "serving"],
        ["b:salsa", 4, "serving"], ["b:avocado-raw", 1, "serving"], ["b:cheddar-cheese", 1, "serving"],
      ].filter(([id]) => findFood(id)).map(([id, amount, unit]) => ({ id: uid(), food: snapshot(findFood(id)), amount, unit })),
    };
    state.recent = [];
    save();
  }

  // ---------- Boot ----------
  function renderAll() {
    renderToday();
    fillGoals();
    renderTDEE();
    renderCustomList();
    renderCalc();
    if (!$("#view-history").hidden) renderHistory();
  }

  function applyRemote(render) {
    renderToday();
    if (render === "config") {
      if (!$("#goals-form").contains(document.activeElement)) fillGoals();
      renderCustomList();
      if (!$("#view-calc").contains(document.activeElement)) renderCalc();
    }
    if (!$("#view-history").hidden) renderHistory();
  }

  async function connectDb() {
    let db = null;
    try { db = await window.claude.use("db"); } catch (e) { db = null; }
    if (!db) {
      // Not available here (e.g. signed out): fall back to this browser's storage.
      store.mode = "local";
      const saved = load();
      if (saved) state = saved;
      renderAll();
      return;
    }
    store.db = db;
    store.mode = "db";
    db.collection("days").onSnapshot((snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const k = ch.doc.id;
        const path = "days/" + k;
        if (ch.type === "removed") {
          if (store.written.has(path)) { store.written.delete(path); delete state.log[k]; delete state.water[k]; delete state.exercise[k]; changed = true; }
          continue;
        }
        const body = ch.doc.data() || {};
        const c = canon({ entries: body.entries || [], water: Array.isArray(body.water) ? body.water : [], exercise: body.exercise || [] });
        if (c === store.written.get(path)) continue; // our own write echoing back
        store.written.set(path, c);
        const entries = Array.isArray(body.entries) ? body.entries.filter((e) => e && e.n) : [];
        if (entries.length) state.log[k] = entries; else delete state.log[k];
        const w = waterList(body.water);
        if (w.length) state.water[k] = w; else delete state.water[k];
        const ex = Array.isArray(body.exercise) ? body.exercise.filter((x) => x && x.kcal >= 0) : [];
        if (ex.length) state.exercise[k] = ex; else delete state.exercise[k];
        changed = true;
      }
      if (changed) applyRemote("days");
    }, () => toast("Lost the live connection. Reload the page to reconnect."));
    db.doc("config/main").onSnapshot((snap) => {
      if (!snap.exists) return;
      const body = snap.data() || {};
      const c = canon(body);
      if (c === store.written.get("config/main")) return;
      store.written.set("config/main", c);
      const merged = normalize({ ...state, ...body });
      state.goals = merged.goals; state.waterGoal = merged.waterGoal; state.custom = merged.custom;
      state.recent = merged.recent; state.draft = merged.draft;
      state.weights = merged.weights; state.units = merged.units;
      applyRemote("config");
    }, () => {});
  }

  if (firstRun) seedExample();
  renderAll();
  let startView = "today";
  try { startView = (location.hash || "").slice(1) || localStorage.getItem("nutrilog:view") || "today"; } catch (e) { /* ignore */ }
  showView(startView);
  if (firstRun) toast("Loaded a sample day so you can see how it works. Remove entries any time.");
  if (store.mode === "pending") connectDb();
  setupPhoto();
  setupLabelScan();
})();
