import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Visual Atlas experiments and finished metadata", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(layout, /Visual Atlas — Ideas in Motion/);
  assert.match(page, /Stationary clock/);
  assert.match(page, /Moving clock/);
  assert.match(page, /LORENTZ FACTOR/);
  assert.match(page, /data-testid="velocity-slider"/);
  assert.match(page, /stationaryCanvas/);
  assert.match(page, /movingCanvas/);
  assert.match(page, /CAMERA LOCKED TO CLOCK/);
  assert.match(page, /Time dilation rises slowly/);
  assert.match(page, /chart-marker/);
  assert.match(page, /Memory speed/);
  assert.match(page, /L1 cache/);
  assert.match(page, /Solid-state storage/);
  assert.match(page, /Hard drive/);
  assert.match(page, /SLOWEST AT TOP/);
  assert.match(page, /10_000_000/);
  assert.match(page, /HDD_TRIP_MS/);
  assert.match(page, /True relative motion/);
  assert.match(page, /live-progress/);
  assert.doesNotMatch(page, /TIME_LENSES|time-lens/);
  assert.ok(page.indexOf('label: "Hard drive"') < page.indexOf('label: "SSD"'));
  assert.ok(page.indexOf('label: "SSD"') < page.indexOf('label: "DDR5"'));
  assert.ok(page.indexOf('label: "L3 cache"') < page.indexOf('label: "L1 cache"'));
  assert.doesNotMatch(page, /movingX > movingWidth/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
