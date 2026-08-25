import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const viewport = { width: Number(process.env.UI_WIDTH || 1440), height: Number(process.env.UI_HEIGHT || 900) };
const page = await browser.newPage({ viewport });
await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  state.completed.add(0);
  state.completed.add(1);
  loadQuest(2);
});
await page.waitForTimeout(300);

if (!(await page.locator("#gimnyeong-screen.is-active").isVisible())) throw new Error("동김녕 전용 화면이 열리지 않았습니다.");

await page.evaluate(() => renderGimnyeongDialogue("ritual_request"));
await page.locator("#gimnyeong-next").click();
if (!(await page.locator("#gimnyeong-skip-ritual").isVisible())) throw new Error("잠수굿 미니게임 건너뛰기 버튼이 보이지 않습니다.");
await page.screenshot({ path: `tests/gimnyeong-ritual-layout-${viewport.width}x${viewport.height}.png`, fullPage: true });
await page.locator('[data-gim-ritual="tourism"]').click();
const retryText = await page.locator("#gimnyeong-ritual-status").textContent();
if (!retryText.includes("개인의 바람보다")) throw new Error("잠수굿 오답 피드백이 없습니다.");
await page.locator('[data-gim-ritual="safety"]').click();
await page.locator('[data-gim-ritual="abundance"]').click();
await page.waitForTimeout(850);
if (!(await page.locator("#gimnyeong-dialogue-text").textContent()).includes("해녀들은 물질의 무사함")) throw new Error("잠수굿 완료 대화로 이어지지 않았습니다.");
await page.screenshot({ path: "tests/gimnyeong-ritual-check-1440x900.png", fullPage: true });

await page.evaluate(() => renderGimnyeongDialogue("rhythm_request"));
await page.locator("#gimnyeong-next").click();
if (!(await page.locator("#gimnyeong-rhythm-game").isVisible())) throw new Error("멜후림 박자 게임이 열리지 않았습니다.");
if (!(await page.locator("#gimnyeong-skip-rhythm").isVisible())) throw new Error("멜후림 미니게임 건너뛰기 버튼이 보이지 않습니다.");
await page.evaluate(() => {
  state.gimnyeong.rhythmRound = 2;
  const beat = document.querySelector("#gim-rhythm-beat");
  beat.style.animation = "none";
  beat.style.left = "50%";
});
await page.locator("#gim-pull-button").click();
await page.waitForTimeout(950);
if (!(await page.locator("#gimnyeong-dialogue-text").textContent()).includes("함께 당기니까")) throw new Error("멜후림 완료 대화로 이어지지 않았습니다.");

await page.evaluate(() => renderGimnyeongDialogue("language_guide"));
await page.locator("#gimnyeong-next").click();
if (!(await page.locator("#gimnyeong-answer").isVisible())) throw new Error("동김녕 제주어 입력 화면이 열리지 않았습니다.");
await page.locator("#gimnyeong-demo-fill").click();
const example = await page.locator("#gimnyeong-answer-input").inputValue();
if (example !== "다 같이 모영 멜 그물을 당겨봅서!") throw new Error(`예시 문장이 다릅니다: ${example}`);
await page.screenshot({ path: "tests/gimnyeong-answer-check-1440x900.png", fullPage: true });
await page.locator("#gimnyeong-skip-answer").click();
await page.evaluate(() => renderGimnyeongDialogue("sundeok_close"));
await page.locator("#gimnyeong-next").click();
if (!(await page.locator("#gimnyeong-reward").isVisible())) throw new Error("기억의 흔적 보상이 열리지 않았습니다.");
await page.locator("#gimnyeong-reward-continue").click();
await page.waitForTimeout(300);
if (!(await page.locator("#reward-screen.is-active").isVisible())) throw new Error("구좌 완료 화면으로 이어지지 않았습니다.");

await page.evaluate(() => {
  enterGujwa();
  loadQuest(2);
});
await page.waitForTimeout(300);
const replayText = await page.locator("#gimnyeong-dialogue-text").textContent();
const rewardHiddenOnReplay = await page.locator("#gimnyeong-reward").isHidden();
if (!replayText.includes("여기가 동김녕리 해안이구나")) throw new Error("완료 지점 재진입이 첫 장면에서 시작되지 않았습니다.");
if (!rewardHiddenOnReplay) throw new Error("완료 지점 재진입 후 기억 보상 레이어가 남아 있습니다.");

await page.evaluate(() => renderGimnyeongDialogue("sundeok_welcome", { push: false }));
await page.waitForTimeout(650);
const stageBox = await page.locator(".gimnyeong-stage").boundingBox();
const npcBox = await page.locator("#gimnyeong-npc").boundingBox();
console.log(JSON.stringify({ stageBox, npcBox }));
if (!stageBox || !npcBox || npcBox.y < stageBox.y - 1 || npcBox.y + npcBox.height > stageBox.y + stageBox.height + 1) throw new Error("순덕 삼춘이 무대 영역에서 잘립니다.");
await page.screenshot({ path: `tests/gimnyeong-npc-layout-${viewport.width}x${viewport.height}.png`, fullPage: true });

await page.evaluate(() => renderGimnyeongDialogue("bird_arrival", { push: false }));
await page.waitForTimeout(650);
const guideBox = await page.locator("#gimnyeong-guide").boundingBox();
if (!guideBox || guideBox.y < stageBox.y || guideBox.x + guideBox.width > stageBox.x + stageBox.width) throw new Error("바람새가 무대 영역을 벗어났습니다.");
await page.screenshot({ path: `tests/gimnyeong-replay-layout-${viewport.width}x${viewport.height}.png`, fullPage: true });

console.log(JSON.stringify({ screen: true, ritual: true, rhythm: true, answer: true, reward: true, replayReset: true, characterLayout: true }));
await browser.close();
