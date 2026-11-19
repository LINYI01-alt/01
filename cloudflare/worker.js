/**
 * 邻伊 Cloudflare Workers AI 网关
 * 部署时在 Cloudflare Worker Settings > Bindings 添加 Workers AI binding：
 * Variable name: AI
 * Model: @cf/zai-org/glm-4.7-flash
 */
const ALLOWED_ORIGIN = "https://linyi01-alt.github.io";
const MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 10;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403, headers });
      return new Response(null, { status: 204, headers });
    }
    if (origin !== ALLOWED_ORIGIN) {
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
      return json({ error: "AI 服务尚未完成配置，请稍后重试。" }, 503, headers);
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

      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "你是邻伊网站的中文生育健康与辅助生殖知识科普助手。只提供一般性、非个体化的知识解释，表达清楚、谨慎、友善。不得诊断疾病、解读个人检查报告、预测个人妊娠或治疗成功率、制定促排或治疗方案、推荐处方药或给出用药剂量。遇到个人症状、检查数值、病历或治疗决策问题，说明应咨询正规医疗机构的专业人员，并可解释相关一般概念。不要索取姓名、电话、身份证号、病历或其他敏感个人信息。回答末尾在适当时提醒内容仅供科普参考，不构成医疗建议。"
          },
          ...messages
        ],
        max_tokens: 512,
        temperature: 0.4
      });

      // GLM-4.7-Flash may return an OpenAI-compatible chat completion:
      // { choices: [{ message: { content: "..." } }] }.
      // Keep compatibility with other Workers AI response shapes too.
      let answer = "";
      if (typeof result === "string") {
        answer = result;
      } else if (result && Array.isArray(result.choices)) {
        const content = result.choices[0]?.message?.content;
        answer = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map(part => part?.text || "").join("")
            : "";
      } else if (result) {
        answer = result.response || result.result || result.output_text || "";
      }
      if (!answer) {
        return json({ error: "暂时没有得到回答，请稍后重试。" }, 503, headers);
      }
      return json({ answer: String(answer).slice(0, 12000) }, 200, headers);
    } catch (error) {
      const message = String(error && error.message || "");
      const quota = /quota|limit|neurons|billing|exceed/i.test(message);
      return json({
        error: quota
          ? "今日免费 AI 使用额度可能已用完，请等待额度重置后再试。不会自动切换到付费服务。"
          : "AI 服务暂时不可用，请稍后重试。"
      }, quota ? 429 : 503, headers);
    }
  }
};
