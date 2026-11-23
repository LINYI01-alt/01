import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "Server secret OPENAI_API_KEY is not configured." }, 503);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return reply({ error: "A valid Supabase user session is required." }, 401);
  }

  try {
    const body = await req.json();
    const input = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const messages = input
      .filter((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
      .filter((m: any) => m.content.length > 0);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return reply({ error: "Please enter a question." }, 400);
    }

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: "你是一个友好、准确的中文 AI 智能助手。优先使用简体中文回答。对于不确定的信息，明确说明不确定；不要声称已经执行实际未执行的操作。",
        input: messages.map((m: any) => ({
          role: m.role,
          content: [{ type: "input_text", text: m.content }],
        })),
        max_output_tokens: 1200,
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI API error", upstream.status, data?.error?.message || "unknown");
      return reply({ error: "GPT 服务暂时不可用，请检查 API 额度或稍后重试。" }, 502);
    }
    const answer = (data.output || [])
      .flatMap((item: any) => item.content || [])
      .filter((part: any) => part.type === "output_text")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
    if (!answer) return reply({ error: "GPT 没有返回文字，请重试。" }, 502);
    return reply({ answer });
  } catch (error) {
    console.error("ai-companion-chat error", error);
    return reply({ error: "请求处理失败，请稍后重试。" }, 500);
  }
});
