import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8000/", { waitUntil: "domcontentloaded", timeout: 15000 });
page.setDefaultTimeout(5000);

await page.evaluate(() => {
  state.completed.add(0);
  loadQuest(1);
  renderHadoDialogue("first_question", { recordHistory: false });
});
await page.waitForTimeout(250);
const detailLabel = await page.locator("#hado-choices button").textContent();
const nextVisibleAtChoice = await page.locator("#hado-next").isVisible();
const navColumns = await page.locator("#hado-dialogue .dialogue-nav").evaluate((el) => getComputedStyle(el).gridTemplateColumns);
await page.screenshot({ path: "tests/hado-choice-layout-1440x900.png", fullPage: true });

await page.evaluate(() => {
  renderHadoDialogue("elder_request", { recordHistory: false });
});
await page.locator("#hado-next").click();
const gameVisible = await page.locator("#hado-memory-game").isVisible();
await page.screenshot({ path: "tests/hado-observation-check-1440x900.png", fullPage: true });

for (const id of ["flower", "ground", "name"]) {
  await page.locator(`[data-hado-observation='${id}']`).click();
  await page.locator("#hado-next").click();
  await page.locator("#hado-next").click();
}
const visitorAlert = await page.locator("#hado-dialogue-text").textContent();
const foundRecords = await page.locator("[data-hado-record].is-found").count();

await page.evaluate(() => renderHadoDialogue("bird_language_guide", { recordHistory: false }));
await page.locator("#hado-next").click();
const answerVisible = await page.locator("#hado-answer").isVisible();
await page.locator("#hado-demo-fill").click();
const exampleAnswer = await page.locator("#hado-answer-input").inputValue();
await page.screenshot({ path: "tests/hado-answer-check-1440x900.png", fullPage: true });
await page.locator("#hado-skip-answer").click();
const visitorReply = await page.locator("#hado-dialogue-text").textContent();

console.log(JSON.stringify({
  detailLabel,
  nextVisibleAtChoice,
  navColumns,
  gameVisible,
  foundRecords,
  visitorAlert,
  answerVisible,
  exampleAnswer,
  visitorReply,
}));
await browser.close();
