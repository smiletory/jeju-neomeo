import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const viewport = {
  width: Number(process.env.UI_WIDTH || 1440),
  height: Number(process.env.UI_HEIGHT || 900),
};
const screenshotTag = `${viewport.width}x${viewport.height}`;
const page = await browser.newPage({ viewport });

await page.goto("http://127.0.0.1:8000/", { waitUntil: "domcontentloaded", timeout: 15000 });
page.setDefaultTimeout(5000);
await page.waitForTimeout(700);
await page.screenshot({ path: `tests/island-map-check-${screenshotTag}.png`, fullPage: true });

const islandVisible = await page.locator("#island-screen.is-active").isVisible();
const introPresent = await page.locator("#intro-modal").count();
const currentRegion = await page.locator("#island-guide-line").textContent();
const mapBox = await page.locator(".jeju-whole-map").boundingBox();
const mapRegionCount = await page.locator(".map-region").count();
const chujaVisible = await page.locator("[data-region='chuja']").isVisible();
console.log(JSON.stringify({ stage: "island", islandVisible, introPresent, currentRegion, mapBox, mapRegionCount, chujaVisible }));

const hallimZone = page.locator("[data-region='hallim'] .map-zone");
const fillBeforeHover = await hallimZone.evaluate((item) => getComputedStyle(item).fill);
await hallimZone.hover();
await page.waitForTimeout(280);
const fillAfterHover = await hallimZone.evaluate((item) => getComputedStyle(item).fill);
await page.screenshot({ path: `tests/island-map-hover-${screenshotTag}.png`, fullPage: true });
await hallimZone.click({ force: true });
await page.waitForTimeout(80);
const lockedToast = await page.locator("#toast").textContent();
console.log(JSON.stringify({ stage: "hover-lock", fillBeforeHover, fillAfterHover, lockedToast }));

const gujwaZone = page.locator("[data-region='gujwa'] .map-zone");
const gujwaFillAtRest = await gujwaZone.evaluate((item) => getComputedStyle(item).fill);
await gujwaZone.hover();
await page.waitForTimeout(280);
const gujwaFillOnHover = await gujwaZone.evaluate((item) => getComputedStyle(item).fill);
console.log(JSON.stringify({ stage: "hover-open", gujwaFillAtRest, gujwaFillOnHover }));

await gujwaZone.click();
await page.waitForTimeout(850);
await page.screenshot({ path: `tests/gujwa-map-check-${screenshotTag}.png`, fullPage: true });

const gujwaVisible = await page.locator("#gujwa-screen.is-active").isVisible();
const nodes = await page.locator(".map-node").evaluateAll((items) => items.map((item) => ({
  label: item.textContent.trim().replace(/\s+/g, " "),
  left: getComputedStyle(item).left,
  top: getComputedStyle(item).top,
})));
console.log(JSON.stringify({ stage: "gujwa", gujwaVisible, nodes }));

await page.locator(".map-node[data-quest-index='0']").click();
await page.waitForTimeout(450);
await page.screenshot({ path: `tests/songdang-scene-check-${screenshotTag}.png`, fullPage: true });

const songdangVisible = await page.locator("#songdang-screen.is-active").isVisible();
const songdangBackground = await page.locator(".songdang-backdrop").evaluate((item) => getComputedStyle(item).backgroundImage);
const dialogueVisible = await page.locator("#songdang-dialogue").isVisible();
const initialSpeaker = await page.locator("#songdang-speaker").textContent();
console.log(JSON.stringify({
  stage: "songdang",
  songdangVisible,
  songdangBackground,
  dialogueVisible,
  initialSpeaker,
}));

await page.keyboard.press("Space");
await page.waitForTimeout(180);
await page.screenshot({ path: `tests/songdang-choice-layout-${screenshotTag}.png`, fullPage: true });
const choicesVisible = await page.locator("#songdang-choices").isVisible();
const choicesBox = await page.locator("#songdang-choices").boundingBox();
const dialogueNavBox = await page.locator("#songdang-dialogue .dialogue-nav").boundingBox();
const dialogueTextBox = await page.locator("#songdang-dialogue-text").boundingBox();
console.log(JSON.stringify({ stage: "songdang-choice-layout", choicesVisible, choicesBox, dialogueNavBox, dialogueTextBox }));

await page.getByRole("button", { name: "상세정보" }).click();
await page.waitForTimeout(280);
await page.screenshot({ path: `tests/songdang-dialogue-long-${screenshotTag}.png`, fullPage: true });
const dialogueBox = await page.locator("#songdang-dialogue").boundingBox();
const avatarSource = await page.locator("#songdang-speaker-avatar-image").getAttribute("src");
const dialogueLines = await page.locator("#songdang-dialogue-text").evaluate((item) => {
  const style = getComputedStyle(item);
  return Math.round(item.getBoundingClientRect().height / parseFloat(style.lineHeight));
});
console.log(JSON.stringify({ stage: "songdang-long-dialogue", dialogueBox, avatarSource, dialogueLines }));

await page.keyboard.press("ArrowLeft");
const backTargetSpeaker = await page.locator("#songdang-speaker").textContent();
const choicesAfterBack = await page.locator("#songdang-choices").isVisible();
console.log(JSON.stringify({ stage: "songdang-back", backTargetSpeaker, choicesAfterBack }));

await page.getByRole("button", { name: "상세정보" }).click();
for (let detailStep = 0; detailStep < 6; detailStep += 1) {
  await page.locator("#songdang-next").click();
}
const detailReturnsToChoices = await page.locator("#songdang-choices").isVisible();
const textAfterDetails = await page.locator("#songdang-dialogue-text").textContent();
await page.keyboard.press("ArrowRight");
const textAfterExplicitProceed = await page.locator("#songdang-dialogue-text").textContent();
console.log(JSON.stringify({
  stage: "songdang-detail-return",
  detailReturnsToChoices,
  textAfterDetails,
  textAfterExplicitProceed,
}));

await page.evaluate(() => renderSongdangDialogue("welcome", { recordHistory: false }));
await page.waitForTimeout(520);
const dialectText = await page.locator("#songdang-dialogue-text").textContent();
const dialectTextBox = await page.locator("#songdang-dialogue-text").boundingBox();
const translationToggleVisible = await page.locator("#songdang-translation-toggle").isVisible();
await page.locator("#songdang-translation-toggle").click();
const standardText = await page.locator("#songdang-dialogue-text").textContent();
const standardTextBox = await page.locator("#songdang-dialogue-text").boundingBox();
const elderAvatarSource = await page.locator("#songdang-speaker-avatar-image").getAttribute("src");
await page.screenshot({ path: `tests/songdang-translation-toggle-${screenshotTag}.png`, fullPage: true });
console.log(JSON.stringify({
  stage: "songdang-translation",
  translationToggleVisible,
  dialectText,
  dialectTextBox,
  standardText,
  standardTextBox,
  elderAvatarSource,
}));

await page.locator("#songdang-skip-point").click();
await page.waitForTimeout(180);
const secondPointUnlocked = await page.locator(".map-node[data-quest-index='1']").isEnabled();
const traceCountAfterFirstSkip = await page.locator("#trace-count").textContent();
console.log(JSON.stringify({ stage: "skip-songdang", secondPointUnlocked, traceCountAfterFirstSkip }));

await page.locator(".map-node[data-quest-index='1']").click();
await page.waitForTimeout(180);
const hadoVisible = await page.locator("#hado-screen.is-active").isVisible();
const hadoBackground = await page.locator(".hado-backdrop").evaluate((item) => getComputedStyle(item).backgroundImage);
const hadoOpeningText = await page.locator("#hado-dialogue-text").textContent();
await page.screenshot({ path: `tests/hado-scene-check-${screenshotTag}.png`, fullPage: true });
console.log(JSON.stringify({ stage: "hado", hadoVisible, hadoBackground, hadoOpeningText }));
await page.locator("#hado-screen .point-skip-button").click();
await page.waitForTimeout(180);
const thirdPointUnlocked = await page.locator(".map-node[data-quest-index='2']").isEnabled();
const traceCountAfterSecondSkip = await page.locator("#trace-count").textContent();
console.log(JSON.stringify({ stage: "skip-hado", thirdPointUnlocked, traceCountAfterSecondSkip }));

await page.locator(".map-node[data-quest-index='2']").click();
await page.waitForTimeout(180);
const gimnyeongVisible = await page.locator("#gimnyeong-screen.is-active").isVisible();
const gimnyeongOpeningText = await page.locator("#gimnyeong-dialogue-text").textContent();
await page.screenshot({ path: `tests/gimnyeong-scene-check-${screenshotTag}.png`, fullPage: true });
console.log(JSON.stringify({ stage: "gimnyeong", gimnyeongVisible, gimnyeongOpeningText }));
await page.locator("#gimnyeong-screen .point-skip-button").click();
await page.waitForTimeout(1100);
const rewardVisibleAfterThirdSkip = await page.locator("#reward-screen.is-active").isVisible();
console.log(JSON.stringify({ stage: "skip-gimnyeong", rewardVisibleAfterThirdSkip }));

await page.getByRole("button", { name: "다음 기억의 길 확인하기" }).click();
await page.waitForTimeout(180);
const jocheonZone = page.locator("[data-region='jocheon'] .map-zone");
const jocheonFillAtRest = await jocheonZone.evaluate((item) => getComputedStyle(item).fill);
await jocheonZone.hover();
await page.waitForTimeout(280);
const jocheonFillOnHover = await jocheonZone.evaluate((item) => getComputedStyle(item).fill);
console.log(JSON.stringify({ stage: "hover-next-region", jocheonFillAtRest, jocheonFillOnHover }));

await page.locator("[data-region='gujwa']").click();
await page.waitForTimeout(1450);
const revisitKeepsCompletedMap = await page.locator("#gujwa-screen.is-active").isVisible();
const rewardRepeatedOnRevisit = await page.locator("#reward-screen.is-active").isVisible();
const revisitTraceCount = await page.locator("#trace-count").textContent();
const resetButtonVisible = await page.locator("#gujwa-reset").isVisible();
console.log(JSON.stringify({ stage: "revisit-gujwa", revisitKeepsCompletedMap, rewardRepeatedOnRevisit, revisitTraceCount, resetButtonVisible }));

await page.locator("#gujwa-reset").click();
await page.waitForTimeout(180);
const traceCountAfterReset = await page.locator("#trace-count").textContent();
const firstPointAvailableAfterReset = await page.locator(".map-node[data-quest-index='0']").isEnabled();
const secondPointLockedAfterReset = await page.locator(".map-node[data-quest-index='1']").isDisabled();
const resetButtonHiddenAfterReset = await page.locator("#gujwa-reset").isHidden();
const globalPiecePreservedAfterReset = await page.locator("#global-piece-count").textContent();
console.log(JSON.stringify({ stage: "reset-gujwa", traceCountAfterReset, firstPointAvailableAfterReset, secondPointLockedAfterReset, resetButtonHiddenAfterReset, globalPiecePreservedAfterReset }));

await browser.close();
