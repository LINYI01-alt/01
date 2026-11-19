/**
 * 邻伊 Cloudflare Workers AI 网关
 * 绑定要求：Workers AI binding，变量名 AI。
 */
const ALLOWED_ORIGIN = "https://linyi01-alt.github.io";
const MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 10;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

function extractAnswer(result) {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";

  const choice = Array.isArray(result.choices) ? result.choices[0] : null;
  const message = choice && choice.message;
  const content = message && message.content;

  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map(part => typeof part?.text === "string" ? part.text : "").join("").trim();
    if (text) return text;
  }

  // Compatibility with non-OpenAI Workers AI response shapes.
  for (const candidate of [result.response, result.result, result.output_text]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const headers = corsHeaders(origin);

    // Log metadata only; never log visitor prompts or personal information.
    console.log(JSON.stringify({
      event: "request_received",
      method: request.method,
      path: url.pathname,
      origin: origin || "(none)",
      aiBindingAvailable: !!(env.AI && typeof env.AI.run === "function")
    }));

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) {
        console.warn("cors_rejected", { origin: origin || "(none)" });
        return new Response(null, { status: 403, headers });
      }
      return new Response(null, { status: 204, headers });
    }

    // A lightweight endpoint to verify that this exact Worker deployment is reachable.
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "请求来源不受支持。" }, 403, headers);
      return json({ ok: true, service: "linyi-ai-gateway", model: MODEL }, 200, headers);
    }

    if (origin !== ALLOWED_ORIGIN) {
      console.warn("cors_rejected", { origin: origin || "(none)" });
      return json({ error: "请求来源不受支持。" }, 403, headers);
    }
    if (request.method !== "POST") {
      return json({ error: "仅支持 POST 请求。" }, 405, headers);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return json({ error: "请求内容过大，请缩短问题后重试。" }, 413, headers);
    }
    if (!env.AI || typeof env.AI.run !== "function") {
      console.error("ai_binding_missing: expected Workers AI binding named AI");
      return json({ error: "AI 服务尚未完成配置：请检查 Worker 的 Workers AI 绑定名称是否为 AI。" }, 503, headers);
    }

    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return json({ error: "请求内容过大，请缩短问题后重试。" }, 413, headers);
      }

      const body = JSON.parse(raw);
      if (!body || body.action !== "chat" || !Array.isArray(body.messages)) {
        return json({ error: "请求格式不正确。" }, 400, headers);
      }

      const messages = body.messages
        .filter(item => item && (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" && item.content.trim())
        .slice(-MAX_HISTORY_MESSAGES)
        .map(item => ({
          role: item.role,
          content: item.content.trim().slice(0, MAX_MESSAGE_CHARS)
        }));

      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return json({ error: "请输入一个问题后再发送。" }, 400, headers);
      }

      console.log(JSON.stringify({
        event: "model_call_started",
        model: MODEL,
        messageCount: messages.length
      }));

      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "你是邻伊网站的中文生育健康与辅助生殖知识科普助手。只提供一般性、非个体化的知识解释，表达清楚、谨慎、友善。不得诊断疾病、解读个人检查报告、预测个人妊娠或治疗成功率、制定促排或治疗方案、推荐处方药或给出用药剂量。遇到个人症状、检查数值、病历或治疗决策问题，说明应咨询正规医疗机构的专业人员，并可解释相关一般概念。不要索取姓名、电话、身份证号、病历或其他敏感个人信息。回答末尾在适当时提醒内容仅供科普参考，不构成医疗建议。"
          },
          ...messages
        ],
        // Keep the request close to Cloudflare's documented minimal GLM example.
        // max_completion_tokens is the current parameter; max_tokens is deprecated.
        max_completion_tokens: 768,
        temperature: 0.4
      });

      const answer = extractAnswer(result);
      console.log(JSON.stringify({
        event: "model_call_completed",
        model: MODEL,
        resultType: typeof result,
        resultKeys: result && typeof result === "object" ? Object.keys(result).slice(0, 12) : [],
        choiceCount: Array.isArray(result?.choices) ? result.choices.length : 0,
        answerLength: answer.length
      }));

      if (!answer) {
        console.error("model_empty_answer", {
          resultType: typeof result,
          resultKeys: result && typeof result === "object" ? Object.keys(result).slice(0, 12) : [],
          firstChoiceKeys: result?.choices?.[0]?.message
            ? Object.keys(result.choices[0].message).slice(0, 12)
            : []
        });
        return json({ error: "模型已响应，但没有返回可显示的文本。请稍后重试；若持续发生，请检查 Workers AI 模型调用日志。" }, 502, headers);
      }

      return json({ answer: answer.slice(0, 12000) }, 200, headers);
    } catch (error) {
      const message = String(error && error.message || "Unknown Workers AI error");
      const errorName = String(error?.name || "Error");
      console.error("model_call_failed", {
        name: errorName,
        message: message.slice(0, 500),
        stack: String(error?.stack || "").slice(0, 1200)
      });

      const quota = /quota|daily free allocation|neurons|billing|exceed|account limited/i.test(message);
      const capacity = /capacity|busy|overloaded|temporarily unavailable/i.test(message);
      const status = quota ? 429 : capacity ? 503 : 502;
      const userMessage = quota
        ? "Workers AI 免费额度可能已用完。请等待额度重置；不会切换到付费服务。"
        : capacity
          ? "Workers AI 当前容量不足或暂时不可用，请稍后重试。"
          : "Workers AI 调用失败：" + message.replace(/[\\r\\n]+/g, " ").slice(0, 240);

      return json({
        error: userMessage,
        code: quota ? "AI_QUOTA_LIMIT" : capacity ? "AI_CAPACITY_UNAVAILABLE" : "AI_RUNTIME_ERROR",
        model: MODEL
      }, status, headers);
    }
  }
};
