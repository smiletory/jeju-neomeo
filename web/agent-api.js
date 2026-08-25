(function exposeJejuAgentApi(global) {
  "use strict";

  const allowedVerdicts = new Set([
    "pass",
    "retry_relevance",
    "retry_knowledge",
    "retry_dialect",
    "retry_both",
    "needs_review",
    "input_rejected",
    "system_error"
  ]);

  class AgentApiError extends Error {
    constructor(message, { status = 0, code = "agent_api_error" } = {}) {
      super(message);
      this.name = "AgentApiError";
      this.status = status;
      this.code = code;
    }
  }

  class AgentEvaluationClient {
    constructor({ baseUrl = "", timeoutMs = 120000, fetchImpl = global.fetch.bind(global) } = {}) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
      this.timeoutMs = timeoutMs;
      this.fetchImpl = fetchImpl;
    }

    async request(path, options = {}) {
      const controller = new AbortController();
      const timeout = global.setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...options,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
          }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new AgentApiError(data?.detail || `판별 서버가 ${response.status} 오류를 반환했습니다.`, {
            status: response.status,
            code: "http_error"
          });
        }
        return data;
      } catch (error) {
        if (error instanceof AgentApiError) throw error;
        if (error.name === "AbortError") {
          throw new AgentApiError("Gemini 판별 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.", {
            code: "timeout"
          });
        }
        throw new AgentApiError("판별 서버에 연결할 수 없습니다.", { code: "network_error" });
      } finally {
        global.clearTimeout(timeout);
      }
    }

    async health() {
      return this.request("/api/health", { method: "GET", headers: {} });
    }

    async evaluate({ questId, questionId, userAnswer, attempt = 1, rubricVersion = "1.0" }) {
      if (!questId || !userAnswer?.trim()) {
        throw new AgentApiError("퀘스트 ID와 답변이 필요합니다.", { code: "invalid_request" });
      }

      const result = await this.request("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({
          quest_id: questId,
          question_id: questionId || null,
          user_answer: userAnswer.trim(),
          attempt,
          rubric_version: rubricVersion
        })
      });

      if (!allowedVerdicts.has(result?.verdict) || typeof result?.trace_id !== "string") {
        throw new AgentApiError("판별 결과 형식이 올바르지 않습니다.", { code: "invalid_response" });
      }
      return result;
    }

    async evaluateStream({ questId, questionId, userAnswer, attempt = 1, rubricVersion = "1.0", onStage = null }) {
      if (!questId || !userAnswer?.trim()) {
        throw new AgentApiError("퀘스트 ID와 답변이 필요합니다.", { code: "invalid_request" });
      }

      const controller = new AbortController();
      const timeout = global.setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/api/evaluate-stream`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quest_id: questId,
            question_id: questionId || null,
            user_answer: userAnswer.trim(),
            attempt,
            rubric_version: rubricVersion
          })
        });
        if (!response.ok || !response.body) {
          const data = await response.json?.().catch(() => null);
          throw new AgentApiError(data?.detail || `단계별 판별 서버가 ${response.status} 오류를 반환했습니다.`, {
            status: response.status,
            code: "stream_http_error"
          });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result = null;

        const handleLine = async (line) => {
          if (!line.trim()) return;
          const event = JSON.parse(line);
          if (event.type === "stage") {
            if (onStage) await onStage(event);
            return;
          }
          if (event.type === "error") {
            throw new AgentApiError(event.detail || "단계별 판정을 완료하지 못했습니다.", {
              status: event.status || 0,
              code: "stream_error"
            });
          }
          if (event.type === "result") result = event.data;
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) await handleLine(line);
          if (done) break;
        }
        if (buffer) await handleLine(buffer);
        if (!allowedVerdicts.has(result?.verdict) || typeof result?.trace_id !== "string") {
          throw new AgentApiError("단계별 판별 결과 형식이 올바르지 않습니다.", { code: "invalid_response" });
        }
        return result;
      } catch (error) {
        if (error instanceof AgentApiError) throw error;
        if (error.name === "AbortError") {
          throw new AgentApiError("Gemini 판별 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.", {
            code: "timeout"
          });
        }
        throw new AgentApiError("단계별 판별 서버에 연결할 수 없습니다.", { code: "network_error" });
      } finally {
        global.clearTimeout(timeout);
      }
    }
  }

  global.JejuAgentAPI = Object.freeze({
    AgentApiError,
    AgentEvaluationClient,
    createClient: (options) => new AgentEvaluationClient(options)
  });
})(globalThis);
