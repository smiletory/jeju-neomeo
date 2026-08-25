import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });
page.setDefaultTimeout(5000);

await page.evaluate(() => {
  loadQuest(0);
  showSongdangOffering();
});
await page.locator("#songdang-skip-minigame").click();
await page.waitForTimeout(250);
if (!(await page.locator("#songdang-dialogue").isVisible())) throw new Error("송당리 미니게임 건너뛰기가 다음 대화로 이어지지 않았습니다.");

await page.evaluate(() => {
  state.completed.add(0);
  loadQuest(1);
  showHadoObservationGame();
});
await page.locator("#hado-skip-minigame").click();
await page.waitForTimeout(250);
if (!(await page.locator("#hado-dialogue-text").textContent()).includes("문주란을 꺾으려고")) throw new Error("하도리 미니게임 건너뛰기가 다음 대화로 이어지지 않았습니다.");

await page.evaluate(() => {
  state.completed.add(1);
  loadQuest(2);
  showGimnyeongRitual();
});
await page.locator("#gimnyeong-skip-ritual").click();
await page.waitForTimeout(250);
if (!(await page.locator("#gimnyeong-dialogue-text").textContent()).includes("물질의 무사함")) throw new Error("잠수굿 미니게임 건너뛰기가 다음 대화로 이어지지 않았습니다.");

await page.evaluate(() => showGimnyeongRhythm());
await page.locator("#gimnyeong-skip-rhythm").click();
await page.waitForTimeout(250);
if (!(await page.locator("#gimnyeong-dialogue-text").textContent()).includes("함께 당기니까")) throw new Error("멜후림 미니게임 건너뛰기가 다음 대화로 이어지지 않았습니다.");

console.log(JSON.stringify({ songdang: true, hado: true, gimnyeongRitual: true, gimnyeongRhythm: true }));
await browser.close();
