import assert from "node:assert/strict";

await import("../web/agent-api.js");

const requests = [];
const fetchImpl = async (url, options) => {
  requests.push({ url, options });
  const body = options.body ? JSON.parse(options.body) : null;
  if (url.endsWith("/api/health")) {
    return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
  }
  if (url.endsWith("/api/evaluate-stream")) {
    const encoder = new TextEncoder();
    const lines = [
      { type: "stage", stage: "culture", status: "working" },
      { type: "stage", stage: "culture", status: "completed" },
      { type: "stage", stage: "dialect", status: "completed" },
      { type: "stage", stage: "verify", status: "completed" },
      {
        type: "result",
        data: {
          verdict: "pass",
          knowledge_score: 1,
          dialect_score: 1,
          feedback_knowledge: "문화 지식 통과",
          feedback_dialect: "제주어 통과",
          trace_id: "ui-stream-contract-test"
        }
      }
    ];
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(lines.map((line) => JSON.stringify(line)).join("\n") + "\n"));
          controller.close();
        }
      })
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      verdict: "retry_dialect",
      knowledge_score: 1,
      dialect_score: 0,
      feedback_knowledge: "문화 지식 통과",
      feedback_dialect: "제주어 보완 필요",
      hint_id: "SONG_DIALECT_01",
      hint: "제주어 종결 표현을 사용해보세요.",
      trace_id: "ui-contract-test",
      grounding_evidence_ids: ["songdang_01"],
      request_echo: body
    })
  };
};

const client = globalThis.JejuAgentAPI.createClient({ fetchImpl, timeoutMs: 1000 });
await client.health();
const result = await client.evaluate({
  questId: "gujwa_songdang_01",
  questionId: "community_reason",
  userAnswer: "  마을 사람들이 함께 안녕을 빌었습니다.  ",
  attempt: 2
});

assert.equal(result.verdict, "retry_dialect");
assert.deepEqual(result.grounding_evidence_ids, ["songdang_01"]);
assert.equal(requests[0].url, "/api/health");
assert.equal(requests[1].url, "/api/evaluate");
assert.deepEqual(result.request_echo, {
  quest_id: "gujwa_songdang_01",
  question_id: "community_reason",
  user_answer: "마을 사람들이 함께 안녕을 빌었습니다.",
  attempt: 2,
  rubric_version: "1.0"
});

const stageEvents = [];
const streamResult = await client.evaluateStream({
  questId: "gujwa_songdang_01",
  questionId: "community_reason",
  userAnswer: "마을의 안녕을 빌젠 모영 이어온 거우다.",
  onStage: (event) => stageEvents.push(`${event.stage}:${event.status}`)
});

assert.equal(streamResult.verdict, "pass");
assert.deepEqual(stageEvents, [
  "culture:working",
  "culture:completed",
  "dialect:completed",
  "verify:completed"
]);
assert.equal(requests[2].url, "/api/evaluate-stream");

console.log("UI agent API contract passed");
