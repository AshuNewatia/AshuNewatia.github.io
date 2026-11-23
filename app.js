"use strict";

const root = document.documentElement;
const main = document.querySelector("main");
const scenes = [...main.querySelectorAll(".scene")];
const nav = [...document.querySelectorAll(".masthead nav a")];
const landscape = document.querySelector(".landscape");
const skyControl = document.querySelector("#sky-time");
const wipe = document.querySelector(".chapter-wipe");
const doors = [...wipe.children];
const dawnIndex = scenes.findIndex(scene => scene.id === "dawn");
let skyMode = skyControl.value;
let enteringChapter = false;
const contact = document.querySelector(".finale-copy");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const canvas = document.querySelector(".sky-stars");
const ctx = canvas.getContext("2d");
const tau = 2 * Math.PI;
const clamp = value => Math.max(0, Math.min(1, value));
const wrap = (value, length) => ((value % length) + length) % length;

function smooth(value, start, end) {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

function css(element, property, value, unit = "") {
  element.style.setProperty(property, value.toFixed(3) + unit);
}

const before = document.createElement("div");
const after = document.createElement("div");
for (const buffer of [before, after]) {
  buffer.className = "loop-buffer";
  buffer.hidden = true;
  buffer.setAttribute("aria-hidden", "true");
}
main.prepend(before);
main.append(after);

let origin = 0;
let period = 0;
let viewport = 1;
let phase = 0;
let active = -1;
let looping = false;
let scrollFrame = 0;
let paintFrame = 0;
let width = 0;
let height = 0;

const starColors = ["#fff0ed", "#bdc9ff", "#ffd2e4"];
const stars = Array.from({length: 117}, (_, i) => ({
  x: Math.random(), y: Math.random() * .76, radius: .38 + Math.random() * 1.04,
  rate: .55 + Math.random() * 1.1, shift: Math.random() * tau,
  color: starColors[i % starColors.length], sparkle: i % 6 === 0
}));

function drawStars(time) {
  const orbit = phase * tau;
  const count = width < 710 ? 72 : stars.length;
  for (let i = 0; i < count; i++) {
    const star = stars[i];
    const x = wrap(star.x + Math.sin(orbit) * .014 * star.rate, 1) * width;
    const y = (star.y + (1 - Math.cos(orbit)) * .007 * star.rate) * height;
    const twinkle = looping ? .5 + .5 * Math.sin(time * star.rate + star.shift) : .4;
    const glint = twinkle ** 7;
    ctx.fillStyle = star.color;
    ctx.globalAlpha = (.19 + twinkle * .76) * (x < width * .42 ? .63 : 1);
    ctx.beginPath();
    ctx.arc(x, y, star.radius * (.75 + twinkle * .36), 0, tau);
    ctx.fill();
    if (star.sparkle && glint > .18) {
      const size = 2 + glint * 6;
      ctx.globalAlpha *= glint;
      ctx.fillRect(x - size, y - .36, size * 2, .72);
      ctx.fillRect(x - .36, y - size, .72, size * 2);
    }
  }
  ctx.globalAlpha = 1;
}

const cometDust = Array.from({length: 19}, (_, index) => ({
  lag: .065 + index * .012,
  spread: Math.sin(index * 12.39) * (3 + index * .68),
  shift: index * 2.4,
  radius: index % 4 === 0 ? 1.2 : .65
}));

function drawComet(progress, time, opacity) {
  if (opacity <= 0) return;
  const point = t => [(.98 - .52 * t) * width, (.08 + .145 * t + .18 * t ** 2) * height];
  const [x, y] = point(progress);
  const length = .32;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  for (const [color, fork] of [["134,231,255", -.12], ["174,129,255", .16]]) {
    const tailPoint = t => {
      const [px, py] = point(progress - t * length);
      return [px, py + height * fork * t ** 2];
    };
    const [tailX, tailY] = tailPoint(1);
    const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
    gradient.addColorStop(0, "rgba(" + color + ",0)");
    gradient.addColorStop(.55, "rgba(" + color + ",.34)");
    gradient.addColorStop(1, "rgb(" + color + ")");
    ctx.strokeStyle = gradient;
    ctx.shadowColor = "rgb(" + color + ")";
    ctx.shadowBlur = 11;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    for (let i = 13; i >= 0; i--) ctx.lineTo(...tailPoint(i / 14));
    ctx.stroke();
  }

  ctx.shadowColor = "#b0edff";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#effaff";
  ctx.beginPath();
  ctx.arc(x, y, 2.9, 0, tau);
  ctx.fill();
  ctx.shadowBlur = 0;
  for (const spark of cometDust) {
    const [px, py] = point(progress - spark.lag);
    ctx.globalAlpha = opacity * .43 * (1 - spark.lag / length);
    ctx.beginPath();
    ctx.arc(px + Math.sin(time * .34 + spark.shift) * 4,
      py + spark.spread + Math.cos(time * .29 + spark.shift) * 3, spark.radius, 0, tau);
    ctx.fill();
  }
  ctx.restore();
}

function drawReunion(progress) {
  const light = smooth(progress, .74, .85) * (1 - smooth(progress, .85, 1));
  if (light <= 0) return;
  const x = width * .62;
  const y = height * .4;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 70);
  glow.addColorStop(0, "#fff4ed");
  glow.addColorStop(.12, "#ffbad7cb");
  glow.addColorStop(1, "#cabbff00");
  ctx.save();
  ctx.globalAlpha = light;
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70, y - 70, 140, 140);
  ctx.strokeStyle = "#ffc1df";
  const radius = 8 + smooth(progress, .75, 1) * Math.min(width * .24, 224);
  ctx.beginPath();
  ctx.ellipse(x, height * .7, radius, radius * .115, 0, 0, tau);
  ctx.stroke();
  ctx.restore();
}

function paint(now = performance.now()) {
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  if (skyMode === "morning") return;
  drawStars(now / 1000);

  // Fade the return pass so the two ends share the same opening composition.
  const cometPhase = looping ? .23 + .77 * smooth(phase, 0, .91) : .23;
  const returning = looping && phase >= .95;
  const opacity = !looping ? .62 : returning
    ? .82 * smooth(phase, .95, .995)
    : .82 * (1 - smooth(phase, .83, .94));
  drawComet(returning ? .23 : cometPhase, looping ? now / 1000 : 0, opacity);
  if (looping) drawReunion((phase - .79) / .15);
}

function animate(now) {
  paint(now);
  paintFrame = requestAnimationFrame(animate);
}

function syncSky() {
  cancelAnimationFrame(paintFrame);
  paintFrame = 0;
  if (!ctx || document.hidden) return;
  paint();
  if (looping && skyMode !== "morning") paintFrame = requestAnimationFrame(animate);
}

function fitSky() {
  if (!ctx) return;
  width = landscape.clientWidth;
  height = landscape.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function measure() {
  viewport = window.innerHeight;
  origin = Math.round(scenes[0].getBoundingClientRect().top + window.scrollY);
  period = Math.round(after.getBoundingClientRect().top + window.scrollY) - origin;
}

const threadPath = document.querySelector("#musubi-path");
const threadLength = threadPath.getTotalLength();
// Lay both strands around the same centerline so the braid draws with the ribbon.
for (const [index, strand] of [...document.querySelectorAll(".thread-weave")].entries()) {
  const points = [];
  for (let pos = 0; pos <= Math.ceil(threadLength / 2.5); pos++) {
    const distance = Math.min(pos * 2.5, threadLength);
    const center = threadPath.getPointAtLength(distance);
    const previous = threadPath.getPointAtLength(Math.max(0, distance - 1));
    const next = threadPath.getPointAtLength(Math.min(threadLength, distance + 1));
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    const bend = Math.sin(distance / 13 * tau + index * Math.PI) * 1.25;
    points.push((center.x - Math.sin(angle) * bend).toFixed(2) + " " +
      (center.y + Math.cos(angle) * bend).toFixed(2));
  }
  strand.setAttribute("d", "M " + points.join(" L "));
}

const knots = [...document.querySelectorAll(".thread-node")].map((node, index) => {
  const fraction = .23 + index * .11;
  const distance = threadLength * fraction;
  const point = threadPath.getPointAtLength(distance);
  const tangent = threadPath.getPointAtLength(distance + 1);
  const angle = Math.atan2(tangent.y - point.y, tangent.x - point.x) * 180 / Math.PI;
  node.setAttribute("transform", "translate(" + point.x + " " + point.y + ") rotate(" + angle + ") scale(.62)");
  return {node, fraction, scene: scenes.findIndex(scene => scene.id === node.dataset.scene)};
});

function drawThread(boxes) {
  const reset = smooth(phase, .93, .998);
  let revealed = .22;
  for (const knot of knots) {
    const entry = 1 - smooth(boxes[knot.scene].top / viewport, .12, .79);
    revealed = Math.max(revealed, .22 + (knot.fraction + .06 - .22) * entry);
    css(knot.node, "--knot-opacity", looping ? smooth(entry, .76, 1) * (1 - reset) : .48);
  }
  css(landscape, "--thread-offset", looping ? 1 - (revealed * (1 - reset) + .22 * reset) : 0);
  css(landscape, "--thread-opacity", looping ? .58 + .22 * Math.sin(Math.PI * phase) ** 2 : .4);
}

function updateThreadHighlight() {
  const highlight = document.querySelector(
    ".masthead nav a:is(:hover, :focus-visible), .project .scene-art:is(:hover, :focus-within)"
  );
  root.classList.toggle("thread-highlight", Boolean(highlight));
}

for (const target of document.querySelectorAll(".masthead nav a, .project .scene-art")) {
  for (const event of ["pointerenter", "pointerleave", "focusin", "focusout"]) {
    target.addEventListener(event, () => requestAnimationFrame(updateThreadHighlight));
  }
}

const booking = document.querySelector(".booking-demo");
const aging = document.querySelector(".aging-demo");
const seats = booking.querySelector(".seat-count");
const winner = booking.querySelector(".booking-winner");
const waiting = booking.querySelector(".booking-wait");
const elapsed = aging.querySelector(".elapsed-wait");

function writeText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

let manualBooking = false;
let manualAging = false;
let minutes = 0;

function showBooking(bookingPhase) {
  const booked = bookingPhase >= .59;
  writeText(seats, booked ? "0 seats left" : "1 seat left");
  writeText(winner, booked ? "Ticket issued" : bookingPhase > .13 ? "Booking…" : "Ready");
  writeText(waiting, bookingPhase >= .76 ? "Waitlisted" : bookingPhase > .23 ? "Booking…" : "Ready");
  css(booking, "--request", smooth(bookingPhase, .12, .59));
  css(booking, "--request-b", smooth(bookingPhase, .23, .76) * .93);
}

function showAging(agingPhase) {
  writeText(elapsed, Math.round(agingPhase * 40) + " min");
  css(aging, "--swap", smooth(agingPhase, .44, .77));
}

function setChapter(index) {
  if (index === active) return;
  scenes[active]?.removeAttribute("data-current");
  active = index;
  const scene = scenes[index];
  scene.setAttribute("data-current", "");
  const hash = scene.classList.contains("project") ? "#campusflow" : "#" + scene.id;
  for (const link of nav) {
    if (link.hash === hash) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

function update() {
  scrollFrame = 0;
  let offset = window.scrollY - origin;
  // Keep physical room above and below one lap, then rebase to the equivalent frame.
  if (looping && period > 0 && (offset < 0 || offset >= period)) {
    offset = wrap(offset, period);
    window.scrollTo({top: origin + offset, behavior: "instant"});
  }
  phase = looping && period > 0 ? clamp(offset / period) : 0;
  const boxes = scenes.map(scene => scene.getBoundingClientRect());
  const remaining = (period - offset) / viewport;
  const arrival = 1 - smooth(offset / viewport, .09, .76);
  const returnToOpening = 1 - smooth(remaining, .23, .91);
  const opening = looping ? Math.max(arrival, returnToOpening) : 1;
  css(scenes[0], "--opening", opening);
  css(scenes[0], "--opening-rise", (1 - opening) * 21, "px");

  let chapter = boxes.reduce((current, box, index) => box.top <= viewport * .46 ? index : current, 0);
  if (looping && remaining < .51) chapter = 0;
  setChapter(chapter);
  drawThread(boxes);
  const morning = looping
    ? (1 - smooth(boxes[dawnIndex].top / viewport, .05, .85)) * (1 - returnToOpening)
    : Number(chapter === dawnIndex);
  css(landscape, "--daybreak", morning * .76);
  css(landscape, "--night-ink", 1 - morning * .94);
  css(landscape, "--beam-strength", .29 + morning * .46);
  css(scenes[dawnIndex], "--stair-light", .37 + morning * .34);

  const orbit = phase * tau;
  const light = (1 - Math.cos(orbit)) / 2;
  css(landscape, "--plate-x", Math.sin(orbit) * 22, "px");
  css(landscape, "--plate-y", light * 13, "px");
  css(landscape, "--plate-zoom", 1.075 + light * .061);
  css(landscape, "--exposure", 1 - light * .24);
  css(landscape, "--saturation", 1 + light * .21);

  boxes.forEach((box, i) => {
    if (i === 0) return;
    const top = box.top / viewport;
    const enter = 1 - smooth(top, .13, .83);
    const exit = smooth(box.bottom / viewport, .17, .81);
    const presence = looping ? Math.min(enter, exit, scenes[i].id === "dawn" ? 1 - returnToOpening : 1) : 1;
    css(scenes[i], "--presence", presence);
    css(scenes[i], "--rise", looping ? (1 - enter) * 32 - (1 - exit) * 28 : 0, "px");
    css(scenes[i], "--art-rise", looping ? (1 - enter) * 43 - (1 - exit) * 22 : 0, "px");
    css(scenes[i], "--art-scale", .94 + presence * .06);
    const motion = clamp((.6 - top) / 1.15);
    css(scenes[i], "--wave", looping ? .35 + Math.sin(motion * Math.PI) * .72 : .75);
    if (scenes[i].id === "dawn") contact.toggleAttribute("data-offstage", looping && presence < .28 && !contact.contains(document.activeElement));
  });

  const demoProgress = id => looping
    ? clamp((.08 - boxes[scenes.findIndex(scene => scene.id === id)].top / viewport) / .59)
    : 1;
  if (!manualBooking) showBooking(demoProgress("instibus"));
  if (!manualAging) showAging(demoProgress("triage"));
}

function schedule() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
}

function findScene(hash) {
  return document.getElementById(hash.slice(1))?.closest(".scene");
}

function goTo(scene) {
  if (scene === scenes[0] && looping && phase > .5) {
    // Travel forward through the ending to the opening. The same shot spans the wrap.
    window.scrollTo({top: origin + period + 1, behavior: "smooth"});
    return;
  }
  scene.scrollIntoView({behavior: looping ? "smooth" : "instant"});
}

async function goThroughDoors(scene) {
  if (reduce.matches || typeof doors[0].animate !== "function") {
    scene.scrollIntoView({behavior: "instant"});
    return;
  }
  if (enteringChapter) return;
  enteringChapter = true;
  wipe.setAttribute("data-active", "");
  const animateDoors = closing => Promise.all(doors.map((door, index) => {
    const outside = "translateX(" + (index === 0 ? -108 : 108) + "%)";
    const inside = "translateX(0%)";
    const frames = closing ? [outside, inside] : [inside, outside];
    return door.animate(frames.map(transform => ({transform})), {
      duration: closing ? 145 : 195,
      easing: closing ? "cubic-bezier(.3,.1,.65,1)" : "cubic-bezier(.25,.1,.36,1)",
      fill: "both"
    }).finished;
  }));
  try {
    await animateDoors(true);
    scene.scrollIntoView({behavior: "instant"});
    update();
    await animateDoors(false);
  } finally {
    wipe.removeAttribute("data-active");
    for (const door of doors) door.getAnimations().forEach(animation => animation.cancel());
    enteringChapter = false;
  }
}

function changeSky() {
  skyMode = skyControl.value;
  root.dataset.sky = skyMode;
  syncSky();
}

skyControl.addEventListener("change", changeSky);
root.dataset.sky = skyMode;

function setMode() {
  const target = findScene(location.hash) || scenes[Math.max(0, active)];
  looping = !reduce.matches;
  root.classList.toggle("looping", looping);
  before.hidden = after.hidden = !looping;
  measure();
  if (target) target.scrollIntoView({behavior: "instant"});
  if (looping && window.scrollY < origin) window.scrollTo({top: origin, behavior: "instant"});
  fitSky();
  update();
  syncSky();
}

document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.hash === "#main") {
    event.preventDefault();
    goTo(scenes[0]);
    main.focus({preventScroll: true});
    return;
  }
  const target = findScene(link.hash);
  if (!target) return;
  event.preventDefault();
  if (enteringChapter) return;
  if (location.hash !== link.hash) history.pushState(null, "", link.hash);
  if (nav.includes(link)) {
    void goThroughDoors(target);
    return;
  }
  goTo(target);
  const destination = document.getElementById(link.hash.slice(1));
  if (destination !== target) destination.focus({preventScroll: true});
});

const syncButton = document.querySelector("#flow-sync");
const flowState = document.querySelector("#flow-state");
syncButton.addEventListener("click", () => {
  const synced = flowState.textContent === "Moved to In progress";
  flowState.textContent = synced ? "Waiting for update" : "Moved to In progress";
  syncButton.textContent = synced ? "Simulate issue update" : "Reset simulation";
});

const raceButton = document.querySelector("#simulate-booking");
const bookingCaption = document.querySelector("#booking-caption");
bookingCaption.setAttribute("role", "status");
raceButton.addEventListener("click", () => {
  manualBooking = true;
  raceButton.disabled = true;
  const started = performance.now();
  function runRace(now) {
    const progress = reduce.matches ? 1 : clamp((now - started) / 1050);
    showBooking(progress);
    if (progress < 1) requestAnimationFrame(runRace);
    else {
      bookingCaption.textContent = "Passenger A took the last seat. Passenger B joined the waitlist.";
      raceButton.disabled = false;
    }
  }
  bookingCaption.textContent = "Two requests. One seat.";
  runRace(started);
});

const promptToggle = document.querySelector("#sample-prompt");
const transcript = document.querySelector("#voice-transcript");
promptToggle.addEventListener("click", () => {
  transcript.hidden = !transcript.hidden;
  promptToggle.setAttribute("aria-expanded", String(!transcript.hidden));
  transcript.closest("figure").classList.toggle("playing-prompt", !transcript.hidden);
});

const agingButton = document.querySelector("#step-aging");
agingButton.addEventListener("click", () => {
  manualAging = true;
  minutes = minutes >= 40 ? 0 : minutes + 10;
  showAging(minutes / 40);
  agingButton.textContent = minutes >= 40 ? "Reset demo" : "Step +10 min";
});

const copyStatus = document.querySelector("#copy-status");
document.querySelector("#copy-email").addEventListener("click", async () => {
  const email = document.querySelector(".contact-link").textContent;
  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = "Email copied.";
  } catch {
    copyStatus.textContent = "Copy this address manually: " + email;
  }
});

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("popstate", () => goTo(findScene(location.hash) || scenes[0]));
window.addEventListener("scroll", schedule, {passive: true});
window.addEventListener("load", () => { measure(); schedule(); });
for (const diary of document.querySelectorAll(".project-diary")) {
  diary.addEventListener("toggle", () => { measure(); schedule(); });
}
window.addEventListener("resize", () => {
  measure();
  fitSky();
  schedule();
  if (!looping) paint();
});
document.addEventListener("visibilitychange", syncSky);
reduce.addEventListener("change", setMode);
setMode();
