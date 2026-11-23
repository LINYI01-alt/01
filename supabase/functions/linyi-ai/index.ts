import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://linyi01-alt.github.io", "https://lingyi0011.com", "http://lingyi0011.com"]);
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://linyi01-alt.github.io", "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const aihubmixKey = Deno.env.get("AIHUBMIX_API_KEY");
const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function hashIp(ip: string) {
  const bytes = new TextEncoder().encode(ip + (Deno.env.get("SUPABASE_DB_URL") || supabaseUrl));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("请先登录管理员账号。");
  const { data, error } = await adminClient.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new Error("管理员登录已失效，请重新登录。");
  const { data: admin, error: adminError } = await adminClient.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (adminError || !admin) throw new Error("没有管理员权限。");
  return data.user;
}
async function askOpenAI(messages: Array<{role: string; content: string}>, system: string) {
  if (!aihubmixKey) throw new Error("服务器尚未读取到 AIHUBMIX_API_KEY，请检查 Supabase Secrets。");
  const normalized: Array<{role: "user" | "assistant"; content: string}> = [];
  for (const item of messages.slice(-8)) {
    if (!item || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") continue;
    const content = item.content.trim().slice(0, 2000);
    if (!content) continue;
    const previous = normalized[normalized.length - 1];
    if (previous && previous.role === item.role) previous.content += "\n" + content;
    else normalized.push({ role: item.role, content });
  }
  while (normalized.length && normalized[0].role !== "user") normalized.shift();
  if (!normalized.length) throw new Error("请重新输入你的问题。");
  async function request(messagesToSend: Array<{role: "user" | "assistant"; content: string}>) {
    const response = await fetch("https://aihubmix.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aihubmixKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "system", content: system }, ...messagesToSend], max_completion_tokens: 1800 }),
    });
    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    return { response, data };
  }
  let result = await request(normalized);
  if (result.response.status === 400 && normalized.length > 1) {
    const latestUser = [...normalized].reverse().find(item => item.role === "user");
    if (latestUser) result = await request([latestUser]);
  }
  if (!result.response.ok) {
    console.error("AI provider request failed", { status: result.response.status, message: result.data?.error?.message || result.data?.message || "No provider error message", historyCount: normalized.length });
    throw new Error("AI 服务暂时无法处理这次提问（上游 HTTP " + result.response.status + "）。请重试或换一种问法。");
  }
  const content = result.data?.choices?.[0]?.message?.content;
  const output = typeof content === "string" ? content : Array.isArray(content) ? content.filter((c: any) => c.type === "text" && typeof c.text === "string").map((c: any) => c.text).join("\n") : "";
  if (!output) throw new Error("AI 没有返回有效内容，请稍后重试。");
  return output;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "chat") {
      const authorization = req.headers.get("Authorization") || "";
      const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!bearer) return json(req, { error: "访客身份验证失败，请刷新页面重试。" }, 401);
      const { data: authData, error: authError } = await adminClient.auth.getUser(bearer);
      if (authError || !authData.user) return json(req, { error: "访客登录已失效，请刷新页面重试。" }, 401);
      const visitorId = authData.user.id;
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const { data: allowed, error: limitError } = await adminClient.rpc("consume_ai_rate_limit", { p_ip_hash: await hashIp(ip), p_limit: 20, p_window_seconds: 900 });
      if (limitError) throw new Error("问答服务暂时不可用，请稍后重试。");
      if (!allowed) return json(req, { error: "提问次数较多，请 15 分钟后再试。" }, 429);
      const supplied = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      const lastUser = [...supplied].reverse().find((m: any) => m?.role === "user" && typeof m.content === "string");
      const question = typeof body.question === "string" ? body.question.trim() : String(lastUser?.content || "").trim();
      if (!question || question.length > 2000) return json(req, { error: "请提供有效的问题内容。" }, 400);
      const { error: profileError } = await adminClient.from("visitor_profiles").upsert({ id: visitorId }, { onConflict: "id", ignoreDuplicates: true });
      if (profileError) throw new Error("访客档案暂时无法建立，请稍后重试。");
      let conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
      if (conversationId) {
        const { data: owned, error: ownedError } = await adminClient.from("ai_conversations").select("id").eq("id", conversationId).eq("visitor_id", visitorId).maybeSingle();
        if (ownedError || !owned) return json(req, { error: "对话不存在或无权访问，请新建对话重试。" }, 403);
      } else {
        const { data: created, error: createError } = await adminClient.from("ai_conversations").insert({ visitor_id: visitorId, title: question.slice(0, 80) }).select("id").single();
        if (createError || !created) throw new Error("无法创建 AI 对话，请稍后重试。");
        conversationId = created.id;
      }
      const { data: previous, error: historyError } = await adminClient.from("ai_qa_logs").select("question,answer").eq("visitor_id", visitorId).eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(8);
      if (historyError) throw new Error("暂时无法读取历史对话，请稍后重试。");
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const item of previous || []) { messages.push({ role: "user", content: String(item.question).slice(0, 2000) }); messages.push({ role: "assistant", content: String(item.answer).slice(0, 12000) }); }
      messages.push({ role: "user", content: question });
      const answer = await askOpenAI(messages, "你是邻伊网站的生育与辅助生殖科普助手。无论访客使用何种语言，始终使用简体中文回答；只有明确要求翻译或英语练习时才提供其他语言。表达温和清楚。不得诊断、开药、制定治疗方案或保证结果；涉及个人检查报告、症状、用药或治疗决策时，建议咨询正规医疗机构专业人员。不要索取姓名、联系方式或身份证信息。");
      const { error: logError } = await adminClient.from("ai_qa_logs").insert({ visitor_id: visitorId, conversation_id: conversationId, question, answer: answer.slice(0, 12000) });
      if (logError) console.error("AI QA log insert failed", { code: logError.code, message: logError.message });
      await adminClient.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
      return json(req, { answer, conversation_id: conversationId });
    }
    if (action === "generate_article") {
      const user = await requireAdmin(req);
      const topic = String(body.topic || "").trim().slice(0, 300);
      if (!topic) return json(req, { error: "请填写文章主题。" }, 400);
      const draftText = await askOpenAI([{ role: "user", content: `请围绕以下主题写一篇面向普通读者的中文科普文章：${topic}。请输出严格 JSON，字段为 title、summary、category、content。content 使用 Markdown，内容客观准确易懂，明确说明不是医疗诊断或治疗建议；不得编造研究、统计数字或参考文献。` }], "你是严谨的健康科普编辑。只输出合法 JSON，不要代码围栏。");
      let article;
      try { article = JSON.parse(draftText.replace(/^```json\s*/i, "").replace(/\s*```$/, "")); }
      catch { throw new Error("AI 返回格式不正确，请重新生成。"); }
      if (!article.title || !article.content) throw new Error("AI 生成的文章缺少标题或正文。");
      const { data, error } = await adminClient.from("ai_article_drafts").insert({
        title: String(article.title).slice(0, 200), summary: String(article.summary || "").slice(0, 500),
        category: String(article.category || "科普").slice(0, 80), content: String(article.content).slice(0, 30000),
        status: "draft", created_by: user.id,
      }).select("id,title,summary,category,content,status,created_at").single();
      if (error) throw error;
      return json(req, { draft: data });
    }
    return json(req, { error: "不支持的操作。" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器错误。";
    return json(req, { error: message }, /登录|管理员权限|身份验证/.test(message) ? 401 : 400);
  }
});