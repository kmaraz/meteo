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
});
