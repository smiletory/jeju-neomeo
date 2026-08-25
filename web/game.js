const quests = [
  {
    id: "gujwa_songdang_01",
    questionId: "community_reason",
    location: "송당리 본향당",
    trace: "함께 지켜온 숲의 약속",
    title: "오래된 나무가 기억하는 것",
    story: "송당 사람들이 함께 지켜온 마음을 되새기며 신목에 지전물색을 걸고 숲의 기억을 깨워 주세요.",
    role: "송당 본향당 당지기",
    name: "고인택 어르신",
    symbol: "木",
    line: "“이 당에 사람들이 어떵 모여신지, 느가 알아봐 주쿠과?”",
    question: "송당 사람들이 오랜 시간 본향당에 함께 모인 까닭을 제주어로 설명하세요.",
    answer: "지전물색 정성껏 걸었수다! 숲의 기억 깨어나게 굽어살펴 줍서!",
    sceneAsset: "/assets/scene-songdang-v2.png",
    backgroundPosition: "center",
    npcAsset: "/assets/npc-songdang-gointek.png",
    success: "함께 지켜온 숲의 약속이 깨어났습니다."
  },
  {
    id: "gujwa_hado_01",
    questionId: "practice_protection_request",
    location: "하도리 토끼섬",
    trace: "바람과 모래가 지킨 하얀 꽃",
    title: "바람과 모래가 지킨 하얀 꽃",
    story: "바람 망원경으로 문주란꽃과 모래·현무암, 난들여의 이름을 관찰하고 문주란을 지켜야 한다는 기억을 되살려 주세요.",
    role: "하도리 자연유산 지킴이",
    name: "문정해 삼춘",
    symbol: "花",
    line: "“꽃을 꺾지 않고 지켜보는 것도 섬을 아끼는 방법이우다.”",
    question: "문주란을 꺾으려는 방문객에게 꽃을 꺾지 말고 소중히 지켜달라는 뜻을 제주어로 전하세요.",
    answer: "토끼섬 문주란은 소중허우다. 꽃을 꺾지 맙서. 잘 지켜줍서.",
    sceneAsset: "/assets/scene-hado-v1.png",
    backgroundPosition: "center",
    npcAsset: "/assets/npc-hado.png",
    success: "바람과 모래가 지킨 하얀 꽃의 기억이 돌아왔습니다."
  },
  {
    id: "gujwa_gimnyeong_01",
    questionId: "practice_group_pull",
    location: "동김녕리 해안",
    trace: "함께한 바다의 숨",
    title: "함께 빌고, 함께 당긴 바다",
    story: "잠수굿에 담긴 해녀 공동체의 기원과 멜후림소리에 담긴 공동 노동의 박자를 되살려 주세요.",
    role: "동김녕 해녀",
    name: "순덕 삼춘",
    symbol: "海",
    line: "“이 바당은 혼자 힘으로 살아온 바당이 아니우다.”",
    question: "마을 사람들에게 함께 모여 멜 그물을 당기자고 제주어로 외쳐보세요.",
    answer: "다 같이 모영 멜 그물을 당겨봅서!",
    sceneAsset: "/assets/scene-gimnyeong-v2.png",
    backgroundPosition: "center",
    npcAsset: "/assets/npc-gimnyeong.png",
    success: "함께한 숨이 바당 위로 떠올랐습니다."
  }
];

const state = {
  currentQuest: 0,
  completed: new Set(),
  attempts: [1, 1, 1],
  memoryPieces: 0,
  songdang: {
    node: "arrival",
    history: [],
    practice: null,
    practiceAttempts: {},
    offeringIndex: 0,
    lastEvaluation: null
  },
  hado: {
    node: "arrival",
    history: [],
    observations: new Set(),
    attempt: 1,
    lastEvaluation: null
  },
  gimnyeong: {
    node: "arrival",
    history: [],
    ritualAnswers: new Set(),
    rhythmRound: 0,
    rhythmMisses: 0,
    attempt: 1,
    lastEvaluation: null
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const agentClient = window.JejuAgentAPI.createClient();

function renderJejuAdministrativeMap() {
  const mapRoot = $("#jeju-admin-map");
  const mapData = window.JEJU_MAP_DATA;
  if (!mapRoot || !mapData) return;

  const regionOrder = { gujwa: "01" };
  const baseMarkup = mapData.basePaths.map((path) => `<path class="jeju-base-district" d="${path}" fill-rule="evenodd"></path>`).join("");
  const insetMarkup = (mapData.insets || []).map((inset) => `<g class="map-inset" aria-hidden="true">
    <rect x="${inset.x}" y="${inset.y}" width="${inset.width}" height="${inset.height}" rx="8"></rect>
    <text x="${inset.x + inset.width / 2}" y="${inset.y + 17}">${inset.title}</text>
  </g>`).join("");
  const renderedRegions = mapData.regions.map((region) => {
    const [labelX, labelY] = region.label;
    const inset = (mapData.insets || []).find((item) => item.region === region.id);
    const insetHitArea = inset
      ? `<rect class="map-inset-hit" x="${inset.x}" y="${inset.y}" width="${inset.width}" height="${inset.height}" rx="8"></rect>`
      : "";
    const labelWidth = region.kind === "dong-group" ? 172 : 108;
    const labelLeft = -labelWidth / 2;
    const iconX = labelLeft + 16;
    const lockMarkup = region.locked
      ? `<g class="lock-icon" transform="translate(${iconX},-8)" aria-hidden="true"><rect class="lock-body" x="-6" y="0" width="12" height="9" rx="1.5"></rect><path class="lock-body" d="M-4 0v-4a4 4 0 0 1 8 0v4"></path></g>`
      : `<text class="region-order" x="${iconX}" y="-4">${regionOrder[region.id]}</text>`;
    const stateLabel = region.locked
      ? `${region.memberCount ? `${region.memberCount}개 동 · ` : ""}잠금`
      : "탐험 가능";
    const nextRegion = region.id === "jocheon" ? " data-next-region" : "";
    return {
      zone: `<g class="map-region region-${region.kind} ${region.inset ? "is-inset " : ""}${region.locked ? "is-locked" : "is-open"}" data-region="${region.id}" data-region-name="${region.name}"${nextRegion} role="button" tabindex="0" aria-label="${region.name} · ${stateLabel}" aria-disabled="${region.locked}">
        ${insetHitArea}
        <path class="map-zone" d="${region.path}" fill-rule="evenodd"></path>
      </g>`,
      label: `<g class="region-label region-${region.kind} ${region.locked ? "is-locked" : "is-open"}" data-region-label="${region.id}" transform="translate(${labelX} ${labelY})">
        <rect class="region-label-bg" x="${labelLeft}" y="-25" width="${labelWidth}" height="50" rx="5"></rect>
        ${lockMarkup}
        <text class="region-name" x="8" y="-5">${region.name}</text>
        <text class="region-state" x="8" y="15">${stateLabel}</text>
      </g>`,
    };
  });
  const regionMarkup = renderedRegions.map((region) => region.zone).join("");
  const labelMarkup = renderedRegions.map((region) => region.label).join("");

  mapRoot.innerHTML = `<svg viewBox="${mapData.viewBox}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="${mapData.source}">
    <defs>
      <pattern id="jeju-land-texture" patternUnits="userSpaceOnUse" width="1200" height="700">
        <image href="/assets/jeju-minhwa-terrain-v2.png" x="0" y="0" width="1200" height="700" preserveAspectRatio="xMidYMid slice"></image>
      </pattern>
      <filter id="island-paper" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="3" seed="8" result="noise"></feTurbulence>
        <feBlend in="SourceGraphic" in2="noise" mode="soft-light"></feBlend>
      </filter>
    </defs>
    <g class="jeju-base-layer">${baseMarkup}</g>
    <g class="jeju-inset-layer">${insetMarkup}</g>
    <g class="jeju-region-layer">${regionMarkup}</g>
    <g class="jeju-label-layer">${labelMarkup}</g>
  </svg>`;

  mapRoot.querySelectorAll(".map-region").forEach((regionNode) => {
    const label = mapRoot.querySelector(`[data-region-label="${regionNode.dataset.region}"]`);
    const setHighlighted = (highlighted) => label?.classList.toggle("is-highlighted", highlighted);
    regionNode.addEventListener("mouseenter", () => setHighlighted(true));
    regionNode.addEventListener("mouseleave", () => setHighlighted(false));
    regionNode.addEventListener("focus", () => setHighlighted(true));
    regionNode.addEventListener("blur", () => setHighlighted(false));
  });
}

renderJejuAdministrativeMap();

function showScreen(id) {
  window.scrollTo(0, 0);
  $$(".screen").forEach((screen) => screen.classList.toggle("is-active", screen.id === id));
}

function enterGujwa() {
  $("#island-screen").classList.remove("is-zooming");
  showScreen("gujwa-screen");
  refreshMap();
}

function updateVisualCounter(selector, count) {
  $(`${selector}`)?.querySelectorAll(".counter-slot").forEach((slot, index) => {
    slot.classList.toggle("is-filled", index < count);
  });
}

function zoomToGujwa() {
  $("#island-screen").classList.add("is-zooming");
  setTimeout(enterGujwa, 520);
}

function refreshMap() {
  $("#trace-count").textContent = `${state.completed.size} / 3`;
  updateVisualCounter("#trace-visual", state.completed.size);
  $("#route-fill").style.width = `${Math.min(state.completed.size, 2) * 219}px`;
  $$(".map-node").forEach((node, index) => {
    const done = state.completed.has(index);
    const available = index === state.completed.size;
    node.classList.toggle("is-done", done);
    node.classList.toggle("is-available", available);
    node.classList.toggle("is-locked", !done && !available);
    node.disabled = !done && !available;
  });
  $$(".route-step").forEach((step, index) => {
    step.classList.toggle("is-done", state.completed.has(index));
    step.classList.toggle("is-current", index === state.completed.size);
    step.classList.toggle("is-locked", index > state.completed.size);
  });
  const lines = [
    "맨 먼저 송당의 오래된 나무가 우리를 부르고 있어. 빛나는 표식을 눌러봐.",
    "함께 지켜온 숲의 약속을 찾았어. 이번엔 하도 바당의 하얀 문주란을 만나보자.",
    "두 번째 흔적까지 모였어. 동김녕 바당의 여러 목소리가 마지막 이야기를 기다려.",
    "구좌의 세 기억이 모두 모였어. 이제 하나의 조각으로 이어 보자."
  ];
  $("#map-guide-line").textContent = lines[state.completed.size];
  $("#gujwa-reset").hidden = false;
}

const songdangNodes = {
  arrival: {
    speakerRole: "설문대할망의 기억을 좇는 여행자",
    speaker: "플레이어",
    text: "분명 바람이 부는데, 저 나무 주변만 시간이 멈춘 것 같아.",
    location: "본향당 숲 입구",
    focus: "wide",
    progress: 3,
    next: "bird_arrival"
  },
  bird_arrival: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "설문대할망의 기억이 이 숲에 붙잡혀 있어. 모습은 남았는데, 이곳 사람들이 간직했던 마음이 흐려졌어.",
    location: "본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 9,
    next: "briefing"
  },
  briefing: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "여기는 구좌읍 송당리 본향당이야. 백주또를 제주 1만 8천 신들의 어머니로 전하는 송당 신앙의 중심이지.",
    location: "본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 15,
    choices: [
      { label: "숲 안으로 들어간다", next: "approach" },
      { label: "송당 이야기를 더 듣는다", next: "detail" }
    ]
  },
  detail: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "송당은 많은 제주 마을 신들의 뿌리가 이어진 곳으로 전해져. 사람들은 당숲과 신목을 소중히 여기며 마을의 안녕을 빌어왔어.",
    location: "본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 18,
    next: "approach"
  },
  approach: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "저기 나무 곁에 기억을 지키는 삼춘이 계셔. 제주에서는 이웃이나 어르신을 남녀 구분 없이 친근하게 ‘삼춘’이라 부르기도 해.",
    location: "신목으로 가는 길",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 23,
    next: "greeting"
  },
  greeting: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "먼저 인사를 건네볼까? 어려운 제주말은 내가 옆에서 도와줄게.",
    location: "신목 앞",
    focus: "elder",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 27,
    choices: [
      { label: "삼춘, 안녕하우꽈?", next: "welcome" },
      { label: "삼춘, 편안허우꽈?", next: "welcome" }
    ]
  },
  welcome: {
    speakerRole: "송당의 기억지기 · 가상 복합 인물",
    speaker: "고씨 할망",
    text: "혼저옵서. 제주말이 살갑구나. 설문대할망의 기억을 찾으러 이 깊은 당숲까지 왔는가?",
    translation: "어서 오세요. 제주말이 다정하군요. 설문대할망의 기억을 찾으러 이 깊은 당숲까지 왔나요?",
    location: "신목 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 34,
    next: "memory_problem"
  },
  memory_problem: {
    speakerRole: "송당의 기억지기 · 가상 복합 인물",
    speaker: "고씨 할망",
    text: "저 신목 아래 희미한 빛이 자네가 찾는 기억일세. 하지만 송당 사람들이 왜 이곳에 모였는지 모른다면, 빛은 다시 잠들고 말 거야.",
    location: "신목 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 41,
    next: "clues_intro"
  },
  clues_intro: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "숲에는 오랜 마음이 흔적으로 남아 있어. 세 흔적을 살펴보고 사람들이 무엇을 함께 바랐는지 찾아보자.",
    location: "기억이 머문 당숲",
    focus: "clues",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 47,
    next: "__clues"
  },
  clue_summary: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "신목, 사람들의 소원, 해마다 이어진 발자국. 세 흔적은 한 사람의 바람이 아니라 마을이 함께 지켜온 약속을 가리키고 있어.",
    location: "기억이 머문 당숲",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 70,
    next: "question_intro"
  },
  question_intro: {
    speakerRole: "송당의 기억지기 · 가상 복합 인물",
    speaker: "고씨 할망",
    text: "이제 자네가 알아낸 마음을 들려주게. 송당 사람들이 오랜 세월 본향당에 함께 모인 까닭을, 알고 있는 제주말과 함께 말해보게.",
    location: "신목 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 76,
    next: "__answer"
  },
  puzzle_intro: {
    speakerRole: "송당의 기억지기 · 가상 복합 인물",
    speaker: "고씨 할망",
    text: "옳지. 말뿐 아니라 이 마을 사람들이 지켜온 마음까지 제대로 알아보았구먼. 이제 흩어진 장면을 시간의 순서대로 이어보게.",
    location: "깨어나는 기억 속",
    focus: "memory",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 88,
    next: "__puzzle"
  },
  memory_voice: {
    speakerRole: "되살아난 기억",
    speaker: "설문대할망의 기억",
    text: "사람들은 홀로 견딘 것이 아니었다. 함께 모여 서로의 무사를 빌며 마을의 시간을 이어왔구나.",
    location: "설문대할망의 기억 속",
    focus: "memory",
    progress: 97,
    next: "__reward"
  }
};

const songdangClues = {
  tree: {
    speakerRole: "송당의 기억지기 · 가상 복합 인물",
    speaker: "고씨 할망",
    text: "이 당숲과 신목은 마을을 지켜보는 오래된 증인이야. 사람들은 이곳을 소중히 여기며 함부로 대하지 않았지.",
    actor: "elder",
    focus: "elder",
    location: "오래된 신목"
  },
  paper: {
    speakerRole: "송당의 기억지기 · 가상 복합 인물",
    speaker: "고씨 할망",
    text: "송당 사람들은 소원을 빌며 흰 한지를 들고 있다가 신목에 매다는 풍습을 이어왔어. 그 소원에는 마을의 평안과 무사함이 담겼지.",
    actor: "elder",
    focus: "elder",
    location: "흰 한지의 흔적"
  },
  steps: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "겹겹이 남은 발자국이 보여. 본향당에서는 해마다 여러 차례 마을제가 이어졌고, 사람들은 함께 모여 마을의 안녕을 빌었어.",
    actor: "bird",
    focus: "bird",
    location: "이어진 발자국"
  }
};

const exactSongdangNodes = {
  arrival: {
    speakerRole: "설문대할망의 잃어버린 기억을 찾아 나선 여행자",
    speaker: "플레이어",
    text: "여기가 어디야? 나무가 엄청나게 크네!",
    location: "송당 본향당 숲 입구",
    focus: "wide",
    progress: 4,
    next: "briefing"
  },
  briefing: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "여기는 구좌읍 송당리 본향당이야!\n송당 신화에서는 ‘백주또’를 제주 여러 마을 신들의 어머니로 이야기해. 송당 사람들이 오랫동안 마을의 신을 모셔온 특별한 숲이지!",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 10,
    next: "approach",
    choices: [
      { label: "상세정보", next: "detail_1" }
    ]
  },
  detail_1: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "송당리는 한라산 중산간에 자리 잡은 마을이야.\n주변에 당오름과 아부오름이 둘러싸고 있지.",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 13,
    next: "detail_1b"
  },
  detail_1b: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "그래서 송당리는 오름과 마을의 삶이 가까이 이어져 있는\n‘오름의 고향’으로도 알려져 있어!",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 14,
    next: "detail_2"
  },
  detail_2: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "송당 신화에서는 백주또의 자손들이 제주 여러 마을로 뻗어나가\n각 마을을 지키는 신이 되었다고 전해져.",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 16,
    next: "detail_2b"
  },
  detail_2b: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "그래서 송당을 제주 마을 신들의 뿌리가 되는\n‘신들의 고향’이라고 이야기하는 거야.",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 17,
    next: "detail_3"
  },
  detail_3: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "송당 사람들은 이 당숲을 신이 머무는 공간으로 여기며 소중하게 지켜왔어.\n이곳에 함께 모여 마을의 안녕과 생업을 빌고, 그 마음을 다음 세대에 전해왔지.",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 19,
    next: "detail_3b"
  },
  detail_3b: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "송당에서는 신과세제, 영등제, 마불림제, 시만곡대제처럼\n마을의 삶과 계절에 맞춰 여러 제를 이어왔다고 해.",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 20,
    next: "detail_4"
  },
  detail_4: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "저기 서 있는 거대한 팽나무, 폭낭은 사람들이 함께 모여 정성을 올린 오랜 시간을 지켜본 신목이야.",
    location: "송당 본향당 숲 입구",
    focus: "bird",
    actor: "bird",
    bird: true,
    progress: 18,
    next: "approach"
  },
  approach: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "저기 큰 팽나무, 폭낭 아래에 당지기 삼춘이 계셔.\n오랫동안 이 숲과 마을의 이야기를 지켜온 분이야. 가서 인사해보자!",
    location: "신목으로 가는 길",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 19,
    back: "briefing",
    next: "language_warning"
  },
  language_warning: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "송당 삼춘께는 배운 제주어로 마음을 전해보자!",
    location: "신목으로 가는 길",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 22,
    next: "player_doubt"
  },
  player_doubt: {
    speakerRole: "설문대할망의 잃어버린 기억을 찾아 나선 여행자",
    speaker: "플레이어",
    text: "제주어는 아직 어려운데…",
    location: "신목으로 가는 길",
    focus: "wide",
    bird: true,
    elder: true,
    progress: 24,
    next: "reassurance"
  },
  reassurance: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "괜찮아! 먼저 뜻을 생각한 다음, 내가 알려주는 제주어 표현을 넣으면 돼.\n천천히 도와줄게!",
    location: "팽나무 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 27,
    next: "greeting_guide"
  },
  greeting_guide: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "제주에서는 가까운 이웃이나 동네 어르신을\n남녀 구분 없이 친근하고 공경하는 마음으로 ‘삼춘’이라 부르기도 해.",
    location: "팽나무 앞",
    focus: "elder",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 31,
    next: "greeting_example"
  },
  greeting_example: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "처음 만난 삼춘께는 ‘안녕하우꽈?’ 또는\n‘편안허우꽈?’라고 인사해볼 수 있어!",
    location: "팽나무 앞",
    focus: "elder",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 33,
    next: "__practice:greeting"
  },
  welcome: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "오냐! 제주말로 살갑게 인사를 건네니 반갑구나.\n혼저옵서예.",
    translation: "오냐! 제주말로 다정하게 인사를 건네니 반갑구나.\n어서 오게.",
    location: "팽나무 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 38,
    next: "welcome_question"
  },
  welcome_question: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "바람새꺼정 데령 여그 송당 본향당엔 무사 찾아왔는고?",
    translation: "바람새까지 데리고 여기 송당 본향당에는 왜 찾아왔는가?",
    location: "팽나무 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 40,
    next: "purpose_guide"
  },
  purpose_guide: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "설문대할망의 기억을 찾으러 왔고, 아는 것이 있는지 여쭤보자.\n필요한 제주어 표현은 내가 알려줄게!",
    location: "팽나무 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 42,
    next: "__practice:purpose"
  },
  memory_trace: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "오냐! 저 큰 폭낭 밑에 곱닥허게 반짝이는 게\n바로 할망의 ‘숲의 기억 흔적’이여.",
    translation: "오냐! 저 큰 팽나무 밑에 곱게 반짝이는 것이\n바로 할망의 ‘숲의 기억 흔적’일세.",
    location: "숲의 기억 흔적 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 49,
    next: "community_memory"
  },
  community_memory: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "경헌디 저 흔적 속에는 할망의 기억만 담긴 게 아니여.\n오랜 세월 이곳에 모인 송당 사람덜의 마음도 함께 담겨 있주.",
    translation: "그런데 저 흔적에는 할망의 기억만 담긴 것이 아니네.\n오랜 세월 이곳에 모인 송당 사람들의 마음도 함께 담겨 있지.",
    location: "숲의 기억 흔적 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 50,
    next: "community_question"
  },
  community_question: {
    speakerRole: "설문대할망의 잃어버린 기억을 찾아 나선 여행자",
    speaker: "플레이어",
    text: "송당 사람들은 이곳에 왜 함께 모였어요?",
    location: "숲의 기억 흔적 앞",
    focus: "wide",
    bird: true,
    elder: true,
    progress: 51,
    next: "community_meaning"
  },
  community_meaning: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "한 사람 소원만 빌젠 모인 게 아니여.\n마을 사람덜이 함께 모영 마을의 안녕과 생업을 빌어왔주.",
    translation: "한 사람의 소원만 빌려고 모인 것이 아니네.\n마을 사람들이 함께 모여 마을의 안녕과 생업을 빌어왔지.",
    location: "숲의 기억 흔적 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 52,
    next: "community_legacy"
  },
  community_legacy: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "그렇게 제를 이어오멍 선대의 마음을 다음 세대에 전해온 거여.",
    translation: "그렇게 제를 이어오며 선대의 마음을 다음 세대에 전해온 것이네.",
    location: "숲의 기억 흔적 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 53,
    next: "community_summary"
  },
  community_summary: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "그러니까 이 숲이 기억하는 건 신목만이 아니구나.\n마을 사람들이 함께 빌고 문화를 이어온 시간도 기억하고 있는 거야!",
    location: "숲의 기억 흔적 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 54,
    next: "memory_rule"
  },
  memory_rule: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "저 기억을 깨우려면 송당 사람덜이 함께 모았던 정성을 되살려야 허주.\n그 마음을 기억하멍 폭낭에 지전물색을 걸어보겠는가?",
    translation: "저 기억을 깨우려면 송당 사람들이 함께 모았던 정성을 되살려야 하네.\n그 마음을 기억하며 팽나무에 지전물색을 걸어보겠는가?",
    location: "숲의 기억 흔적 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 56,
    next: "offering_request"
  },
  offering_request: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "저기 바구니에 하얀 지전과 오색 물색이 담겨 있주.\n송당 사람들이 함께 지켜온 마음을 생각허멍 폭낭에 곱닥허게 걸어보게.",
    translation: "저기 바구니에 하얀 종이와 오색 천이 담겨 있네.\n송당 사람들이 함께 지켜온 마음을 생각하며 팽나무에 곱게 걸어보게.",
    location: "숲의 기억 흔적 앞",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 59,
    next: "__offering"
  },
  after_offering: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "지전물색이 곱게 걸렸어!\n이제 신목을 향해 우리가 되살린 정성을 제주어로 전해보자!",
    location: "지전물색을 건 신목 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 72,
    next: "__practice:invocation"
  },
  awakened: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "기치! 지전물색이 참말로 곱닥허게 걸렸구먼!\n이녁 정성에 숲의 기억이 다시 깨어남수다!",
    translation: "그렇지! 지전물색이 정말로 곱게 걸렸구먼!\n자네의 정성에 숲의 기억이 다시 깨어나고 있네!",
    location: "빛이 깨어나는 신목",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 85,
    next: "awakened_meaning"
  },
  awakened_meaning: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "저 빛은 한 사람의 소원이 아니여.\n송당 사람덜이 함께 빌고 지켜온 마음이 다시 깨어나는 빛이주.",
    translation: "저 빛은 한 사람의 소원이 아니네.\n송당 사람들이 함께 빌고 지켜온 마음이 다시 깨어나는 빛이지.",
    location: "빛이 깨어나는 신목",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 88,
    next: "__reward"
  },
  reward_summary: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "이제 알겠어. 이 숲이 간직한 건 오래된 신목만이 아니었어.\n마을의 안녕을 함께 빌고 그 마음을 이어온 송당 사람들의 기억이었어!",
    location: "빛이 깨어난 신목 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 93,
    next: "next_destination"
  },
  next_destination: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "첫 번째 기억의 흔적을 찾았어!\n다음 흔적은 하도리 토끼섬에서 우리를 기다리고 있어.",
    location: "빛이 깨어난 신목 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 94,
    next: "farewell_guide"
  },
  farewell_guide: {
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "떠나기 전에 송당의 이야기를 알려주신 고인택 삼춘께 감사 인사를 드리자.",
    location: "빛이 깨어난 신목 앞",
    focus: "bird",
    actor: "bird",
    bird: true,
    elder: true,
    progress: 96,
    next: "__practice:farewell"
  },
  goodbye: {
    speakerRole: "송당 본향당 당지기 · 72세",
    speaker: "고인택 어르신",
    text: "오냐! 발걸음 조심허영 잘 가곡, 할망 기억 꼭 다 찾읍서!\n오늘 이 숲에서 배운 송당 사람덜의 마음도 잊지 말곡.",
    translation: "오냐! 발걸음을 조심해서 잘 가고, 할망의 기억을 꼭 모두 찾게나!\n오늘 이 숲에서 배운 송당 사람들의 마음도 잊지 말고.",
    location: "송당 본향당을 떠나는 길",
    focus: "elder",
    actor: "elder",
    bird: true,
    elder: true,
    progress: 100,
    next: "__complete"
  }
};

const songdangPracticeSteps = {
  greeting: {
    questionId: "practice_greeting",
    kicker: "첫 제주어 인사",
    title: "처음 만난 당지기 삼춘께 제주어로 인사해보세요.",
    guide: "먼저 어르신을 부른 다음, 편안한지 묻는 인사를 건네보세요.",
    hints: "삼춘 · 안녕하우꽈? / 편안허우꽈?",
    placeholder: "예: 삼춘, 안녕하우꽈?",
    example: "삼춘, 편안허우꽈?",
    requiredGroups: [["삼춘"], ["안녕하우꽈", "편안허우꽈"]],
    next: "welcome"
  },
  purpose: {
    questionId: "practice_purpose",
    kicker: "찾아온 까닭 말하기",
    title: "찾아온 목적을 밝히고, 기억의 단서를 아는지 여쭤보세요.",
    guide: "표준어 뜻: 설문대할망의 기억을 찾으러 왔습니다. 삼춘, 혹시 아는 것이 있습니까?",
    hints: "할망 · 왔수다 · 삼춘 · 이서마씸?",
    placeholder: "알려준 제주어 낱말을 넣어 문장을 완성하세요.",
    example: "설문대 할망 기억 찾으러 왔수다. 삼춘, 혹시 아시는 거 이서마씸?",
    requiredGroups: [["설문대"], ["할망"], ["기억"], ["왔수다"], ["삼춘"], ["이서마씸", "이시마씸"]],
    next: "memory_trace"
  },
  invocation: {
    questionId: "practice_invocation",
    kicker: "신목에 정성 전하기",
    title: "지전물색을 걸었다고 말하고, 숲의 기억이 깨어나길 빌어보세요.",
    guide: "표준어 뜻: 지전물색을 정성껏 걸었습니다. 숲의 기억이 깨어나게 굽어살펴 주십시오.",
    hints: "지전물색 · 걸었수다 · 깨어나게 · 줍서",
    placeholder: "지전물색을 걸었다는 내용을 제주어로 전하세요.",
    example: "지전물색 정성껏 걸었수다. 숲의 기억 깨어나게 굽어살펴 줍서!",
    requiredGroups: [["지전물색"], ["걸었수다"], ["기억"], ["줍서"]],
    next: "awakened"
  },
  farewell: {
    questionId: "practice_farewell",
    kicker: "감사 인사",
    title: "고인택 삼춘께 감사드리고 하도리로 떠난다고 인사해보세요.",
    guide: "표준어 뜻: 감사합니다, 삼춘. 이제 하도리로 가보겠습니다.",
    hints: "고맙수다 · 삼춘 · 하도리 · 가보쿠다",
    placeholder: "감사와 출발 인사를 제주어로 전하세요.",
    example: "고맙수다, 삼춘! 이제 하도리로 가보쿠다!",
    requiredGroups: [["고맙수다"], ["삼춘"], ["하도리"], ["가보쿠다"]],
    next: "goodbye"
  }
};

let songdangNextTarget = null;
let songdangCurrentNode = null;
let songdangShowingTranslation = false;
let songdangPracticeContinueTarget = null;

function setSongdangFocus(focus = "wide") {
  const screen = $("#songdang-screen");
  ["focus-bird", "focus-elder", "focus-clues", "focus-answer", "focus-memory"].forEach((className) => screen.classList.remove(className));
  if (focus !== "wide") screen.classList.add("focus-" + focus);
}

function setSongdangCharacters(node) {
  const elder = $("#songdang-elder");
  const bird = $("#songdang-bird");
  elder.className = "songdang-character songdang-elder";
  bird.className = "songdang-character songdang-bird";
  if (node.elder || node.actor === "elder") elder.classList.add("is-present");
  if (node.bird || node.actor === "bird") bird.classList.add("is-present");
  if (node.actor === "elder") elder.classList.add("is-speaking");
  if (node.actor === "bird") bird.classList.add("is-speaking");
  elder.setAttribute("aria-hidden", String(!(node.elder || node.actor === "elder")));
  bird.setAttribute("aria-hidden", String(!(node.bird || node.actor === "bird")));
}

function hideSongdangInteractionLayers() {
  $("#songdang-offering-game").hidden = true;
  $("#songdang-answer").hidden = true;
  $("#songdang-agent-wind").hidden = true;
}

function renderSongdangSpeakerAvatar(node) {
  const avatar = $("#songdang-speaker-avatar");
  const image = $("#songdang-speaker-avatar-image");
  const mark = $("#songdang-speaker-avatar-mark");
  const actor = node.actor === "bird" || node.speaker === "바람새"
    ? "bird"
    : node.actor === "elder" || node.speaker === "고인택 어르신"
      ? "elder"
      : "player";

  avatar.className = "dialogue-avatar is-" + actor;
  if (actor === "bird") {
    image.src = "/assets/baramsae.png";
    image.hidden = false;
    mark.hidden = true;
  } else if (actor === "elder") {
    image.src = "/assets/npc-songdang-gointek.png";
    image.hidden = false;
    mark.hidden = true;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
    mark.textContent = "플레이어 실루엣";
    mark.hidden = true;
  }
}

function renderSongdangDialogue(nodeOrId, options = {}) {
  const node = typeof nodeOrId === "string" ? exactSongdangNodes[nodeOrId] : nodeOrId;
  if (!node) return;
  const previousNode = state.songdang.node;
  if (typeof nodeOrId === "string") {
    if (options.recordHistory !== false && previousNode && previousNode !== nodeOrId) {
      state.songdang.history.push(previousNode);
    }
    state.songdang.node = nodeOrId;
  }
  songdangCurrentNode = node;
  songdangShowingTranslation = false;
  hideSongdangInteractionLayers();
  setSongdangFocus(node.focus);
  setSongdangCharacters(node);
  $("#songdang-location-label").textContent = node.location || "송당리 본향당";
  $("#songdang-speaker").textContent = node.speaker;
  renderSongdangSpeakerAvatar(node);
  $("#songdang-dialogue-text").textContent = node.text;
  const translationToggle = $("#songdang-translation-toggle");
  translationToggle.hidden = !node.translation;
  translationToggle.textContent = "표준어";
  translationToggle.setAttribute("aria-pressed", "false");
  $("#songdang-progress-fill").style.width = String(node.progress || 0) + "%";
  const dialogue = $("#songdang-dialogue");
  const choices = $("#songdang-choices");
  choices.replaceChildren();
  const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
  const choiceOnly = hasChoices && !node.next;
  choices.hidden = !hasChoices;
  dialogue.classList.toggle("has-choices", hasChoices);
  dialogue.classList.toggle("choice-only", choiceOnly);
  $("#songdang-next").hidden = choiceOnly;
  $("#songdang-next").innerHTML = "계속 <span>→</span>";
  $("#songdang-back").disabled = state.songdang.history.length === 0;
  if (hasChoices) {
    node.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", () => renderSongdangDialogue(choice.next));
      choices.append(button);
    });
  }
  songdangNextTarget = node.next || null;
  dialogue.hidden = false;
}

function resetSongdangAgentDrawer() {
  $("#songdang-agent-drawer").classList.remove("is-open");
  $("#songdang-agent-drawer").setAttribute("aria-hidden", "true");
  $("#songdang-agent-toggle").setAttribute("aria-expanded", "false");
  $("#songdang-agent-toggle").classList.remove("has-result");
  ["culture", "dialect"].forEach((agent) => {
    const item = $("[data-songdang-agent='" + agent + "']");
    item.className = "";
    item.querySelector("small").textContent = "대기";
  });
  $("#songdang-culture-feedback").textContent = "아직 판정하지 않았습니다.";
  $("#songdang-dialect-feedback").textContent = "아직 판정하지 않았습니다.";
  $("#songdang-grounding").textContent = "판정 후 사용한 근거 ID가 표시됩니다.";
}

function startSongdangQuest() {
  state.currentQuest = 0;
  state.songdang.node = null;
  state.songdang.history = [];
  state.songdang.practice = null;
  songdangPracticeContinueTarget = null;
  state.songdang.practiceAttempts = {};
  state.songdang.offeringIndex = 0;
  state.songdang.lastEvaluation = null;
  $("#songdang-answer-input").value = "";
  $("#songdang-char-count").textContent = "0";
  $("#songdang-submit").disabled = false;
  $("#songdang-memory-reward").hidden = true;
  $("#songdang-complete").innerHTML = "다음 이야기 듣기 <span>→</span>";
  $$("[data-offering-order]").forEach((item) => {
    item.disabled = false;
    item.classList.remove("is-placed");
  });
  $("#songdang-offering-status").textContent = "먼저 하얀 지전을 선택하세요.";
  resetSongdangAgentDrawer();
  showScreen("songdang-screen");
  renderSongdangDialogue("arrival", { recordHistory: false });
}

function goBackSongdangDialogue() {
  const explicitBackTarget = songdangCurrentNode?.back;
  if (explicitBackTarget) {
    const targetIndex = state.songdang.history.lastIndexOf(explicitBackTarget);
    if (targetIndex >= 0) state.songdang.history.splice(targetIndex);
    renderSongdangDialogue(explicitBackTarget, { recordHistory: false });
    return;
  }
  const previousNode = state.songdang.history.pop();
  if (!previousNode) return;
  renderSongdangDialogue(previousNode, { recordHistory: false });
}

function toggleSongdangTranslation() {
  if (!songdangCurrentNode?.translation) return;
  songdangShowingTranslation = !songdangShowingTranslation;
  $("#songdang-dialogue-text").textContent = songdangShowingTranslation
    ? songdangCurrentNode.translation
    : songdangCurrentNode.text;
  const button = $("#songdang-translation-toggle");
  button.textContent = songdangShowingTranslation ? "제주어" : "표준어";
  button.setAttribute("aria-pressed", String(songdangShowingTranslation));
}

function advanceSongdang() {
  if (!songdangNextTarget) return;
  if (songdangNextTarget.startsWith("__practice:")) return showSongdangPractice(songdangNextTarget.split(":")[1]);
  if (songdangNextTarget === "__offering") return showSongdangOffering();
  if (songdangNextTarget === "__reward") return showSongdangReward();
  if (songdangNextTarget === "__complete") return completeSongdangQuest();
  renderSongdangDialogue(songdangNextTarget);
}

function showSongdangOffering() {
  hideSongdangInteractionLayers();
  setSongdangFocus("clues");
  setSongdangCharacters({ bird: true, elder: true });
  $("#songdang-dialogue").hidden = true;
  $("#songdang-offering-game").hidden = false;
  $("#songdang-location-label").textContent = "지전물색을 올리는 신목 앞";
  $("#songdang-progress-fill").style.width = "58%";
  state.songdang.offeringIndex = 0;
  $$("[data-offering-order]").forEach((item) => {
    item.disabled = false;
    item.classList.remove("is-placed");
  });
  $("#songdang-offering-status").textContent = "먼저 하얀 지전을 선택하세요.";
}

function selectSongdangOffering(button) {
  const order = Number(button.dataset.offeringOrder);
  const expected = state.songdang.offeringIndex + 1;
  if (order !== expected) {
    showToast("먼저 하얀 지전을 고른 뒤 오색 물색을 걸어주세요");
    return;
  }
  button.disabled = true;
  button.classList.add("is-placed");
  state.songdang.offeringIndex += 1;
  if (state.songdang.offeringIndex === 1) {
    $("#songdang-offering-status").textContent = "하얀 지전을 걸었습니다. 이제 오색 물색을 선택하세요.";
    return;
  }
  $("#songdang-offering-status").textContent = "지전물색을 곱게 걸어 매듭지었습니다.";
  showToast("지전물색을 신목에 정성껏 걸었습니다");
  setTimeout(() => renderSongdangDialogue("after_offering"), 700);
}

function skipSongdangMinigame() {
  state.songdang.offeringIndex = 2;
  $$('[data-offering-order]').forEach((button) => {
    button.disabled = true;
    button.classList.add('is-placed');
  });
  $('#songdang-offering-status').textContent = '미니게임을 건너뛰었습니다. 지전물색을 곱게 걸었습니다.';
  setTimeout(() => renderSongdangDialogue('after_offering'), 180);
}

function showSongdangPractice(stepId) {
  const step = songdangPracticeSteps[stepId];
  if (!step) return;
  state.songdang.practice = stepId;
  songdangPracticeContinueTarget = null;
  hideSongdangInteractionLayers();
  setSongdangFocus("answer");
  setSongdangCharacters({ bird: true, elder: true });
  $("#songdang-dialogue").hidden = true;
  $("#songdang-answer").hidden = false;
  $("#songdang-practice-kicker").textContent = step.kicker;
  $("#songdang-practice-title").textContent = step.title;
  $("#songdang-practice-guide").textContent = step.guide;
  $("#songdang-practice-hints").textContent = step.hints;
  clearSongdangPracticeFeedback();
  $("#songdang-agent-wind").hidden = true;
  $("#songdang-answer-input").placeholder = step.placeholder;
  $("#songdang-answer-input").value = "";
  $("#songdang-char-count").textContent = "0";
  setSongdangSubmitting(false);
  $("#songdang-answer-input").focus();
}

function setSongdangSubmitting(isSubmitting) {
  const button = $("#songdang-submit");
  $("#songdang-answer-input").readOnly = isSubmitting;
  $("#songdang-demo-fill").disabled = isSubmitting;
  $("#songdang-skip-practice").disabled = isSubmitting;
  button.disabled = isSubmitting;
  button.classList.toggle("is-loading", isSubmitting);
  button.querySelector("span").textContent = isSubmitting ? "판독 중" : "말 건네기";
  button.querySelector("i").textContent = isSubmitting ? "…" : "→";
}

function skipSongdangPractice() {
  const step = songdangPracticeSteps[state.songdang.practice];
  if (!step) return;
  songdangPracticeContinueTarget = null;
  setSongdangSubmitting(false);
  clearSongdangPracticeFeedback();
  $("#songdang-agent-wind").hidden = true;
  state.songdang.practice = null;
  renderSongdangDialogue(step.next);
}

function showSongdangPracticeContinue(step) {
  songdangPracticeContinueTarget = step.next;
  const button = $("#songdang-submit");
  $("#songdang-answer-input").readOnly = true;
  $("#songdang-demo-fill").disabled = true;
  $("#songdang-skip-practice").disabled = true;
  button.disabled = false;
  button.classList.remove("is-loading");
  button.querySelector("span").textContent = "계속";
  button.querySelector("i").textContent = "→";
  $("#songdang-answer-input").focus();
}

function continueSongdangPractice() {
  if (!songdangPracticeContinueTarget) return;
  const nextTarget = songdangPracticeContinueTarget;
  songdangPracticeContinueTarget = null;
  state.songdang.practice = null;
  $("#songdang-agent-wind").hidden = true;
  renderSongdangDialogue(nextTarget);
}

function handleSongdangPracticeAction() {
  if (songdangPracticeContinueTarget) {
    continueSongdangPractice();
    return;
  }
  submitSongdangAnswer();
}

function showSongdangInlineEvaluation() {
  $("#songdang-agent-wind .inline-evaluation-heading strong").textContent = "Gemini가 답변을 판독하고 있습니다";
  $("#songdang-agent-wind .inline-evaluation-heading p").textContent = "문장 의미를 확인한 뒤 제주어 표현을 검사합니다.";
  const states = {
    culture: ["is-working", "분석 중"],
    dialect: ["", "대기"]
  };
  Object.entries(states).forEach(([agent, [className, label]]) => {
    const item = $("[data-inline-agent='" + agent + "']");
    item.className = className;
    item.querySelector("small").textContent = label;
  });
  $("#songdang-agent-wind").hidden = false;
}

function updateSongdangInlineEvaluation(event) {
  const order = ["culture", "dialect"];
  const index = order.indexOf(event.stage);
  if (index < 0 || event.status !== "completed") return;
  const completed = $("[data-inline-agent='" + event.stage + "']");
  completed.className = "is-reviewed";
  completed.querySelector("small").textContent = "검사 완료";
  const nextStage = order[index + 1];
  if (!nextStage) return;
  const next = $("[data-inline-agent='" + nextStage + "']");
  next.className = "is-working";
  next.querySelector("small").textContent = "분석 중";
}

function showSongdangInlineResult(data) {
  const stages = data.stages || [];
  const dialectSkipped = stages.includes("dialect_skipped_due_to_meaning");
  const meaningPassed = ["pass", "retry_dialect"].includes(data.verdict);
  const dialectPassed = data.verdict === "pass";
  const meaning = $("[data-inline-agent='culture']");
  const dialect = $("[data-inline-agent='dialect']");

  meaning.className = meaningPassed ? "is-pass" : "is-retry";
  meaning.querySelector("small").textContent = meaningPassed ? "통과" : "보완 필요";
  if (dialectSkipped) {
    dialect.className = "is-skipped";
    dialect.querySelector("small").textContent = "검사 생략";
  } else {
    dialect.className = dialectPassed ? "is-pass" : "is-retry";
    dialect.querySelector("small").textContent = dialectPassed ? "통과" : "보완 필요";
  }

  const heading = $("#songdang-agent-wind .inline-evaluation-heading strong");
  const detail = $("#songdang-agent-wind .inline-evaluation-heading p");
  heading.textContent = data.verdict === "pass" ? "두 단계 판정에 통과했습니다" : "판정 결과를 확인해주세요";
  detail.textContent = dialectSkipped
    ? "문장 의미를 먼저 보완해야 제주어 표현을 검사할 수 있습니다."
    : "각 단계의 실제 판정 결과를 표시했습니다.";
}

function clearSongdangPracticeFeedback() {
  const panel = $("#songdang-practice-evaluation");
  panel.hidden = true;
  $("#songdang-practice-evaluation-summary").textContent = "";
  $("#songdang-practice-evaluation-detail").textContent = "";
  $("#songdang-practice-evaluation-hint").textContent = "";
}

function showSongdangPracticeFeedback(data) {
  const dialectOnly = data.verdict === "retry_dialect";
  const meaningOnly = ["retry_knowledge", "retry_relevance"].includes(data.verdict);
  const summary = dialectOnly
    ? "뜻은 통과했습니다. 제주어 표현을 보완해주세요."
    : meaningOnly
      ? "먼저 현재 상황에 맞는 뜻을 보완해주세요."
      : "상황의 뜻과 제주어 표현을 다시 확인해주세요.";
  const detail = dialectOnly
    ? data.feedback_dialect
    : meaningOnly
      ? data.feedback_knowledge
      : [data.feedback_knowledge, data.feedback_dialect].filter(Boolean).join(" ");
  $("#songdang-practice-evaluation-summary").textContent = summary;
  $("#songdang-practice-evaluation-detail").textContent = detail || "판정 내용을 확인해 문장을 다시 다듬어보세요.";
  $("#songdang-practice-evaluation-hint").textContent = data.hint ? `힌트 · ${data.hint}` : "";
  $("#songdang-practice-evaluation").hidden = false;
}

function showSongdangClueHunt() {
  hideSongdangInteractionLayers();
  setSongdangFocus("clues");
  setSongdangCharacters({});
  $("#songdang-location-label").textContent = "기억이 머문 당숲";
  $("#songdang-dialogue").hidden = true;
  $("#songdang-clue-layer").hidden = false;
  $("#songdang-progress-fill").style.width = String(47 + state.songdang.clues.size * 7) + "%";
}

function inspectSongdangClue(clueId) {
  const clue = songdangClues[clueId];
  if (!clue) return;
  state.songdang.clues.add(clueId);
  $("[data-clue='" + clueId + "']").classList.add("is-found");
  $("[data-clue-mark='" + clueId + "']").classList.add("is-found");
  const next = state.songdang.clues.size === Object.keys(songdangClues).length ? "clue_summary" : "__clues";
  renderSongdangDialogue({
    ...clue,
    bird: true,
    elder: true,
    progress: 47 + state.songdang.clues.size * 7,
    next
  });
  $("#songdang-next").innerHTML = next === "clue_summary" ? "흔적을 하나로 잇기 <span>→</span>" : "다른 흔적 살피기 <span>→</span>";
}

function showSongdangAnswer() {
  hideSongdangInteractionLayers();
  setSongdangFocus("answer");
  setSongdangCharacters({ bird: true, elder: true });
  $("#songdang-dialogue").hidden = true;
  $("#songdang-answer").hidden = false;
  $("#songdang-progress-fill").style.width = "78%";
  $("#songdang-answer-input").focus();
}

function setSongdangAgentStep(agent, mode, label) {
  const item = $("[data-songdang-agent='" + agent + "']");
  item.className = mode ? "is-" + mode : "";
  item.querySelector("small").textContent = label;
}

function updateSongdangAgentDrawer(data) {
  const stages = data.stages || [];
  const dialectSkipped = stages.includes("dialect_skipped_due_to_meaning");
  const culturePassed = ["pass", "retry_dialect"].includes(data.verdict);
  const dialectPassed = data.verdict === "pass";
  setSongdangAgentStep("culture", culturePassed ? "pass" : "retry", culturePassed ? "통과" : "보완");
  if (dialectSkipped) {
    setSongdangAgentStep("dialect", "", "검사 전");
  } else {
    setSongdangAgentStep("dialect", dialectPassed ? "pass" : "retry", dialectPassed ? "통과" : "보완");
  }
  $("#songdang-culture-feedback").textContent = data.feedback_knowledge || "문화 판정 피드백이 없습니다.";
  $("#songdang-dialect-feedback").textContent = data.feedback_dialect || "제주어 판정 피드백이 없습니다.";
  const evidence = data.grounding_evidence_ids || [];
  $("#songdang-grounding").textContent = evidence.length
    ? (data.retrieval_backend || "approved_store") + " · " + evidence.join(", ") + " · trace " + data.trace_id
    : data.verdict === "input_rejected"
      ? "입력 보호 계층에서 모델 호출 전에 차단했습니다."
      : "송당리 대화 상황 규칙 · trace " + data.trace_id;
  $("#songdang-agent-toggle").classList.add("has-result");
  $("#songdang-agent-toggle").hidden = false;
}

function songdangOutcome(verdict) {
  if (verdict === "pass") return "both";
  if (verdict === "retry_dialect") return "culture";
  if (verdict === "retry_knowledge") return "dialect";
  if (["retry_both", "retry_relevance", "input_rejected"].includes(verdict)) return "neither";
  return "uncertain";
}

function renderSongdangEvaluationReaction(data) {
  const outcome = songdangOutcome(data.verdict);
  const retryTarget = "__answer";
  if (outcome === "both") {
    renderSongdangDialogue({
      speakerRole: "송당의 기억지기 · 가상 복합 인물",
      speaker: "고씨 할망",
      text: "옳지. 말씨와 그 안에 담긴 뜻이 모두 신목에 닿았어. 잠들어 있던 기억의 빛이 다시 숨을 쉬기 시작하는구나.",
      actor: "elder",
      bird: true,
      elder: true,
      focus: "elder",
      location: "빛이 깨어나는 신목",
      progress: 84,
      next: "puzzle_intro"
    });
    $("#songdang-next").innerHTML = "깨어난 기억 따라가기 <span>→</span>";
    return;
  }
  if (outcome === "culture") {
    renderSongdangDialogue({
      speakerRole: "제주의 바람에서 태어난 길잡이",
      speaker: "바람새",
      text: "송당 사람들이 함께 지켜온 마음은 제대로 알아냈어. 이제 그 뜻에 제주말의 숨결을 조금 더 실어보자. 판정 과정에서 받은 힌트도 확인할 수 있어.",
      actor: "bird",
      bird: true,
      elder: true,
      focus: "bird",
      location: "신목 앞",
      progress: 79,
      next: retryTarget
    });
    $("#songdang-next").innerHTML = "제주어를 보완해 다시 답하기 <span>→</span>";
    return;
  }
  if (outcome === "dialect") {
    renderSongdangDialogue({
      speakerRole: "송당의 기억지기 · 가상 복합 인물",
      speaker: "고씨 할망",
      text: "제주말은 살갑게 잘 썼구나. 하지만 사람들이 구경이나 한 사람의 소원만을 위해 모인 것은 아니었어. 세 흔적이 가리킨 마을 전체의 바람을 다시 생각해보게.",
      actor: "elder",
      bird: true,
      elder: true,
      focus: "elder",
      location: "신목 앞",
      progress: 79,
      next: retryTarget
    });
    $("#songdang-next").innerHTML = "문화의 뜻을 고쳐 다시 답하기 <span>→</span>";
    return;
  }
  if (outcome === "neither") {
    renderSongdangDialogue({
      speakerRole: "제주의 바람에서 태어난 길잡이",
      speaker: "바람새",
      text: "아직 기억과 답변이 잘 이어지지 않았어. 사람들이 남긴 소원과 겹겹이 이어진 발자국을 먼저 떠올리고, 알고 있는 제주말을 한 가지씩 보태보자.",
      actor: "bird",
      bird: true,
      elder: true,
      focus: "bird",
      location: "신목 앞",
      progress: 78,
      next: retryTarget
    });
    $("#songdang-next").innerHTML = "힌트를 품고 다시 답하기 <span>→</span>";
    return;
  }
  renderSongdangDialogue({
    speakerRole: "제주의 바람에서 태어난 길잡이",
    speaker: "바람새",
    text: "기억의 바람이 흔들려 답을 확실히 읽지 못했어. 틀렸다고 정하지 않을게. 문장을 조금 더 분명하게 다듬어서 다시 들려줘.",
    actor: "bird",
    bird: true,
    elder: true,
    focus: "bird",
    location: "신목 앞",
    progress: 78,
    next: retryTarget
  });
  $("#songdang-next").innerHTML = "답변을 다듬어 다시 시도 <span>→</span>";
}

async function submitSongdangAnswer() {
  const answer = $("#songdang-answer-input").value.trim();
  if (!answer) return showToast("바람새가 알려준 제주어로 문장을 입력해주세요");
  const step = songdangPracticeSteps[state.songdang.practice];
  if (!step) return;
  const attempt = state.songdang.practiceAttempts[state.songdang.practice] || 1;
  resetSongdangAgentDrawer();
  clearSongdangPracticeFeedback();
  setSongdangSubmitting(true);
  showSongdangInlineEvaluation();
  setSongdangAgentStep("culture", "working", "문장 의미 판정 중");

  try {
    const data = await agentClient.evaluateStream({
      questId: "gujwa_songdang_01",
      questionId: step.questionId,
      userAnswer: answer,
      attempt,
      rubricVersion: "1.0",
      onStage: async (event) => {
        updateSongdangInlineEvaluation(event);
        if (event.stage === "verify" && event.status === "completed") {
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
      }
    });
    state.songdang.lastEvaluation = data;
    showSongdangInlineResult(data);
    updateSongdangAgentDrawer(data);
    if (data.verdict === "pass") {
      showToast("상황의 뜻과 제주어 표현을 모두 정확하게 전했습니다");
      showSongdangPracticeContinue(step);
      return;
    }

    state.songdang.practiceAttempts[state.songdang.practice] = attempt + 1;
    showSongdangPracticeFeedback(data);
    setSongdangSubmitting(false);
    $("#songdang-answer-input").focus();
  } catch (error) {
    $("#songdang-agent-wind").hidden = true;
    setSongdangAgentStep("culture", "retry", "연결 오류");
    showSongdangPracticeFeedback({
      verdict: "system_error",
      feedback_knowledge: "Gemini 판정 서버에 연결하지 못했습니다.",
      feedback_dialect: "잠시 후 같은 문장으로 다시 시도해주세요.",
      hint: error.message
    });
    setSongdangSubmitting(false);
  }
}

function startSongdangPuzzle() {
  hideSongdangInteractionLayers();
  setSongdangFocus("memory");
  setSongdangCharacters({});
  $("#songdang-dialogue").hidden = true;
  $("#songdang-puzzle").hidden = false;
  $("#songdang-location-label").textContent = "설문대할망의 기억 속";
  $("#songdang-progress-fill").style.width = "91%";
  state.songdang.puzzleIndex = 0;
  $$(".memory-sequence i").forEach((item) => item.classList.remove("is-filled"));
  $$("[data-memory-order]").forEach((item) => { item.disabled = false; });
}

function selectSongdangMemoryCard(button) {
  const order = Number(button.dataset.memoryOrder);
  const expected = state.songdang.puzzleIndex + 1;
  if (order !== expected) {
    state.songdang.puzzleIndex = 0;
    $$(".memory-sequence i").forEach((item) => item.classList.remove("is-filled"));
    $$("[data-memory-order]").forEach((item) => { item.disabled = false; });
    showToast("기억의 순서가 엉켰습니다 · 함께 모인 장면부터 떠올려보세요");
    return;
  }
  button.disabled = true;
  $$(".memory-sequence i")[state.songdang.puzzleIndex].classList.add("is-filled");
  state.songdang.puzzleIndex += 1;
  if (state.songdang.puzzleIndex === 3) {
    showToast("기억의 순서가 완성되었습니다");
    setTimeout(() => {
      $("#songdang-puzzle").hidden = true;
      renderSongdangDialogue("memory_voice");
      $("#songdang-next").innerHTML = "기억의 흔적 품기 <span>→</span>";
    }, 650);
  }
}

function showSongdangReward() {
  hideSongdangInteractionLayers();
  $("#songdang-dialogue").hidden = true;
  $("#songdang-memory-reward").hidden = false;
  $("#songdang-progress-fill").style.width = "90%";
}

function continueSongdangAfterReward() {
  $("#songdang-memory-reward").hidden = true;
  renderSongdangDialogue("reward_summary");
}

function completeSongdangQuest() {
  state.completed.add(0);
  $("#songdang-memory-reward").hidden = true;
  enterGujwa();
  showToast("기억의 흔적 ① · 함께 지켜온 숲의 약속 획득");
}

const hadoNodes = {
  arrival: {
    speaker: "플레이어",
    text: "여기 정말 예쁘다!\n저기 바다 위에 떠 있는 작은 섬은 뭐야?",
    location: "하도리 굴동포구",
    progress: 4,
    next: "briefing"
  },
  briefing: {
    speaker: "바람새",
    actor: "bird",
    text: "여기는 구좌읍 하도리 굴동포구야.\n저기 보이는 섬이 바로 토끼섬이지!\n우리나라에서 문주란이 자연적으로 자라는 유일한 곳으로 알려져 있어.",
    location: "굴동포구에서 바라본 토끼섬",
    progress: 10,
    next: "first_question"
  },
  first_question: {
    speaker: "플레이어",
    text: "문주란? 처음 들어보는 이름인데.",
    location: "굴동포구에서 바라본 토끼섬",
    progress: 14,
    next: "meet_guide",
    choices: [
      { label: "상세정보", next: "detail_1" }
    ]
  },
  detail_1: {
    speaker: "바람새",
    actor: "bird",
    text: "문주란은 따뜻한 바닷가에서 자라는 늘푸른 여러해살이풀이야.\n여름이 되면 기다란 꽃대 끝에 하얀 꽃을 피우지.",
    location: "문주란 관찰 기록",
    progress: 17,
    next: "detail_2"
  },
  detail_2: {
    speaker: "바람새",
    actor: "bird",
    text: "하얀 꽃이 섬을 뒤덮으면 멀리서 봤을 때 흰 토끼가 웅크리고 앉아 있는 것처럼 보인대.\n그래서 지금은 토끼섬이라고 불러.",
    location: "문주란 관찰 기록",
    progress: 20,
    next: "detail_3"
  },
  detail_3: {
    speaker: "바람새",
    actor: "bird",
    text: "하지만 이 섬에는 더 오래된 이름도 있어.\n하도 사람들은 바깥쪽의 작은 섬이라는 뜻으로 이곳을 ‘난들여’라고 불렀대.",
    location: "문주란 관찰 기록",
    progress: 23,
    next: "detail_4"
  },
  detail_4: {
    speaker: "바람새",
    actor: "bird",
    text: "토끼섬의 문주란 자생지는 천연기념물 제19호로 보호되고 있어.\n멀리서 섬의 모습을 자세히 살펴보자!",
    location: "문주란 관찰 기록",
    progress: 26,
    back: "first_question",
    next: "meet_guide"
  },
  meet_guide: {
    speaker: "바람새",
    actor: "bird",
    npc: true,
    text: "저기 토끼섬을 바라보고 계신 삼춘이 보여?\n오랫동안 하도리 바다와 문주란을 지켜본 문정해 삼춘이야.\n가서 인사해보자!",
    location: "굴동포구 해안 길",
    progress: 30,
    next: "player_greeting"
  },
  player_greeting: {
    speaker: "플레이어",
    npc: true,
    text: "삼춘, 안녕하우꽈?",
    location: "문정해 삼춘 앞",
    progress: 33,
    next: "elder_welcome"
  },
  elder_welcome: {
    speaker: "문정해 삼춘",
    actor: "npc",
    npc: true,
    text: "혼저옵서예.\n저 난들여 보레 왔수과?",
    translation: "어서 오세요.\n저 토끼섬을 보러 왔나요?",
    location: "문정해 삼춘 앞",
    progress: 36,
    next: "player_purpose"
  },
  player_purpose: {
    speaker: "플레이어",
    npc: true,
    text: "네! 토끼섬의 문주란에 대해 알고 싶어서 왔어요.",
    location: "문정해 삼춘 앞",
    progress: 39,
    next: "elder_island"
  },
  elder_island: {
    speaker: "문정해 삼춘",
    actor: "npc",
    npc: true,
    text: "잘 왔수다.\n경헌디 토끼섬은 꽃만 보는 곳이 아니우다.\n모래와 검은 바위, 바람과 파도가 함께 지켜온 섬이우다.",
    translation: "잘 왔습니다.\n그런데 토끼섬은 꽃만 보는 곳이 아닙니다.\n모래와 검은 바위, 바람과 파도가 함께 지켜온 섬입니다.",
    location: "문정해 삼춘 앞",
    progress: 43,
    next: "elder_request"
  },
  elder_request: {
    speaker: "문정해 삼춘",
    actor: "npc",
    npc: true,
    text: "요즘 기억의 바람이 불멍 섬의 모습이 흐려졌수다.\n바람 망원경으로 난들여의 세 가지 흔적을 찾아줍서.",
    translation: "요즘 기억의 바람이 불면서 섬의 모습이 흐려졌습니다.\n바람 망원경으로 난들여의 세 가지 흔적을 찾아주세요.",
    location: "바람 망원경 앞",
    progress: 47,
    next: "__observe"
  },
  visitor_alert: {
    speaker: "플레이어",
    visitor: true,
    text: "잠깐! 저 사람이 문주란을 꺾으려고 해!",
    location: "바람 망원경에 비친 기억",
    progress: 67,
    next: "visitor_problem"
  },
  visitor_problem: {
    speaker: "바람새",
    actor: "bird",
    npc: true,
    visitor: true,
    text: "저건 토끼섬에 남은 흐릿한 기억이야.\n문주란을 지켜야 한다는 마음이 사라지면서 잘못된 장면으로 바뀐 것 같아.",
    location: "바람 망원경에 비친 기억",
    progress: 70,
    next: "elder_protection_request"
  },
  elder_protection_request: {
    speaker: "문정해 삼춘",
    actor: "npc",
    npc: true,
    visitor: true,
    text: "꽃을 아끼는 말을 전허민 기억을 바로잡을 수 있수다.\n방문객에게 문주란을 꺾지 말고 지켜달라고 말해봅서.",
    translation: "꽃을 아끼는 말을 전하면 기억을 바로잡을 수 있습니다.\n방문객에게 문주란을 꺾지 말고 지켜달라고 말해보세요.",
    location: "바람 망원경에 비친 기억",
    progress: 73,
    next: "player_language_question"
  },
  player_language_question: {
    speaker: "플레이어",
    npc: true,
    visitor: true,
    text: "제주어로 말해야 하는 거지?",
    location: "바람 망원경에 비친 기억",
    progress: 75,
    next: "bird_language_guide"
  },
  bird_language_guide: {
    speaker: "바람새",
    actor: "bird",
    npc: true,
    visitor: true,
    text: "맞아. 어렵게 말할 필요는 없어.\n뜻이 자연스럽게 이어지도록 ‘꺾지 맙서’와 ‘지켜줍서’를 사용해보자.",
    location: "바람 망원경에 비친 기억",
    progress: 78,
    next: "__answer"
  },
  visitor_resolved: {
    speaker: "기억 속 방문자",
    actor: "visitor",
    npc: true,
    visitor: true,
    text: "알겠습니다.\n멀리서 바라보고 문주란을 소중히 지킬게요.",
    location: "바로잡힌 기억 속",
    progress: 87,
    next: "elder_resolved"
  },
  elder_resolved: {
    speaker: "문정해 삼춘",
    actor: "npc",
    npc: true,
    text: "기치. 꽃을 꺾지 않고 지켜보는 것도 섬을 아끼는 방법이우다.\n이녁 말이 난들여의 기억에 잘 닿았수다.",
    translation: "그렇지요. 꽃을 꺾지 않고 바라보는 것도 섬을 아끼는 방법입니다.\n당신의 말이 난들여의 기억에 잘 닿았습니다.",
    location: "선명해진 난들여의 기억",
    progress: 90,
    next: "memory_restored"
  },
  memory_restored: {
    speaker: "바람새",
    actor: "bird",
    npc: true,
    text: "토끼섬의 기억이 돌아오고 있어!\n이 기억은 하얀 꽃의 모습만 담은 게 아니야.\n하도 사람들이 오래된 이름과 자생 환경을 기억하고 지켜온 마음도 함께 담겨 있어.",
    location: "선명해진 난들여의 기억",
    progress: 94,
    next: "__reward"
  },
  next_destination: {
    speaker: "바람새",
    actor: "bird",
    npc: true,
    text: "이제 구좌읍에서 남은 흔적은 하나야.\n바람 너머에서 여러 사람이 힘을 모아 박자를 맞추는 기억이 느껴져.\n마지막 흔적이 있는 동김녕리 해안으로 가보자!",
    location: "하도리 굴동포구를 떠나는 길",
    progress: 96,
    next: "player_departure"
  },
  player_departure: {
    speaker: "플레이어",
    npc: true,
    text: "좋아. 이번에는 바다 사람들이 남긴 기억을 찾아보자!",
    location: "하도리 굴동포구를 떠나는 길",
    progress: 98,
    next: "elder_farewell"
  },
  elder_farewell: {
    speaker: "문정해 삼춘",
    actor: "npc",
    npc: true,
    text: "조심허영 잘 다녀옵서.\n기억은 눈에 보이는 것만이 아니라, 사람들이 이어온 마음에도 남는 법이우다.",
    translation: "조심해서 잘 다녀오세요.\n기억은 눈에 보이는 것뿐 아니라 사람들이 이어온 마음에도 남는 법입니다.",
    location: "하도리 굴동포구를 떠나는 길",
    progress: 100,
    next: "__complete"
  }
};

const hadoObservationDialogues = {
  flower: {
    player: "찾았다! 바위 사이에 하얀 꽃이 피어 있어.",
    response: {
      speaker: "문정해 삼춘",
      actor: "npc",
      npc: true,
      text: "저 꽃이 문주란이우다.\n여름이 오민 하얀 꽃이 피어 섬의 모습이 환해집주.",
      translation: "저 꽃이 문주란입니다.\n여름이 오면 하얀 꽃이 피어 섬의 모습이 환해집니다.",
      location: "관찰 기록 ① · 하얀 문주란꽃"
    }
  },
  ground: {
    player: "섬 전체가 바위인 줄 알았는데 모래도 보여.\n가운데에는 검은 바위 언덕도 있고.",
    response: {
      speaker: "바람새",
      actor: "bird",
      npc: true,
      text: "맞아. 토끼섬은 모래밭과 현무암 언덕이 함께 있는 작은 섬이야.\n이 환경 안에서 문주란이 자연적으로 이어져 온 거지.",
      location: "관찰 기록 ② · 모래와 현무암"
    }
  },
  name: {
    player: "바람 속에서 ‘난들여’라는 글자가 보여!",
    response: {
      speaker: "문정해 삼춘",
      actor: "npc",
      npc: true,
      text: "토끼섬이라 불리기 전부터 하도 사람들이 불러온 이름이우다.\n오래된 이름에도 마을의 기억이 담겨 있수다.",
      translation: "토끼섬이라고 불리기 전부터 하도 사람들이 불러온 이름입니다.\n오래된 이름에도 마을의 기억이 담겨 있습니다.",
      location: "관찰 기록 ③ · 오래된 이름 난들여"
    }
  }
};

let hadoCurrentNode = null;
let hadoNextTarget = null;
let hadoShowingTranslation = false;
let hadoAnswerContinueTarget = null;

function hideHadoInteractionLayers() {
  $("#hado-memory-game").hidden = true;
  $("#hado-answer").hidden = true;
  $("#hado-reward").hidden = true;
}

function setHadoCharacters(node) {
  const bird = $("#hado-guide");
  const npc = $("#hado-npc");
  const visitor = $("#hado-memory-visitor");
  bird.className = "hado-character hado-guide";
  npc.className = "hado-character hado-npc";
  visitor.className = "hado-memory-visitor";
  if (node.actor === "bird") bird.classList.add("is-present", "is-speaking");
  else if (node.bird || node.npc || node.visitor) bird.classList.add("is-present");
  if (node.actor === "npc") npc.classList.add("is-present", "is-speaking");
  else if (node.npc) npc.classList.add("is-present");
  if (node.visitor || node.actor === "visitor") visitor.classList.add("is-present");
  if (node.actor === "visitor") visitor.classList.add("is-speaking");
  bird.setAttribute("aria-hidden", String(!bird.classList.contains("is-present")));
  npc.setAttribute("aria-hidden", String(!npc.classList.contains("is-present")));
  visitor.setAttribute("aria-hidden", String(!visitor.classList.contains("is-present")));
}

function renderHadoSpeakerAvatar(node) {
  const avatar = $("#hado-speaker-avatar");
  const image = $("#hado-speaker-avatar-image");
  let actor = "player";
  if (node.actor === "bird" || node.speaker === "바람새") actor = "bird";
  if (node.actor === "npc" || node.speaker === "문정해 삼춘") actor = "elder";
  if (node.actor === "visitor" || node.speaker === "기억 속 방문자") actor = "visitor";
  avatar.className = `dialogue-avatar is-${actor}`;
  if (actor === "bird") {
    image.src = "/assets/baramsae.png";
    image.hidden = false;
  } else if (actor === "elder") {
    image.src = "/assets/npc-hado.png";
    image.hidden = false;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
  }
}

function renderHadoDialogue(nodeOrId, options = {}) {
  const node = typeof nodeOrId === "string" ? hadoNodes[nodeOrId] : nodeOrId;
  if (!node) return;
  const previous = state.hado.node;
  if (typeof nodeOrId === "string") {
    if (options.recordHistory !== false && previous && previous !== nodeOrId) state.hado.history.push(previous);
    state.hado.node = nodeOrId;
  }
  hadoCurrentNode = node;
  hadoNextTarget = node.next || null;
  hadoShowingTranslation = false;
  hideHadoInteractionLayers();
  setHadoCharacters(node);
  $("#hado-dialogue").hidden = false;
  $("#hado-location-label").textContent = node.location || "하도리 굴동포구";
  $("#hado-speaker").textContent = node.speaker;
  renderHadoSpeakerAvatar(node);
  $("#hado-dialogue-text").textContent = node.text;
  $("#hado-progress-fill").style.width = `${node.progress || 0}%`;
  const translation = $("#hado-translation-toggle");
  translation.hidden = !node.translation;
  translation.textContent = "표준어";
  translation.setAttribute("aria-pressed", "false");

  const choices = $("#hado-choices");
  choices.replaceChildren();
  const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
  choices.hidden = !hasChoices;
  $("#hado-dialogue").classList.toggle("choice-only", hasChoices && !node.next);
  $("#hado-dialogue").classList.toggle("has-choices", hasChoices);
  $("#hado-next").hidden = hasChoices && !node.next;
  $("#hado-next").innerHTML = "계속 <span>→</span>";
  $("#hado-back").disabled = state.hado.history.length === 0 && !node.back;
  if (hasChoices) {
    node.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", () => renderHadoDialogue(choice.next));
      choices.append(button);
    });
  }
}

function startHadoQuest() {
  state.currentQuest = 1;
  state.hado.node = null;
  state.hado.history = [];
  state.hado.observations = new Set();
  state.hado.attempt = 1;
  state.hado.lastEvaluation = null;
  hadoAnswerContinueTarget = null;
  $("#hado-answer-input").value = "";
  $("#hado-char-count").textContent = "0";
  $("#hado-feedback").hidden = true;
  $$("[data-hado-observation]").forEach((button) => button.classList.remove("is-found"));
  $$("[data-hado-record]").forEach((record) => record.classList.remove("is-found"));
  showScreen("hado-screen");
  renderHadoDialogue("arrival", { recordHistory: false });
}

function goBackHadoDialogue() {
  const explicit = hadoCurrentNode?.back;
  if (explicit) {
    const targetIndex = state.hado.history.lastIndexOf(explicit);
    if (targetIndex >= 0) state.hado.history.splice(targetIndex);
    renderHadoDialogue(explicit, { recordHistory: false });
    return;
  }
  const previous = state.hado.history.pop();
  if (previous) renderHadoDialogue(previous, { recordHistory: false });
}

function toggleHadoTranslation() {
  if (!hadoCurrentNode?.translation) return;
  hadoShowingTranslation = !hadoShowingTranslation;
  $("#hado-dialogue-text").textContent = hadoShowingTranslation ? hadoCurrentNode.translation : hadoCurrentNode.text;
  $("#hado-translation-toggle").textContent = hadoShowingTranslation ? "제주어" : "표준어";
  $("#hado-translation-toggle").setAttribute("aria-pressed", String(hadoShowingTranslation));
}

function advanceHado() {
  if (!hadoNextTarget) return;
  if (hadoNextTarget === "__observation_response") {
    return renderHadoDialogue(hadoCurrentNode.observationResponse);
  }
  if (hadoNextTarget === "__observe") {
    if (state.hado.observations.size === 3) renderHadoDialogue("visitor_alert");
    else showHadoObservationGame();
    return;
  }
  if (hadoNextTarget === "__answer") return showHadoAnswer();
  if (hadoNextTarget === "__reward") return showHadoReward();
  if (hadoNextTarget === "__complete") return completeHadoQuest();
  renderHadoDialogue(hadoNextTarget);
}

function showHadoObservationGame() {
  hideHadoInteractionLayers();
  setHadoCharacters({ bird: true, npc: true });
  $("#hado-dialogue").hidden = true;
  $("#hado-memory-game").hidden = false;
  $("#hado-location-label").textContent = "바람 망원경으로 바라본 난들여";
  $("#hado-progress-fill").style.width = `${47 + state.hado.observations.size * 6}%`;
  $("#hado-game-status").textContent = `빛나는 관찰 지점 세 곳을 찾아주세요. ${state.hado.observations.size} / 3`;
}

function selectHadoObservation(button) {
  const id = button.dataset.hadoObservation;
  if (state.hado.observations.has(id)) return;
  const dialogue = hadoObservationDialogues[id];
  if (!dialogue) return;
  state.hado.observations.add(id);
  button.classList.add("is-found");
  $(`[data-hado-record='${id}']`).classList.add("is-found");
  const response = { ...dialogue.response, progress: 48 + state.hado.observations.size * 6, next: "__observe" };
  renderHadoDialogue({
    speaker: "플레이어",
    text: dialogue.player,
    location: dialogue.response.location,
    npc: true,
    progress: 46 + state.hado.observations.size * 6,
    next: "__observation_response"
  });
  hadoNextTarget = "__observation_response";
  hadoCurrentNode.observationResponse = response;
}

function skipHadoMinigame() {
  ['flower', 'ground', 'name'].forEach((id) => {
    state.hado.observations.add(id);
    $(`[data-hado-observation='${id}']`).classList.add('is-found');
    $(`[data-hado-record='${id}']`).classList.add('is-found');
  });
  $('#hado-game-status').textContent = '미니게임을 건너뛰었습니다. 세 가지 관찰 기록을 모두 찾았습니다. 3 / 3';
  setTimeout(() => renderHadoDialogue('visitor_alert'), 180);
}

function showHadoAnswer() {
  hideHadoInteractionLayers();
  setHadoCharacters({ npc: true, visitor: true });
  $("#hado-dialogue").hidden = true;
  $("#hado-answer").hidden = false;
  $("#hado-location-label").textContent = "기억 속 방문자에게 말하기";
  $("#hado-progress-fill").style.width = "80%";
  $("#hado-answer-input").readOnly = false;
  $("#hado-submit").disabled = false;
  $("#hado-submit").classList.remove("is-loading");
  $("#hado-submit span").textContent = "말 건네기";
  $("#hado-submit i").textContent = "→";
  $("#hado-skip-answer").disabled = false;
  $("#hado-demo-fill").disabled = false;
  $("#hado-feedback").hidden = true;
  $("#hado-agent-wind").hidden = true;
  $("#hado-answer-input").focus();
}

function setHadoSubmitting(isSubmitting) {
  $("#hado-answer-input").readOnly = isSubmitting;
  $("#hado-submit").disabled = isSubmitting;
  $("#hado-submit").classList.toggle("is-loading", isSubmitting);
  $("#hado-submit span").textContent = isSubmitting ? "판독 중" : "말 건네기";
  $("#hado-submit i").textContent = isSubmitting ? "…" : "→";
  $("#hado-skip-answer").disabled = isSubmitting;
  $("#hado-demo-fill").disabled = isSubmitting;
}

function showHadoEvaluationStart() {
  $("#hado-agent-wind").hidden = false;
  ["culture", "dialect"].forEach((stage, index) => {
    const item = $(`[data-hado-agent='${stage}']`);
    item.className = index === 0 ? "is-working" : "";
    item.querySelector("small").textContent = index === 0 ? "분석 중" : "대기";
  });
}

function updateHadoEvaluationStage(event) {
  if (event.status !== "completed") return;
  const order = ["culture", "dialect"];
  const index = order.indexOf(event.stage);
  if (index < 0) return;
  const current = $(`[data-hado-agent='${event.stage}']`);
  current.className = "is-reviewed";
  current.querySelector("small").textContent = "검사 완료";
  if (order[index + 1]) {
    const next = $(`[data-hado-agent='${order[index + 1]}']`);
    next.className = "is-working";
    next.querySelector("small").textContent = "분석 중";
  }
}

function showHadoEvaluationResult(data) {
  const dialectSkipped = (data.stages || []).includes("dialect_skipped_due_to_meaning");
  const meaningPassed = ["pass", "retry_dialect"].includes(data.verdict);
  const dialectPassed = data.verdict === "pass";
  const meaning = $("[data-hado-agent='culture']");
  const dialect = $("[data-hado-agent='dialect']");
  meaning.className = meaningPassed ? "is-pass" : "is-retry";
  meaning.querySelector("small").textContent = meaningPassed ? "통과" : "보완 필요";
  dialect.className = dialectSkipped ? "is-skipped" : dialectPassed ? "is-pass" : "is-retry";
  dialect.querySelector("small").textContent = dialectSkipped ? "검사 생략" : dialectPassed ? "통과" : "보완 필요";
}

function showHadoFeedback(data) {
  const dialectOnly = data.verdict === "retry_dialect";
  const meaningOnly = ["retry_knowledge", "retry_relevance"].includes(data.verdict);
  $("#hado-feedback-summary").textContent = dialectOnly
    ? "뜻은 통과했습니다. 제주어 표현을 보완해주세요."
    : meaningOnly
      ? "먼저 방문자에게 전할 보호의 뜻을 보완해주세요."
      : "문장의 뜻과 제주어 표현을 다시 확인해주세요.";
  $("#hado-feedback-detail").textContent = dialectOnly
    ? data.feedback_dialect
    : meaningOnly
      ? data.feedback_knowledge
      : [data.feedback_knowledge, data.feedback_dialect].filter(Boolean).join(" ");
  $("#hado-feedback-hint").textContent = data.hint ? `힌트 · ${data.hint}` : "";
  $("#hado-feedback").hidden = false;
}

function showHadoAnswerContinue() {
  hadoAnswerContinueTarget = "visitor_resolved";
  $("#hado-answer-input").readOnly = true;
  $("#hado-skip-answer").disabled = true;
  $("#hado-demo-fill").disabled = true;
  $("#hado-submit").disabled = false;
  $("#hado-submit").classList.remove("is-loading");
  $("#hado-submit span").textContent = "계속";
  $("#hado-submit i").textContent = "→";
}

async function submitHadoAnswer() {
  const answer = $("#hado-answer-input").value.trim();
  if (!answer) return showToast("방문객에게 전할 제주어 문장을 입력해주세요");
  $("#hado-feedback").hidden = true;
  setHadoSubmitting(true);
  showHadoEvaluationStart();
  try {
    const data = await agentClient.evaluateStream({
      questId: "gujwa_hado_01",
      questionId: "practice_protection_request",
      userAnswer: answer,
      attempt: state.hado.attempt,
      rubricVersion: "1.0",
      onStage: updateHadoEvaluationStage
    });
    state.hado.lastEvaluation = data;
    showHadoEvaluationResult(data);
    if (data.verdict === "pass") {
      showToast("문장의 뜻과 제주어 표현이 모두 자연스럽습니다");
      showHadoAnswerContinue();
      return;
    }
    state.hado.attempt += 1;
    showHadoFeedback(data);
    setHadoSubmitting(false);
    $("#hado-answer-input").focus();
  } catch (error) {
    $("#hado-agent-wind").hidden = true;
    showHadoFeedback({
      verdict: "system_error",
      feedback_knowledge: "Gemini 판정 서버에 연결하지 못했습니다.",
      feedback_dialect: "잠시 후 같은 문장으로 다시 시도해주세요.",
      hint: error.message
    });
    setHadoSubmitting(false);
  }
}

function handleHadoAnswerAction() {
  if (hadoAnswerContinueTarget) {
    const target = hadoAnswerContinueTarget;
    hadoAnswerContinueTarget = null;
    renderHadoDialogue(target);
    return;
  }
  submitHadoAnswer();
}

function skipHadoAnswer() {
  hadoAnswerContinueTarget = null;
  renderHadoDialogue("visitor_resolved");
}

function showHadoReward() {
  hideHadoInteractionLayers();
  setHadoCharacters({});
  $("#hado-dialogue").hidden = true;
  $("#hado-reward").hidden = false;
  $("#hado-progress-fill").style.width = "95%";
}

function continueHadoAfterReward() {
  $("#hado-reward").hidden = true;
  renderHadoDialogue("next_destination");
}

function completeHadoQuest() {
  state.completed.add(1);
  enterGujwa();
  showToast("기억의 흔적 ② · 바람과 모래가 지킨 하얀 꽃 획득 · 동김녕리 해금");
}

const gimnyeongNodes = {
  arrival: { speaker:"플레이어", text:"파도 소리가 가까워졌어.\n여기가 동김녕리 해안이구나!", location:"동김녕리 해안", progress:4, next:"bird_arrival" },
  bird_arrival: { speaker:"바람새", actor:"bird", text:"맞아. 이곳에는 서로 다른 두 바다의 기억이 남아 있어.\n하나는 바다 앞에서 함께 빈 마음, 다른 하나는 그물을 함께 당긴 박자야.", location:"동김녕리 해안", progress:9, next:"player_question" },
  player_question: { speaker:"플레이어", text:"함께 빈 마음과 함께 당긴 박자?\n서로 같은 기억은 아닌 것 같은데?", location:"동김녕리 해안", progress:13, next:"bird_distinction" },
  bird_distinction: { speaker:"바람새", actor:"bird", text:"맞아. 잠수굿은 해녀들이 무사함과 바다의 풍요를 비는 공동체 의례고,\n멜후림소리는 여럿이 멸치 그물을 당기며 주고받던 노동요야.\n서로 다른 문화지만, 혼자가 아니라 함께 바다를 살아온 마음은 닮았지.", location:"두 기억이 머문 해안", progress:19, next:"meet_sundeok" },
  meet_sundeok: { speaker:"바람새", actor:"bird", text:"저기 순덕 삼춘이 계셔.\n제주에서는 여성 어른에게도 친근하고 공경하는 뜻으로 ‘삼춘’이라고 부를 수 있어. 가서 인사해보자!", location:"순덕 삼춘 앞", progress:25, next:"player_greeting" },
  player_greeting: { speaker:"플레이어", text:"순덕 삼춘, 안녕하우꽈?\n바다에 남은 기억을 찾으러 왔어요.", location:"순덕 삼춘 앞", progress:29, next:"sundeok_welcome" },
  sundeok_welcome: { speaker:"순덕 삼춘", actor:"npc", text:"혼저옵서.\n이 바당은 혼자 힘으로 살아온 바당이 아니우다.\n사람들이 같이 빌고, 같이 힘을 모은 기억이 남아 있수다.", translation:"어서 오세요.\n이 바다는 혼자 힘으로 살아온 바다가 아닙니다.\n사람들이 함께 빌고, 함께 힘을 모은 기억이 남아 있습니다.", location:"순덕 삼춘 앞", progress:34, next:"ritual_request" },
  ritual_request: { speaker:"순덕 삼춘", actor:"npc", text:"먼저 잠수굿의 기억이 흐트러졌수다.\n해녀들이 바다 앞에서 함께 빈 두 가지 마음을 찾아줍서.", translation:"먼저 잠수굿의 기억이 흐트러졌습니다.\n해녀들이 바다 앞에서 함께 빈 두 가지 마음을 찾아주세요.", location:"잠수굿의 기억", progress:39, next:"__ritual" },
  ritual_complete: { speaker:"순덕 삼춘", actor:"npc", text:"기치. 해녀들은 물질의 무사함과 해산물의 풍요를 함께 빌었수다.\n잠수굿은 개인의 소원을 비는 일이 아니라 해녀 공동체가 함께 올린 의례우다.", translation:"그렇지요. 해녀들은 물질의 무사함과 해산물의 풍요를 함께 빌었습니다.\n잠수굿은 개인의 소원을 비는 일이 아니라 해녀 공동체가 함께 올린 의례입니다.", location:"되살아난 잠수굿의 기억", progress:54, next:"player_song" },
  player_song: { speaker:"플레이어", text:"이번에는 바람 너머로 여러 사람이 주고받는 소리가 들려.\n이게 멜후림소리의 기억인가 봐!", location:"멜 그물이 놓인 해안", progress:59, next:"bird_song" },
  bird_song: { speaker:"바람새", actor:"bird", text:"한 사람이 소리를 메기면 여러 사람이 받아 부르며 멜 그물을 당겼어.\n노래는 힘든 일을 견디고 서로의 힘과 박자를 맞추는 방법이었지.", location:"멜 그물이 놓인 해안", progress:64, next:"rhythm_request" },
  rhythm_request: { speaker:"순덕 삼춘", actor:"npc", text:"멜후림소리의 박자에 맞춰 세 번만 힘을 모아 당겨봅서.\n혼자 서두르민 그물이 흐트러지고, 함께 맞추민 바다의 기억이 돌아올 거우다.", translation:"멜후림소리의 박자에 맞춰 세 번만 힘을 모아 당겨보세요.\n혼자 서두르면 그물이 흐트러지고, 함께 맞추면 바다의 기억이 돌아올 겁니다.", location:"멜 그물 앞", progress:69, next:"__rhythm" },
  rhythm_complete: { speaker:"플레이어", text:"한 사람이 시작하고 여러 사람이 받아서 함께 당기니까 힘이 모였어!", location:"되살아난 멜후림소리", progress:79, next:"bird_summary" },
  bird_summary: { speaker:"바람새", actor:"bird", text:"맞아. 잠수굿은 안전과 풍요를 함께 빈 의례, 멜후림소리는 함께 그물을 당긴 노동요야.\n이제 두 기억을 잇는 ‘함께하는 마음’을 제주어로 깨워보자.", location:"두 기억이 만난 해안", progress:83, next:"language_guide" },
  language_guide: { speaker:"순덕 삼춘", actor:"npc", text:"마을 사람들에게 같이 모여 멜 그물을 당기자고 외쳐봅서.\n‘멜’, ‘모영’, ‘당겨봅서’를 알맞게 이어보민 됨수다.", translation:"마을 사람들에게 함께 모여 멸치 그물을 당기자고 외쳐보세요.\n‘멜’, ‘모영’, ‘당겨봅서’를 알맞게 이어보면 됩니다.", location:"멜 그물 앞", progress:87, next:"__answer" },
  answer_complete: { speaker:"마을 사람들", actor:"chorus", text:"좋수다! 다 같이 모영 멜 그물을 당겨봅서!\n하나, 둘— 힘을 모읍서!", translation:"좋습니다! 다 같이 모여 멸치 그물을 당겨봅시다!\n하나, 둘— 힘을 모읍시다!", location:"함께 당기는 해안", progress:93, next:"sundeok_close" },
  sundeok_close: { speaker:"순덕 삼춘", actor:"npc", text:"기치. 바당에서 살아온 힘은 혼자 센 힘이 아니라,\n서로의 숨과 박자를 맞춘 힘이우다. 할망의 마지막 흔적이 깨어남수다.", translation:"그렇지요. 바다에서 살아온 힘은 혼자 센 힘이 아니라,\n서로의 숨과 박자를 맞춘 힘입니다. 할망의 마지막 흔적이 깨어납니다.", location:"함께한 바다의 기억", progress:97, next:"__reward" }
};

let gimnyeongNextTarget = null;
let gimnyeongTranslated = false;
let gimnyeongAnswerContinueTarget = null;
let gimRhythmRunning = false;

function setGimnyeongCharacters(node={}) {
  $("#gimnyeong-guide").classList.toggle("is-muted", node.actor !== "bird");
  $("#gimnyeong-npc").classList.toggle("is-muted", node.actor !== "npc");
}
function renderGimnyeongAvatar(node) {
  const avatar=$("#gimnyeong-speaker-avatar"), image=$("#gimnyeong-speaker-avatar-image");
  avatar.className="dialogue-avatar"; image.hidden=false;
  if(node.actor==="bird"){ avatar.classList.add("is-bird"); image.src="/assets/baramsae.png"; }
  else if(node.actor==="npc"){ avatar.classList.add("is-elder"); image.src="/assets/npc-gimnyeong.png"; }
  else if(node.actor==="chorus"){ avatar.classList.add("is-player"); image.hidden=true; }
  else { avatar.classList.add("is-player"); image.hidden=true; }
}
function renderGimnyeongDialogue(id,{push=true}={}) {
  const node=gimnyeongNodes[id]; if(!node) return;
  if(push && state.gimnyeong.node && state.gimnyeong.node!==id) state.gimnyeong.history.push(state.gimnyeong.node);
  state.gimnyeong.node=id; gimnyeongNextTarget=node.next||null; gimnyeongTranslated=false;
  $("#gimnyeong-dialogue").hidden=false; $("#gimnyeong-answer").hidden=true; $("#gimnyeong-ritual-game").hidden=true; $("#gimnyeong-rhythm-game").hidden=true;
  $("#gimnyeong-speaker").textContent=node.speaker; $("#gimnyeong-dialogue-text").textContent=node.text; $("#gimnyeong-location-label").textContent=node.location; $("#gimnyeong-progress-fill").style.width=`${node.progress}%`;
  const toggle=$("#gimnyeong-translation-toggle"); toggle.hidden=!node.translation; toggle.setAttribute("aria-pressed","false"); toggle.textContent="표준어";
  $("#gimnyeong-back").disabled=!state.gimnyeong.history.length; renderGimnyeongAvatar(node); setGimnyeongCharacters(node);
}
function resetGimnyeongQuestUI() {
  state.gimnyeong.node="arrival";
  state.gimnyeong.history=[];
  state.gimnyeong.ritualAnswers=new Set();
  state.gimnyeong.rhythmRound=0;
  state.gimnyeong.rhythmMisses=0;
  state.gimnyeong.attempt=1;
  state.gimnyeong.lastEvaluation=null;
  gimnyeongNextTarget=null;
  gimnyeongTranslated=false;
  gimnyeongAnswerContinueTarget=null;
  gimRhythmRunning=false;
  $("#gimnyeong-reward").hidden=true;
  $("#gimnyeong-answer").hidden=true;
  $("#gimnyeong-ritual-game").hidden=true;
  $("#gimnyeong-rhythm-game").hidden=true;
  $("#gimnyeong-answer-input").value="";
  $("#gimnyeong-char-count").textContent="0";
  $("#gimnyeong-agent-wind").hidden=true;
  $("#gimnyeong-feedback").hidden=true;
  $("#gimnyeong-submit").disabled=false;
  $("#gimnyeong-submit span").textContent="말 건네기";
  $("#gimnyeong-submit i").textContent="→";
  setGimAgentStep("culture","","대기");
  setGimAgentStep("dialect","","대기");
  $(".rhythm-track").classList.remove("is-running");
  $("#gim-net-fill").style.width="0";
  $("#gim-rhythm-count").textContent="0 / 3";
  $("#gim-rhythm-status").textContent="준비되면 버튼을 눌러 박자를 시작하세요.";
  $("#gim-pull-button").disabled=false;
  $("#gimnyeong-ritual-status").textContent="서로 이어지는 기억 두 개를 선택하세요. 0 / 2";
  $$('[data-gim-ritual]').forEach((button)=>{ button.disabled=false; button.classList.remove("is-correct","is-wrong"); });
}
function startGimnyeongQuest(){
  state.currentQuest=2;
  resetGimnyeongQuestUI();
  showScreen("gimnyeong-screen");
  renderGimnyeongDialogue("arrival",{push:false});
}
function advanceGimnyeong(){
  if(!gimnyeongNextTarget)return;
  if(gimnyeongNextTarget==="__ritual") return showGimnyeongRitual();
  if(gimnyeongNextTarget==="__rhythm") return showGimnyeongRhythm();
  if(gimnyeongNextTarget==="__answer") return showGimnyeongAnswer();
  if(gimnyeongNextTarget==="__reward") return showGimnyeongReward();
  renderGimnyeongDialogue(gimnyeongNextTarget);
}
function goBackGimnyeong(){ const prev=state.gimnyeong.history.pop(); if(prev)renderGimnyeongDialogue(prev,{push:false}); }
function toggleGimnyeongTranslation(){ const n=gimnyeongNodes[state.gimnyeong.node]; if(!n?.translation)return; gimnyeongTranslated=!gimnyeongTranslated; $("#gimnyeong-dialogue-text").textContent=gimnyeongTranslated?n.translation:n.text; $("#gimnyeong-translation-toggle").textContent=gimnyeongTranslated?"제주어":"표준어"; $("#gimnyeong-translation-toggle").setAttribute("aria-pressed",String(gimnyeongTranslated)); }
function showGimnyeongRitual(){ $("#gimnyeong-dialogue").hidden=true; setGimnyeongCharacters({}); $("#gimnyeong-ritual-game").hidden=false; $("#gimnyeong-progress-fill").style.width="43%"; }
function selectGimnyeongRitual(button){
  if(button.dataset.correct!=="true"){ button.classList.remove("is-wrong"); void button.offsetWidth; button.classList.add("is-wrong"); $("#gimnyeong-ritual-status").textContent="개인의 바람보다 해녀들이 함께 바란 것을 떠올려보세요."; return; }
  const key=button.dataset.gimRitual; if(state.gimnyeong.ritualAnswers.has(key))return; state.gimnyeong.ritualAnswers.add(key); button.classList.add("is-correct"); button.disabled=true;
  const count=state.gimnyeong.ritualAnswers.size; $("#gimnyeong-ritual-status").textContent=`바다의 공동체 기억을 찾았습니다. ${count} / 2`;
  if(count===2) setTimeout(()=>renderGimnyeongDialogue("ritual_complete"),700);
}
function skipGimnyeongRitual(){
  state.gimnyeong.ritualAnswers=new Set(['safety','abundance']);
  $$('[data-gim-ritual]').forEach((button)=>{
    const correct=button.dataset.correct==='true';
    button.disabled=true;
    button.classList.toggle('is-correct',correct);
    button.classList.remove('is-wrong');
  });
  $('#gimnyeong-ritual-status').textContent='미니게임을 건너뛰었습니다. 공동체의 두 가지 바람을 찾았습니다. 2 / 2';
  setTimeout(()=>renderGimnyeongDialogue('ritual_complete'),180);
}
function showGimnyeongRhythm(){ $("#gimnyeong-dialogue").hidden=true; setGimnyeongCharacters({}); $("#gimnyeong-rhythm-game").hidden=false; $("#gimnyeong-progress-fill").style.width="72%"; startGimRhythm(); }
function startGimRhythm(){ gimRhythmRunning=true; $(".rhythm-track").classList.add("is-running"); $("#gim-rhythm-status").textContent="빛이 가운데 주황색 매듭에 닿을 때 함께 당기세요."; }
function pullGimNet(){
  if(!gimRhythmRunning)return startGimRhythm();
  const track=$(".rhythm-track").getBoundingClientRect(), beat=$("#gim-rhythm-beat").getBoundingClientRect(); const center=beat.left+beat.width/2; const target=track.left+track.width/2; const hit=Math.abs(center-target)<track.width*.13;
  if(!hit){ state.gimnyeong.rhythmMisses++; $("#gim-rhythm-status").textContent="조금 빨랐거나 늦었어요. 서로의 박자를 보고 다시 맞춰보세요."; return; }
  state.gimnyeong.rhythmRound++; const round=state.gimnyeong.rhythmRound; $("#gim-net-fill").style.width=`${round/3*100}%`; $("#gim-rhythm-count").textContent=`${round} / 3`; $("#gim-rhythm-status").textContent=round<3?`박자가 맞았습니다! ${round} / 3 · 한 번 더 함께 당겨보세요.`:"세 번의 힘이 하나로 모였습니다!";
  if(round>=3){ gimRhythmRunning=false; $(".rhythm-track").classList.remove("is-running"); $("#gim-pull-button").disabled=true; setTimeout(()=>renderGimnyeongDialogue("rhythm_complete"),850); }
}
function skipGimnyeongRhythm(){
  gimRhythmRunning=false;
  state.gimnyeong.rhythmRound=3;
  $('.rhythm-track').classList.remove('is-running');
  $('#gim-net-fill').style.width='100%';
  $('#gim-rhythm-count').textContent='3 / 3';
  $('#gim-pull-button').disabled=true;
  $('#gim-rhythm-status').textContent='미니게임을 건너뛰었습니다. 세 번의 힘이 하나로 모였습니다.';
  setTimeout(()=>renderGimnyeongDialogue('rhythm_complete'),180);
}
function showGimnyeongAnswer(){ $("#gimnyeong-dialogue").hidden=true; setGimnyeongCharacters({}); $("#gimnyeong-answer").hidden=false; $("#gimnyeong-answer-input").focus(); $("#gimnyeong-progress-fill").style.width="88%"; gimnyeongAnswerContinueTarget=null; }
function setGimAgentStep(name,mode,label){ const el=$(`[data-gim-agent='${name}']`); el.className=mode?`is-${mode}`:""; el.querySelector("small").textContent=label; }
function setGimSubmitting(active){ $("#gimnyeong-submit").disabled=active; $("#gimnyeong-submit span").textContent=active?"판독 중":"말 건네기"; $("#gimnyeong-submit i").textContent=active?"…":"→"; }
function renderGimEvaluation(data){
  const culturePass=["pass","retry_dialect"].includes(data.verdict), dialectPass=["pass","retry_knowledge"].includes(data.verdict);
  setGimAgentStep("culture",culturePass?"pass":"retry",culturePass?"적합":"보완 필요"); setGimAgentStep("dialect",dialectPass?"pass":"retry",dialectPass?"적합":"보완 필요");
  $("#gimnyeong-feedback").hidden=false; $("#gimnyeong-feedback-summary").textContent=data.verdict==="pass"?"뜻과 제주어 표현이 모두 잘 전달되었습니다.":culturePass?"뜻은 맞습니다. 제주어 표현을 보완해주세요.":"먼저 함께 모여 그물을 당기자는 뜻을 보완해주세요.";
  $("#gimnyeong-feedback-detail").textContent=`${data.feedback_knowledge||""} ${data.feedback_dialect||""}`.trim(); $("#gimnyeong-feedback-hint").textContent=data.hint||"";
}
async function submitGimnyeongAnswer(){
  const answer=$("#gimnyeong-answer-input").value.trim(); if(!answer)return showToast("제주어로 답을 입력해주세요.");
  setGimSubmitting(true); $("#gimnyeong-agent-wind").hidden=false; $("#gimnyeong-feedback").hidden=true; setGimAgentStep("culture","working","분석 중"); setGimAgentStep("dialect","","대기");
  try{
    const data=await agentClient.evaluate({questId:quests[2].id,questionId:quests[2].questionId,userAnswer:answer,attempt:state.gimnyeong.attempt,rubricVersion:"1.0",onProgress:(event)=>{ if(event.stage==="meaning_complete"){setGimAgentStep("culture","reviewed","검토 완료");setGimAgentStep("dialect","working","분석 중");}}});
    renderGimEvaluation(data); $("#gimnyeong-agent-wind").hidden=false;
    if(data.verdict==="pass"){ gimnyeongAnswerContinueTarget="answer_complete"; $("#gimnyeong-submit").disabled=false; $("#gimnyeong-submit span").textContent="계속"; $("#gimnyeong-submit i").textContent="→"; }
    else { state.gimnyeong.attempt++; setGimSubmitting(false); }
  }catch(error){ setGimSubmitting(false); setGimAgentStep("culture","retry","연결 확인"); $("#gimnyeong-feedback").hidden=false; $("#gimnyeong-feedback-summary").textContent="판정 서버 연결을 확인해주세요."; $("#gimnyeong-feedback-detail").textContent=error.message; }
}
function handleGimnyeongSubmit(){ if(gimnyeongAnswerContinueTarget){ $("#gimnyeong-answer").hidden=true; renderGimnyeongDialogue(gimnyeongAnswerContinueTarget); return; } submitGimnyeongAnswer(); }
function skipGimnyeongAnswer(){ $("#gimnyeong-answer").hidden=true; renderGimnyeongDialogue("answer_complete"); }
function showGimnyeongReward(){ $("#gimnyeong-dialogue").hidden=true; setGimnyeongCharacters({}); $("#gimnyeong-reward").hidden=false; $("#gimnyeong-progress-fill").style.width="100%"; }
function completeGimnyeongQuest(){ state.completed.add(2); $("#gimnyeong-reward").hidden=true; showScreen("reward-screen"); }

function loadQuest(index) {
  if (index > state.completed.size) return;
  if (index === 0) {
    startSongdangQuest();
    return;
  }
  if (index === 1) {
    startHadoQuest();
    return;
  }
  if (index === 2) {
    startGimnyeongQuest();
    return;
  }
  state.currentQuest = index;
  const q = quests[index];
  $("#quest-order").textContent = `기억의 흔적 ${index + 1}`;
  $("#quest-location-top").textContent = q.location;
  $("#quest-kicker").textContent = `QUEST 0${index + 1} · ${q.trace}`;
  $("#quest-title").textContent = q.title;
  $("#quest-story").textContent = q.story;
  $("#npc-role").textContent = q.role;
  $("#npc-name").textContent = q.name;
  $("#npc-symbol").textContent = q.symbol;
  $("#line-speaker").textContent = q.name;
  $("#npc-line").textContent = q.line;
  $("#quest-question").textContent = q.question;
  $("#answer-input").value = "";
  $("#char-count").textContent = "0";
  $("#submit-answer").disabled = false;
  $("#evaluation-panel").classList.remove("is-visible");
  $("#evaluation-message").className = "evaluation-message";
  $("#evaluation-details").hidden = true;
  resetPipeline();
  $("#quest-backdrop").style.backgroundImage = `url('${q.sceneAsset}')`;
  $("#quest-backdrop").style.backgroundPosition = q.backgroundPosition;
  const portrait = $("#npc-portrait");
  portrait.style.backgroundImage = `url('${q.npcAsset}')`;
  const img = new Image();
  img.onload = () => portrait.classList.add("has-image");
  img.onerror = () => { portrait.classList.remove("has-image"); portrait.style.backgroundImage = ""; };
  img.src = q.npcAsset;
  setAgentStatus("ready", "Gemini 판별 준비");
  showScreen("quest-screen");
}

function resetPipeline() {
  $$(".pipeline-step").forEach((step) => step.classList.remove("is-running", "is-done", "is-error"));
}

function setAgentStatus(mode, text) {
  const el = $("#agent-status");
  el.className = `agent-status is-${mode}`;
  el.querySelector("span").textContent = text;
}

function animatePipeline() {
  const culture = $("[data-agent='culture']");
  const dialect = $("[data-agent='dialect']");
  const verify = $("[data-agent='verify']");
  culture.classList.add("is-running");
  dialect.classList.add("is-running");
  setTimeout(() => { culture.classList.replace("is-running", "is-done"); dialect.classList.replace("is-running", "is-done"); verify.classList.add("is-running"); }, 850);
}

function setPipelineStep(agent, mode) {
  const step = $(`[data-agent='${agent}']`);
  step.classList.remove("is-running", "is-done", "is-error");
  if (mode) step.classList.add(`is-${mode}`);
}

function markPipelineResult(data) {
  if (data.verdict === "input_rejected") {
    resetPipeline();
    return;
  }
  const culturePassed = ["pass", "retry_dialect"].includes(data.verdict);
  const dialectPassed = ["pass", "retry_knowledge"].includes(data.verdict);
  setPipelineStep("culture", culturePassed ? "done" : "error");
  setPipelineStep("dialect", dialectPassed ? "done" : "error");
  setPipelineStep("verify", ["needs_review", "system_error"].includes(data.verdict) ? "error" : "done");
}

function markPipelineFailure() {
  setPipelineStep("culture", "error");
  setPipelineStep("dialect", "error");
  setPipelineStep("verify", "error");
}

function renderEvaluationDetails(data) {
  const details = $("#evaluation-details");
  const knowledgePassed = ["pass", "retry_dialect"].includes(data.verdict);
  const dialectPassed = ["pass", "retry_knowledge"].includes(data.verdict);
  $("#knowledge-feedback").textContent = data.feedback_knowledge;
  $("#dialect-feedback").textContent = data.feedback_dialect;
  $("#knowledge-result").className = `feedback-item ${knowledgePassed ? "is-pass" : "is-retry"}`;
  $("#dialect-result").className = `feedback-item ${dialectPassed ? "is-pass" : "is-retry"}`;
  const evidence = data.grounding_evidence_ids || [];
  $("#grounding-evidence").textContent = evidence.length
    ? `${data.retrieval_backend || "approved_store"} · ${evidence.join(", ")}`
    : data.verdict === "input_rejected"
      ? "입력 보호 계층에서 Gemini 호출 전 차단"
      : "검증 가능한 근거가 없어 통과하지 않음";
  details.hidden = false;
}

async function submitAnswer() {
  const answer = $("#answer-input").value.trim();
  if (!answer) return showToast("제주어로 답을 입력해주세요.");
  const q = quests[state.currentQuest];
  const button = $("#submit-answer");
  button.disabled = true;
  $("#evaluation-panel").classList.add("is-visible");
  $("#evaluation-message").className = "evaluation-message";
  $("#evaluation-message").textContent = "두 전문 에이전트가 독립적으로 답변을 살펴보고 있습니다…";
  resetPipeline();
  animatePipeline();
  setAgentStatus("working", "Gemini 멀티 에이전트 판별 중");

  try {
    const data = await agentClient.evaluate({
      questId: q.id,
      questionId: q.questionId,
      userAnswer: answer,
      attempt: state.attempts[state.currentQuest],
      rubricVersion: "1.0"
    });
    markPipelineResult(data);
    renderEvaluationDetails(data);
    if (data.verdict === "pass") {
      setAgentStatus("ready", "Gemini 검증 완료");
      $("#evaluation-message").className = "evaluation-message success";
      $("#evaluation-message").textContent = `${q.success} · 문화 ${Math.round(data.knowledge_score * 100)} · 제주어 ${Math.round(data.dialect_score * 100)}`;
      const wasComplete = state.completed.has(state.currentQuest);
      state.completed.add(state.currentQuest);
      const completedGujwa = !wasComplete && state.completed.size === 3;
      setTimeout(() => {
        enterGujwa();
        showToast(`${q.trace} 획득`);
        if (completedGujwa) setTimeout(() => showScreen("reward-screen"), 950);
      }, 1150);
    } else {
      state.attempts[state.currentQuest] += 1;
      setAgentStatus("ready", "힌트와 함께 다시 도전");
      $("#evaluation-message").className = "evaluation-message";
      $("#evaluation-message").textContent = data.hint || `${data.feedback_knowledge} ${data.feedback_dialect}`;
      button.disabled = false;
    }
  } catch (error) {
    markPipelineFailure();
    setAgentStatus("error", "Gemini 연결 확인 필요");
    $("#evaluation-message").className = "evaluation-message error";
    $("#evaluation-message").textContent = `${error.message}. GCP 인증과 Vertex AI 연결을 확인해주세요.`;
    button.disabled = false;
  }
}

function finishGujwa() {
  state.memoryPieces = 1;
  $("#global-piece-count").textContent = "1 / 14";
  updateVisualCounter("#global-piece-visual", state.memoryPieces);
  const nextRegion = $("[data-next-region]");
  const nextLabel = $(`[data-region-label="${nextRegion.dataset.region}"]`);
  nextRegion.setAttribute("aria-disabled", "false");
  nextRegion.classList.remove("is-locked");
  nextRegion.classList.add("region-next");
  nextLabel.classList.remove("is-locked");
  nextLabel.classList.add("region-next");
  nextLabel.querySelector(".lock-icon")?.remove();
  nextLabel.querySelector(".region-state").textContent = "다음 데모 해금";
  $("#island-guide-line").textContent = "두 번째 지역: 조천읍";
  $("#island-guide-detail").textContent = "구좌읍 완료 · 다음 데모에서 계속";
  showScreen("island-screen");
  showToast("새로운 지역의 봉인이 풀리기 시작합니다 · DEMO END");
}

function skipCurrentPoint() {
  const isSongdang = $("#songdang-screen").classList.contains("is-active");
  const isHado = $("#hado-screen").classList.contains("is-active");
  const isGimnyeong = $("#gimnyeong-screen").classList.contains("is-active");
  const isGenericQuest = $("#quest-screen").classList.contains("is-active");
  if (!isSongdang && !isHado && !isGimnyeong && !isGenericQuest) return;

  const index = isSongdang ? 0 : isHado ? 1 : isGimnyeong ? 2 : state.currentQuest;
  const quest = quests[index];
  const wasComplete = state.completed.has(index);
  state.completed.add(index);
  const completedGujwa = !wasComplete && state.completed.size === 3;
  enterGujwa();
  showToast(`${quest.location} 완료 처리 · 다음 지점이 해금되었습니다`);
  if (completedGujwa) setTimeout(() => showScreen("reward-screen"), 950);
}

function resetGujwaProgress() {
  state.completed.clear();
  state.currentQuest = 0;
  state.attempts = [1, 1, 1];
  state.songdang.node = "arrival";
  state.songdang.history = [];
  state.songdang.practice = null;
  state.songdang.offeringIndex = 0;
  state.songdang.lastEvaluation = null;
  state.hado.node = "arrival";
  state.hado.history = [];
  state.hado.observations = new Set();
  state.hado.attempt = 1;
  state.hado.lastEvaluation = null;
  hadoAnswerContinueTarget = null;
  state.gimnyeong.node = "arrival";
  state.gimnyeong.history = [];
  state.gimnyeong.ritualAnswers = new Set();
  state.gimnyeong.rhythmRound = 0;
  state.gimnyeong.rhythmMisses = 0;
  state.gimnyeong.attempt = 1;
  state.gimnyeong.lastEvaluation = null;
  gimnyeongAnswerContinueTarget = null;
  gimRhythmRunning = false;
  $(".rhythm-track")?.classList.remove("is-running");
  $("#gim-net-fill").style.width = "0";
  $("#gim-rhythm-count").textContent = "0 / 3";
  $("#gim-pull-button").disabled = false;
  $$('[data-gim-ritual]').forEach((button) => { button.disabled = false; button.classList.remove("is-correct", "is-wrong"); });
  refreshMap();
  showToast("구좌읍의 세 지점을 처음 상태로 되돌렸습니다");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-showing");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-showing"), 2400);
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "start") showScreen("island-screen");
  if (action === "home" || action === "back-map") showScreen("island-screen");
  if (action === "exit-quest") enterGujwa();
  if (action === "exit-songdang") enterGujwa();
  if (action === "exit-hado") enterGujwa();
  if (action === "exit-gimnyeong") enterGujwa();
  if (action === "skip-current-point") skipCurrentPoint();
  if (action === "reset-gujwa") resetGujwaProgress();
  if (action === "finish-gujwa") finishGujwa();
  const node = event.target.closest("[data-quest-index]");
  if (node) loadQuest(Number(node.dataset.questIndex));
  if (event.target.closest("[data-region='gujwa']")) zoomToGujwa();
  const nextRegion = event.target.closest("[data-next-region]");
  if (nextRegion && !nextRegion.classList.contains("is-locked")) showToast("조천읍이 해금되었습니다 · 다음 데모에서 계속");
  const lockedRegion = event.target.closest(".map-region.is-locked");
  if (lockedRegion) showToast(`${lockedRegion.dataset.regionName}은 아직 잠겨 있습니다`);
});

document.addEventListener("keydown", (event) => {
  const region = event.target.closest?.(".map-region");
  if (!region || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});

$("#answer-input").addEventListener("input", (event) => $("#char-count").textContent = event.target.value.length);
$("#demo-fill").addEventListener("click", () => {
  $("#answer-input").value = quests[state.currentQuest].answer;
  $("#char-count").textContent = quests[state.currentQuest].answer.length;
  $("#answer-input").focus();
});
$("#submit-answer").addEventListener("click", submitAnswer);
$("#songdang-next").addEventListener("click", advanceSongdang);
$("#songdang-back").addEventListener("click", goBackSongdangDialogue);
$("#songdang-translation-toggle").addEventListener("click", toggleSongdangTranslation);
$("#songdang-answer-input").addEventListener("input", (event) => {
  $("#songdang-char-count").textContent = event.target.value.length;
});
$("#songdang-answer-input").addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (songdangPracticeContinueTarget) {
    const continues = event.key === "ArrowRight" || event.key === "Enter" || event.code === "Space";
    if (!continues || event.shiftKey) return;
    event.preventDefault();
    continueSongdangPractice();
    return;
  }
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  if (!$("#songdang-submit").disabled) submitSongdangAnswer();
});
$("#songdang-demo-fill").addEventListener("click", () => {
  const step = songdangPracticeSteps[state.songdang.practice];
  if (!step) return;
  $("#songdang-answer-input").value = step.example;
  $("#songdang-char-count").textContent = step.example.length;
  $("#songdang-answer-input").focus();
});
$("#songdang-submit").addEventListener("click", handleSongdangPracticeAction);
$("#songdang-skip-practice").addEventListener("click", skipSongdangPractice);
$("#songdang-review-clues").addEventListener("click", showSongdangClueHunt);
$$('[data-clue]').forEach((button) => button.addEventListener("click", () => inspectSongdangClue(button.dataset.clue)));
$$('[data-memory-order]').forEach((button) => button.addEventListener("click", () => selectSongdangMemoryCard(button)));
$$("[data-offering-order]").forEach((button) => button.addEventListener("click", () => selectSongdangOffering(button)));
$("#songdang-skip-minigame").addEventListener("click", skipSongdangMinigame);
$("#songdang-complete").addEventListener("click", continueSongdangAfterReward);
$("#songdang-agent-toggle").addEventListener("click", () => {
  const drawer = $("#songdang-agent-drawer");
  const open = !drawer.classList.contains("is-open");
  drawer.classList.toggle("is-open", open);
  drawer.setAttribute("aria-hidden", String(!open));
  $("#songdang-agent-toggle").setAttribute("aria-expanded", String(open));
});
$("#songdang-agent-close").addEventListener("click", () => {
  $("#songdang-agent-drawer").classList.remove("is-open");
  $("#songdang-agent-drawer").setAttribute("aria-hidden", "true");
  $("#songdang-agent-toggle").setAttribute("aria-expanded", "false");
});

$("#hado-next").addEventListener("click", advanceHado);
$("#hado-back").addEventListener("click", goBackHadoDialogue);
$("#hado-translation-toggle").addEventListener("click", toggleHadoTranslation);
$$('[data-hado-observation]').forEach((button) => {
  button.addEventListener("click", () => selectHadoObservation(button));
});
$("#hado-skip-minigame").addEventListener("click", skipHadoMinigame);
$("#hado-answer-input").addEventListener("input", (event) => {
  $("#hado-char-count").textContent = event.target.value.length;
});
$("#hado-answer-input").addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (hadoAnswerContinueTarget) {
    const continues = event.key === "ArrowRight" || event.key === "Enter" || event.code === "Space";
    if (!continues || event.shiftKey) return;
    event.preventDefault();
    handleHadoAnswerAction();
    return;
  }
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  if (!$("#hado-submit").disabled) submitHadoAnswer();
});
$("#hado-demo-fill").addEventListener("click", () => {
  const example = quests[1].answer;
  $("#hado-answer-input").value = example;
  $("#hado-char-count").textContent = example.length;
  $("#hado-answer-input").focus();
});
$("#hado-submit").addEventListener("click", handleHadoAnswerAction);
$("#hado-skip-answer").addEventListener("click", skipHadoAnswer);
$("#hado-reward-continue").addEventListener("click", continueHadoAfterReward);

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest?.("input, textarea, select")) return;

  const screen = $("#songdang-screen");
  const dialogue = $("#songdang-dialogue");
  if (!screen.classList.contains("is-active") || dialogue.hidden) return;

  if (event.key === "ArrowLeft") {
    if ($("#songdang-back").disabled) return;
    event.preventDefault();
    goBackSongdangDialogue();
    return;
  }

  const movesForward = event.key === "ArrowRight" || event.key === "Enter" || event.code === "Space";
  if (!movesForward || dialogue.classList.contains("choice-only")) return;
  if ((event.key === "Enter" || event.code === "Space") && event.target.closest?.("button, a")) return;
  if ($("#songdang-next").hidden || !songdangNextTarget) return;
  event.preventDefault();
  advanceSongdang();
});

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest?.("input, textarea, select")) return;

  const screen = $("#hado-screen");
  const dialogue = $("#hado-dialogue");
  if (!screen.classList.contains("is-active") || dialogue.hidden) return;

  if (event.key === "ArrowLeft") {
    if ($("#hado-back").disabled) return;
    event.preventDefault();
    goBackHadoDialogue();
    return;
  }

  const movesForward = event.key === "ArrowRight" || event.key === "Enter" || event.code === "Space";
  if (!movesForward || dialogue.classList.contains("choice-only")) return;
  if ((event.key === "Enter" || event.code === "Space") && event.target.closest?.("button, a")) return;
  if ($("#hado-next").hidden || !hadoNextTarget) return;
  event.preventDefault();
  advanceHado();
});

$("#gimnyeong-next").addEventListener("click", advanceGimnyeong);
$("#gimnyeong-back").addEventListener("click", goBackGimnyeong);
$("#gimnyeong-translation-toggle").addEventListener("click", toggleGimnyeongTranslation);
$$('[data-gim-ritual]').forEach((button) => button.addEventListener("click", () => selectGimnyeongRitual(button)));
$("#gimnyeong-skip-ritual").addEventListener("click", skipGimnyeongRitual);
$("#gim-pull-button").addEventListener("click", pullGimNet);
$("#gimnyeong-skip-rhythm").addEventListener("click", skipGimnyeongRhythm);
$("#gimnyeong-answer-input").addEventListener("input", (event) => { $("#gimnyeong-char-count").textContent=event.target.value.length; });
$("#gimnyeong-answer-input").addEventListener("keydown", (event) => {
  if(event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  if(gimnyeongAnswerContinueTarget){ const go=event.key==="ArrowRight"||event.key==="Enter"||event.code==="Space"; if(!go||event.shiftKey)return; event.preventDefault(); handleGimnyeongSubmit(); return; }
  if(event.key!=="Enter"||event.shiftKey)return; event.preventDefault(); if(!$("#gimnyeong-submit").disabled)submitGimnyeongAnswer();
});
$("#gimnyeong-demo-fill").addEventListener("click",()=>{ const text=quests[2].answer; $("#gimnyeong-answer-input").value=text; $("#gimnyeong-char-count").textContent=text.length; $("#gimnyeong-answer-input").focus(); });
$("#gimnyeong-submit").addEventListener("click",handleGimnyeongSubmit);
$("#gimnyeong-skip-answer").addEventListener("click",skipGimnyeongAnswer);
$("#gimnyeong-reward-continue").addEventListener("click",completeGimnyeongQuest);

document.addEventListener("keydown",(event)=>{
  if(event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  const screen=$("#gimnyeong-screen"); if(!screen.classList.contains("is-active"))return;
  if(!$("#gimnyeong-rhythm-game").hidden && event.code==="Space"){ event.preventDefault(); pullGimNet(); return; }
  if(event.target.closest?.("input, textarea, select"))return;
  const dialogue=$("#gimnyeong-dialogue"); if(dialogue.hidden)return;
  if(event.key==="ArrowLeft"){ if($("#gimnyeong-back").disabled)return; event.preventDefault(); goBackGimnyeong(); return; }
  const go=event.key==="ArrowRight"||event.key==="Enter"||event.code==="Space"; if(!go)return;
  if((event.key==="Enter"||event.code==="Space")&&event.target.closest?.("button, a"))return;
  event.preventDefault(); advanceGimnyeong();
});

agentClient.health().then((health) => {
  const status = health.retrieval_backend === "agent_platform_search"
    ? "Gemini · Agent Search 준비"
    : "Gemini 판별 준비";
  setAgentStatus("ready", status);
  $("#songdang-agent-toggle").classList.add("is-ready");
}).catch(() => {
  setAgentStatus("error", "판별 서버 연결 필요");
  $("#songdang-agent-toggle").classList.add("is-error");
});
