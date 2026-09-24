/* PortionWise – prototype simulation of an AI-style portion recommender.
   All data is local: sample values + localStorage. No backend needed. */

// ---------- 1. Sample data ----------
const defaultData = { mealsTracked: 18, mealsFinished: 14, averageLeftover: 12, foodSaved: 1.8 };
const weeklyWaste = [ // % of food left each day, last 7 days (sample)
  {d:"Mon",v:28},{d:"Tue",v:22},{d:"Wed",v:25},{d:"Thu",v:15},{d:"Fri",v:12},{d:"Sat",v:9},{d:"Sun",v:8}];

// Load saved stats (from feedback page) or fall back to sample data
let userData;
try { userData = JSON.parse(localStorage.getItem("pw_user")) || {...defaultData}; }
catch (e) { userData = {...defaultData}; }
const save = () => { try { localStorage.setItem("pw_user", JSON.stringify(userData)); } catch (e) {} };
const $ = id => document.getElementById(id);

// ---------- 2. Navigation + fade-in ----------
const burger = $("burger");
if (burger) burger.onclick = () => $("links").classList.toggle("open");
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add("in")));
document.querySelectorAll(".fade").forEach(el => io.observe(el));

// ---------- 3. Recommendation algorithm (Feature 1) ----------
// Rule-based scoring: start from the previous portion, then adjust.
function recommendPortion(prevPortion, leftoverPct, hunger) {
  let p = prevPortion;
  p -= leftoverPct * 0.6;                       // frequently leaves food -> smaller portion
  if (hunger === "low") p -= 10;
  if (hunger === "high") p += 10;
  if (hunger === "high" && leftoverPct === 0) p += 10;  // high hunger + always finishes -> larger
  const finishRate = userData.mealsFinished / userData.mealsTracked; // meal history
  if (finishRate > 0.75) p += 5;                // good history -> small bonus
  if (userData.averageLeftover > 25) p -= 5;    // wasteful history -> small cut
  return Math.max(25, Math.min(100, Math.round(p / 5) * 5)); // round to 5, keep 25-100
}

const recForm = $("recForm");
if (recForm) recForm.onsubmit = e => {
  e.preventDefault();
  const f = new FormData(recForm);
  const prev = +f.get("prev"), left = +f.get("left"), hunger = f.get("hunger");
  const rec = recommendPortion(prev, left, hunger);
  const size = rec <= 50 ? "small" : rec <= 75 ? "medium" : "large";
  let why = "Based on your previous consumption and leftover pattern, a " + size + " portion is recommended.";
  if (left >= 50) why += " You left a lot last time, so we reduced it.";
  else if (left === 0 && hunger === "high") why += " You finished everything and feel very hungry, so a bit more is fine.";
  else if (left === 0) why += " You usually finish your food, so we are keeping it close to your current portion.";
  $("recText").textContent = "Recommended Portion: " + rec + "%";
  $("recWhy").textContent = why + " (" + f.get("food") + ", " + f.get("meal") + ")";
  $("result").classList.add("show");
  $("ring").style.setProperty("--p", 0);
  $("ringNum").textContent = rec + "%";
  $("fill").style.width = "0";
  setTimeout(() => { $("ring").style.setProperty("--p", rec); $("fill").style.width = rec + "%"; }, 60);
  $("result").scrollIntoView({behavior: "smooth", block: "nearest"});
};

// ---------- 4. Meal feedback (Feature 2) ----------
function showStats() {  // fills any element with data-stat="name"
  const vals = {
    mealsTracked: userData.mealsTracked, mealsFinished: userData.mealsFinished,
    averageLeftover: userData.averageLeftover.toFixed(0) + "%", foodSaved: userData.foodSaved.toFixed(1) + " kg" };
  document.querySelectorAll("[data-stat]").forEach(el => el.textContent = vals[el.dataset.stat]);
}
const fbForm = $("fbForm");
if (fbForm) fbForm.onsubmit = e => {
  e.preventDefault();
  const f = new FormData(fbForm);
  const leftPct = {none: 0, little: 15, half: 50, more: 75}[f.get("left")];
  // update stats (running average for leftover)
  userData.averageLeftover = (userData.averageLeftover * userData.mealsTracked + leftPct) / (userData.mealsTracked + 1);
  userData.mealsTracked++;
  if (leftPct <= 15) userData.mealsFinished++;
  if (f.get("size") === "right" && leftPct <= 15) userData.foodSaved += 0.1;
  save();
  const tips = {little: "Next time we will suggest a slightly larger portion.", right: "Great! We will keep your portion similar.",
                much: "Noted. We will suggest a smaller portion next time."};
  $("fbMsg").textContent = "Thank you! Feedback saved. " + tips[f.get("size")];
  $("fbMsg").classList.add("show");
  showStats();
};
showStats();

// ---------- 5. Dashboard: chart, impact, calculator ----------
const chart = $("chart");
if (chart) {
  chart.innerHTML = weeklyWaste.map(w => `<div class="col"><span>${w.v}%</span><i data-h="${w.v}" class="${w.v < 15 ? "low" : ""}"></i><span>${w.d}</span></div>`).join("");
  setTimeout(() => chart.querySelectorAll("i").forEach(b => b.style.height = (b.dataset.h * 2.6) + "px"), 100);
  // Estimates only: 1 kg food saved ~ 800 L water and ~2.5 kg CO2e (illustrative values)
  $("iFood").textContent = userData.foodSaved.toFixed(1) + " kg";
  $("iWater").textContent = Math.round(userData.foodSaved * 800) + " L";
  $("iCo2").textContent = (userData.foodSaved * 2.5).toFixed(1) + " kg";
}
const calc = $("calcForm");
if (calc) calc.onsubmit = e => {
  e.preventDefault();
  const taken = +$("taken").value, left = +$("leftG").value;
  if (taken <= 0 || left < 0 || left > taken) { $("calcOut").textContent = "Enter food taken above 0, and food left no more than food taken."; return; }
  const pct = (left / taken) * 100;   // percentage left = (left / taken) x 100
  const m = pct <= 10 ? "Excellent! Very little food was wasted." : pct <= 30 ? "Good, but there is room for improvement." : "A smaller portion may be recommended next time.";
  $("calcOut").textContent = pct.toFixed(1) + "% left. " + m;
};
