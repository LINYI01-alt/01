document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("visitorChatForm");
  if (!form) return;
  const notice = document.getElementById("chatNotice");
  const messagesBox = document.getElementById("chatMessages");
  const input = document.getElementById("visitorChatInput");
  const send = document.getElementById("visitorChatSend");
  const count = document.getElementById("chatCharCount");
  const status = document.getElementById("chatStatus");
  let client, conversationId, channel;

  const setNotice = (text, kind = "") => {
    notice.textContent = text;
    notice.className = "chat-notice" + (kind ? " " + kind : "");
  };
  const addBubble = (item) => {
    const row = document.createElement("div");
    row.className = "chat-message " + (item.sender_role === "visitor" ? "from-visitor" : "from-admin");
    const who = document.createElement("small");
    who.textContent = item.sender_role === "visitor" ? "我 · " : "邻伊管理员 · ";
    who.textContent += new Date(item.created_at).toLocaleString("zh-CN");
    const body = document.createElement("p");
    body.textContent = item.content;
    row.append(who, body);
    return row;
  };
  async function loadMessages() {
    const { data, error } = await client.from("chat_messages")
      .select("id,sender_role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) { setNotice("读取消息失败，请刷新页面后重试。", "error"); return; }
    messagesBox.replaceChildren();
    if (!data || !data.length) {
      const empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = "会话已建立。欢迎留言，管理员回复后会显示在这里。";
      messagesBox.appendChild(empty);
    } else data.forEach(item => messagesBox.appendChild(addBubble(item)));
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  input.addEventListener("input", () => { count.textContent = String(input.value.length); });
  try {
    client = window.linyiCreateSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    let user = sessionData.session?.user;
    if (!user) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) {
        console.error("邻伊访客登录失败", { message: error.message, code: error.code, status: error.status });
        const detail = [error.code, error.message].filter(Boolean).join("：");
        throw new Error("访客会话创建失败" + (detail ? "（" + detail + "）" : "。") + "请将此提示发给网站管理员。");
      }
      user = data.user;
    }
    if (!user) throw new Error("暂时无法建立访客会话，请稍后刷新。");
    const { data: existing, error: findError } = await client.from("chat_conversations")
      .select("id,status").eq("owner_id", user.id).eq("status", "open")
      .order("updated_at", { ascending: false }).limit(1);
    if (findError) throw findError;
    if (existing && existing.length) conversationId = existing[0].id;
    else {
      const { data: created, error: createError } = await client.from("chat_conversations")
        .insert({ owner_id: user.id, subject: "网站内容交流" }).select("id").single();
      if (createError) throw createError;
      conversationId = created.id;
    }
    await loadMessages();
    status.textContent = "已连接";
    status.classList.add("is-online");
    setNotice("会话已建立。发送后，管理员可在网站后台查看并回复。", "success");
    channel = client.channel("visitor-chat-" + conversationId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: "conversation_id=eq." + conversationId }, loadMessages)
      .subscribe();
  } catch (error) {
    status.textContent = "暂不可用";
    setNotice(error.message || "在线交流暂时无法连接，请稍后重试。", "error");
    input.disabled = true; send.disabled = true;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    if (content.length > 1200) { setNotice("留言请控制在 1200 字以内。", "error"); return; }
    const hasPhone = /(?:\+?86[- ]?)?1[3-9]\d{9}/.test(content);
    const hasId = /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]\b/.test(content);
    const personalMedical = /(我的|本人|我这边).{0,8}(病历|检查报告|化验单|用药记录|诊断结果|检查结果)/.test(content);
    if (hasPhone || hasId || personalMedical) {
      setNotice("为保护隐私，这条留言未发送。请删除手机号、身份证号及个人病历/检查资料，只保留一般网站或科普内容问题。", "error");
      return;
    }
    send.disabled = true; setNotice("正在发送…");
    const { data: sessionData } = await client.auth.getSession();
    const { error } = await client.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: sessionData.session.user.id,
      sender_role: "visitor",
      content
    });
    send.disabled = false;
    if (error) { setNotice("发送失败，请稍后重试。", "error"); return; }
    input.value = ""; count.textContent = "0";
    await loadMessages();
    setNotice("留言已发送。管理员回复后会显示在本页面。", "success");
  });

  window.addEventListener("beforeunload", () => {
    if (channel) client.removeChannel(channel);
  });
});
