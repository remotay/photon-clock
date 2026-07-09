import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the photon-clock experiment and finished metadata", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(layout, /Light Clock — See Time Dilation/);
  assert.match(page, /Stationary clock/);
  assert.match(page, /Moving clock/);
  assert.match(page, /LORENTZ FACTOR/);
  assert.match(page, /data-testid="velocity-slider"/);
  assert.match(page, /stationaryCanvas/);
  assert.match(page, /movingCanvas/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
