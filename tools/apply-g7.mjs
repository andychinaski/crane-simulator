#!/usr/bin/env node
// Additive G7 registration in existing Harness. No src edits, no git mutations.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const sections = {
  "AGENTS.md": "## G7 — UX/UI polish (additional contract)\n\nActive G7 requirements: `docs/G7_UI_POLISH.md`; implementation plan `.agent/G7_IMPLEMENTATION.md`; references `assets/reference/g7/`. Only implement on actual G6 baseline; do not rebuild G1–G6. Keep screenshot-guided appearance, status telemetry, and fixed scenario semantics. Make live visual evidence and stop at **G7 AWAITING_APPROVAL** for owner acceptance. Never self-approve or push without instruction.\n",
  "docs/SPEC.md": "## G7 — minor UI polish (approved requirements)\n\nSee `docs/G7_UI_POLISH.md`. Six requirements: (1) center welcome/mode selector over 3D-scene container under global dim, (2) G5 tour tooltip ~500 px + smart viewport-aware placement and wider Back button, (3) remove toolbar `Выбрать режим`, reset scenario with confirmation opens existing G6 mode selector, (4) preserve cargo/mode status, (5) guided G6 card gets achievement-inspired green active, green+check on completion, orange on regression, green+check on repair, (6) recenter/zoom initial camera so 0m/0m/100%/0° matches screenshot formerly at 0m/-0.7m/66%/0°. Preserve all G1–G6 functionality. Guided-card *new location* is explicitly deferred; maintain G6 placement.\n",
  "docs/ARCHITECTURE.md": "## G7 — UI-only extension boundaries\n\nUse existing Vue UI for overlays and tour/guided cards, and existing camera controller for proper baseline recalibration. Global dim remains page-wide; dialog positions are computed relative to 3D-scene layout. Tour tooltip placement reacts to resize/scroll and spotlight bounds. Guided visual state derives from G6 actual/verified state, not DOM input targets; preserve G6 route/contextual invariants. Scenario reset ≠ camera reset ≠ stop demo. Avoid additional dependencies and Three.js model changes. Detailed contract: `docs/G7_UI_POLISH.md`.\n",
  "docs/QA.md": "## G7 acceptance checks\n\n- Welcome and G6 mode modal centered over scene (page-wide dim) at desktop and small viewports.\n- Three G5 spotlights: 30–40% wider tooltip, visible controls incl. Back, adapt position without clipping/covering target.\n- Only scene reset button remains; confirm Cancel preserves state; Confirm resets scenario then opens G6 mode selector without relaunching G5; independent camera reset.\n- Existing status/cargo/demo telemetry preserved.\n- Guided card: green ACTIVE(no check), green COMPLETED(check), orange REGRESSED(no check), green restored(check); `Далее` disabled until verified, based on real actual/cargo state; manual free mode has none.\n- Camera 0/0/100%/0° reproduces reference `assets/reference/g7/08-camera-composition.png`; after camera adjustments `Сбросить вид` returns to same composition.\n- Run npm run check / npm run test:e2e and compare real screenshots at 1672×941, 1440×900, 1280×720, narrow viewport; record evidence/G7. G7 final gate requires owner acceptance.\n",
  ".agent/TASKS.md": "## G7 — minor polish (S07)\n\n- `S07` — status: `TODO` until verified. Owner-requested G7 tasks: G7-01–06 defined in `docs/G7_UI_POLISH.md`.\n- Existing G1–G6 work is immutable baseline; check actual working G6 branch before start.\n- Implementation: modals, tooltip, toolbar reset, status regression, guided achievement styling, camera calibration.\n- Verify: `docs/QA.md` G7 checks, screenshots `evidence/G7/`, regression G1–G6.\n- Checkpoint: `G7 AWAITING_APPROVAL` after implementation and checks. Do not advance or mark `DONE` before owner explicitly accepts.\n",
  ".agent/STATE.md": "## G7 — planned next iteration\n\nThe package `docs/G7_UI_POLISH.md` has been delivered but **not implemented or approved by this registration step**. Before marking work `IN_PROGRESS`, verify which local branch contains actual G6. After implementation update this block with truthful tests, evidence, current issues and checkpoint `G7 AWAITING_APPROVAL`; do not overwrite earlier G6 state.\n",
  ".agent/DECISIONS.md": "## G7 decisions — owner requirements, 2026-11-21\n\n- `G7-D1`: welcome + mode selector centered relative to scene, dim entire UI.\n- `G7-D2`: G5 tooltip approximately 500px (+30–40%), Back button ~112px; viewport-aware automatic positioning.\n- `G7-D3`: remove redundant `Выбрать режим` toolbar action; scene-reset confirm -> mode selector; camera-reset separate.\n- `G7-D4`: retain status/diagnostics block.\n- `G7-D5`: guided card achievement-inspired shape and glow; ACTIVE green(no check), COMPLETED green(check), REGRESSED orange(no check), repaired green(check). New placement **not yet specified**; preserve G6 position.\n- `G7-D6`: base camera at 0/0/100%/0° must match image previously showing 0/-0.7/66%/0°; calibrate real projection, not label substitution.\n"
};
const marker = "<!-- G7_REGISTERED_2026_11_21 -->";
const destinations = Object.keys(sections);
const missing = destinations.filter(p => !fs.existsSync(path.join(root,p)));
if (missing.length) { console.error("Missing Harness files; no files were modified:\n" + missing.join("\n")); process.exit(1); }
const results=[];
for (const rel of destinations) {
  const file=path.join(root,rel);
  const current=fs.readFileSync(file,"utf8");
  if (current.includes(marker)) { results.push(`SKIP ${rel} (already registered)`); continue; }
  const appended=current.replace(/\s*$/, "\n\n") + marker + "\n" + sections[rel].trim() + "\n";
  fs.writeFileSync(file,appended,"utf8");
  results.push(`ADD  ${rel}`);
}
console.log(results.join("\n"));
console.log("Review git diff before implementation. No application code was changed.");
