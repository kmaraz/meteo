import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const indexHtml = await readFile(new URL("../app/website/index.html", import.meta.url), "utf8");

describe("website markup", () => {
  it("keeps the forecast lookup as the first visible page section", () => {
    assert.doesNotMatch(indexHtml, /class="page-header"/);
    assert.doesNotMatch(indexHtml, /class="co-logo"/);
    assert.match(indexHtml, /id="forecast-form"/);
  });

  it("renders a startup loading state before JavaScript resolves the forecast location", () => {
    assert.match(indexHtml, /id="forecast-title"[^>]*>Loading forecast state/);
    assert.match(indexHtml, /id="forecast-meta"[^>]*>Checking URL and saved default location\./);
    assert.match(indexHtml, /id="forecast-status"[^>]*>Loading forecast state/);
  });
});
