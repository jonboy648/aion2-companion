const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const webRequire = createRequire(path.resolve(__dirname, "../../web/package.json"));
const { JSDOM } = webRequire("jsdom");

function preview() {
  const html = fs.readFileSync(path.join(__dirname, "native-macro.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://preview.invalid/" });
  const api = dom.window.nativePreview;
  assert.ok(api, "The corrected preview must expose its linked column/entry model");
  return { dom, api, doc: dom.window.document };
}

test("four-row placement grid is distinct from the twelve-key hotbar", () => {
  const { dom, doc } = preview();
  assert.equal(doc.querySelectorAll("#context-grid [data-cell]").length, 48);
  assert.equal(doc.querySelectorAll("#hotbar [data-hotbar-slot]").length, 12);
  assert.deepEqual([...doc.querySelectorAll("#context-grid [data-row-label]")].map(e => e.textContent), ["3", "2", "1", "0"]);
  dom.window.close();
});

test("three-entry screenshot preset retains its keys, names, ranks and independent delays", () => {
  const { dom, api, doc } = preview();
  const entries = api.getState().steps;
  assert.deepEqual(Array.from(entries, s => s.slotId), [2, 21, 3]);
  assert.deepEqual(Array.from(entries, s => s.delayMs), [10, 10, 10]);
  assert.deepEqual([...doc.querySelectorAll(".macro-name")].map(e => e.textContent), ["Element Enhancement", "Winter's Shackles", "Blaze"]);
  assert.deepEqual([...doc.querySelectorAll(".macro-entry .rank")].map(e => e.textContent), ["Lv. 13", "Lv. 12", "Lv. 14"]);
  assert.equal(api.getState().activationBinding, "");
  dom.window.close();
});

test("selecting a four-skill column adds one macro entry, not four skill entries", () => {
  const { dom, api } = preview();
  const before = api.getState().steps.length;
  assert.equal(api.getState().columns.find(c => c.id === 21).rows.filter(Boolean).length, 4);
  api.addStep(21);
  const after = api.getState().steps;
  assert.equal(after.length, before + 1);
  assert.equal(after.at(-1).slotId, 21);
  assert.equal(Object.hasOwn(after.at(-1), "skillId"), false);
  dom.window.close();
});

test("availability changes the hotbar's selected skill without changing the macro target", () => {
  const { dom, api, doc } = preview();
  const entryId = api.getState().steps[0].id;
  assert.equal(api.resolveColumn(2).skillId, "element-enhancement");
  api.setAvailability(2, 0, false);
  assert.equal(api.resolveColumn(2).skillId, "frost-burst");
  assert.equal(api.getState().steps[0].slotId, 2);
  assert.equal(api.getState().steps[0].id, entryId);
  assert.equal(doc.querySelector("[data-hotbar-slot='2']").dataset.skill, "frost-burst");
  assert.equal(doc.querySelector(".macro-name").textContent, "Element Enhancement");
  dom.window.close();
});

test("an unavailable column stays configured but supplies no eligible hotbar skill", () => {
  const { dom, api } = preview();
  for (let row = 0; row < 4; row++) api.setAvailability(21, row, false);
  assert.equal(api.resolveColumn(21), null);
  assert.equal(api.getState().steps[1].slotId, 21);
  dom.window.close();
});

test("the Add Macro picker offers bottom-row columns rather than upper context cells", () => {
  const { dom, doc } = preview();
  doc.getElementById("add-macro").click();
  const options = [...doc.querySelectorAll("#macro-picker [data-picker-slot]")];
  assert.equal(options.length, 12);
  assert.equal(options.find(b => b.dataset.pickerSlot === "5").disabled, true);
  options.find(b => b.dataset.pickerSlot === "2").click();
  assert.equal(doc.querySelectorAll(".macro-entry").length, 4);
  dom.window.close();
});

test("individual delays clamp independently to the documented range", () => {
  const { dom, api } = preview();
  const ids = api.getState().steps.map(s => s.id);
  api.setDelay(ids[0], 11);
  api.setDelay(ids[1], 10000);
  api.setDelay(ids[2], -1);
  assert.deepEqual(Array.from(api.getState().steps, s => s.delayMs), [11, 9900, 10]);
  dom.window.close();
});

test("upper rows depend on a populated bottom row", () => {
  const { dom, api } = preview();
  assert.equal(api.setCell(5, 1, "blaze").ok, false);
  assert.equal(api.setCell(2, 0, null).ok, false);
  assert.equal(api.setCell(5, 0, "blaze").ok, true);
  assert.equal(api.setCell(5, 1, "ice-chain").ok, true);
  dom.window.close();
});

test("both screenshot recipes keep their own edits while sharing one activation binding", () => {
  const { dom, api } = preview();
  api.setBinding(" F8 ");
  api.setDelay(api.getState().steps[0].id, 22);
  api.selectRecipe("four");
  assert.deepEqual(Array.from(api.getState().steps, s => s.slotId), [24, 3, 21, 2]);
  assert.deepEqual(Array.from(api.getState().steps, s => s.delayMs), [11, 11, 11, 10]);
  assert.equal(api.getState().activationBinding, "F8");
  api.selectRecipe("three");
  assert.equal(api.getState().steps[0].delayMs, 22);
  dom.window.close();
});

test("moving and removing an entry preserve its linked column and other entries", () => {
  const { dom, api } = preview();
  const first = api.getState().steps[0].id;
  api.moveStep(first, 1);
  assert.deepEqual(Array.from(api.getState().steps, s => s.slotId), [21, 2, 3]);
  api.removeStep(first);
  assert.deepEqual(Array.from(api.getState().steps, s => s.slotId), [21, 3]);
  api.selectRecipe("empty");
  assert.equal(api.getState().steps.length, 0);
  dom.window.close();
});

test("keyboard focus stays on the hotbar key after selecting its linked column", () => {
  const { dom, doc } = preview();
  const key = doc.querySelector("[data-hotbar-slot='21']");
  key.focus();
  key.click();
  assert.equal(doc.activeElement.dataset.hotbarSlot, "21");
  dom.window.close();
});

test("keyboard focus stays on the availability checkbox after its state changes", () => {
  const { dom, doc } = preview();
  const checkbox = doc.querySelector("[aria-label='Element Enhancement ready in row 0']");
  checkbox.focus();
  checkbox.click();
  assert.equal(doc.activeElement.getAttribute("aria-label"), "Element Enhancement ready in row 0");
  assert.equal(doc.activeElement.checked, false);
  dom.window.close();
});
