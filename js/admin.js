document.addEventListener("DOMContentLoaded", () => {
  const loginPanel = document.getElementById("loginPanel");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("adminLoginForm");
  const loginMessage = document.getElementById("loginMessage");
  const tableBody = document.getElementById("submissionRows");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const userLabel = document.getElementById("adminUser");
  const filter = document.getElementById("statusFilter");
  let client;

  const setMessage = (node, text, kind = "") => {
    node.textContent = text || "";
    node.className = kind ? `notice ${kind}` : "notice";
  };

  const showDashboard = (user) => {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    userLabel.textContent = user?.email || "已登录管理员";
  };

  const showLogin = () => {
    dashboard.hidden = true;
    loginPanel.hidden = false;
  };

  async function openAdminDashboard(user) {
    const { data: isAdmin, error } = await client.rpc("is_admin");
    if (error || isAdmin !== true) {
      await client.auth.signOut();
      showLogin();
      setMessage(loginMessage, "此账号没有管理员权限，无法进入后台。", "error");
      return false;
    }
    showDashboard(user);
    await loadSubmissions();
    if (typeof window.loadLinyiAdminChats === "function") await window.loadLinyiAdminChats();
    if (typeof window.loadLinyiAiQaLogs === "function") await window.loadLinyiAiQaLogs();
    if (typeof window.loadLinyiVisitorProfiles === "function") await window.loadLinyiVisitorProfiles();
    return true;
  }

  const escapeText = (value) => value == null ? "" : String(value);

  async function loadSubmissions() {
    tableBody.replaceChildren();
    setMessage(dashboardMessage, "正在加载投稿…");
    const selectedStatus = filter.value;
    let query = client
      .from("submissions")
      .select("id,title,category,content,is_anonymous,author_name,contact,status,created_at")
      .order("created_at", { ascending: false });

    if (selectedStatus !== "all") query = query.eq("status", selectedStatus);

    const { data, error } = await query;
    if (error) {
      setMessage(dashboardMessage, `读取失败：${error.message}`, "error");
      return;
    }
    setMessage(dashboardMessage, `共加载 ${data.length} 条记录。`);
    if (!data.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "当前筛选条件下没有投稿。";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    for (const item of data) {
      const tr = document.createElement("tr");
      const titleCell = document.createElement("td");
      const title = document.createElement("strong");
      title.textContent = escapeText(item.title);
      const meta = document.createElement("small");
      meta.textContent = `${item.category || "未分类"} · ${item.is_anonymous ? "匿名" : (item.author_name || "未署名")} · ${new Date(item.created_at).toLocaleString("zh-CN")}`;
      titleCell.append(title, meta);

      const contentCell = document.createElement("td");
      contentCell.textContent = escapeText(item.content);
      contentCell.className = "content-cell";

      const contactCell = document.createElement("td");
      contactCell.textContent = item.contact ? escapeText(item.contact) : "—";

      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = `status status-${item.status}`;
      status.textContent = item.status;
      statusCell.appendChild(status);

      const actionCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "row-actions";
      for (const [label, statusValue, cssClass] of [
        ["通过", "approved", "approve"],
        ["退回", "rejected", "reject"]
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `small-button ${cssClass}`;
        button.textContent = label;
        button.addEventListener("click", () => updateStatus(item.id, statusValue));
        actions.appendChild(button);
      }
      const del = document.createElement("button");
      del.type = "button";
      del.className = "small-button delete";
      del.textContent = "删除";
      del.addEventListener("click", () => deleteSubmission(item.id));
      actions.appendChild(del);
      actionCell.appendChild(actions);

      tr.append(titleCell, contentCell, contactCell, statusCell, actionCell);
      tableBody.appendChild(tr);
    }
  }

  async function updateStatus(id, status) {
    if (!confirm(status === "approved" ? "确认通过这条投稿？" : "确认将这条投稿退回？")) return;
    setMessage(dashboardMessage, "正在保存…");
    const { error } = await client.from("submissions").update({ status }).eq("id", id);
    if (error) {
      setMessage(dashboardMessage, `保存失败：${error.message}`, "error");
      return;
    }
    await loadSubmissions();
  }

  async function deleteSubmission(id) {
    if (!confirm("确定永久删除这条投稿吗？此操作不可撤销。")) return;
    setMessage(dashboardMessage, "正在删除…");
    const { error } = await client.from("submissions").delete().eq("id", id);
    if (error) {
      setMessage(dashboardMessage, `删除失败：${error.message}`, "error");
      return;
    }
    await loadSubmissions();
  }

  try {
    client = window.linyiCreateSupabaseClient();
  } catch (error) {
    setMessage(loginMessage, error.message, "error");
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(loginMessage, "正在登录…");
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(loginMessage, `登录失败：${error.message}`, "error");
      return;
    }
    await openAdminDashboard(data.user);
  });

  document.getElementById("refreshSubmissions").addEventListener("click", loadSubmissions);
  document.getElementById("logoutButton").addEventListener("click", async () => {
    await client.auth.signOut();
    showLogin();
    setMessage(loginMessage, "已退出登录。", "success");
  });
  filter.addEventListener("change", loadSubmissions);

  client.auth.getSession().then(async ({ data }) => {
    if (data.session?.user) {
      await openAdminDashboard(data.session.user);
    } else {
      showLogin();
    }
  });



  // AI 科普问答历史：Edge Function 以 service role 写入，只有已验证管理员能读取/删除。
  const aiQaSection = document.getElementById("aiQaAdminSection");
  if (aiQaSection) {
    const aiQaRows = document.getElementById("aiQaRows");
    const aiQaNotice = document.getElementById("aiQaNotice");
    const setAiQaNotice = (message, kind = "") => {
      aiQaNotice.textContent = message;
      aiQaNotice.className = "notice " + kind;
    };
    async function loadAiQaLogs() {
      setAiQaNotice("正在读取问答记录…");
      aiQaRows.replaceChildren();
      const { data, error } = await client.from("ai_qa_logs")
        .select("id,visitor_id,question,answer,created_at")
        .order("created_at", { ascending: false }).limit(500);
      if (error) { setAiQaNotice("读取失败：" + error.message, "error"); return; }
      if (!data || !data.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td"); td.colSpan = 5; td.textContent = "暂时没有 AI 问答记录。";
        tr.appendChild(td); aiQaRows.appendChild(tr);
      } else data.forEach(item => {
        const tr = document.createElement("tr");
        for (const value of [new Date(item.created_at).toLocaleString("zh-CN"), String(item.visitor_id).slice(0, 8), item.question, item.answer]) {
          const td = document.createElement("td"); td.className = "content-cell"; td.textContent = value || ""; tr.appendChild(td);
        }
        const action = document.createElement("td");
        const del = document.createElement("button"); del.type = "button"; del.className = "small-button delete"; del.textContent = "删除";
        del.addEventListener("click", async () => {
          if (!confirm("确定删除这条 AI 问答记录？")) return;
          const { error: deleteError } = await client.from("ai_qa_logs").delete().eq("id", item.id);
          if (deleteError) { setAiQaNotice("删除失败：" + deleteError.message, "error"); return; }
          await loadAiQaLogs();
        });
        action.appendChild(del); tr.appendChild(action); aiQaRows.appendChild(tr);
      });
      setAiQaNotice("已读取 " + data.length + " 条记录（最多显示最近 500 条）。", "success");
    }
    document.getElementById("refreshAiQa").addEventListener("click", loadAiQaLogs);
    window.loadLinyiAiQaLogs = loadAiQaLogs;
  }

  // 在线交流：管理员查看访客会话并回复
  const chatAdminSection = document.getElementById("chatAdminSection");
  if (chatAdminSection) {
    const list = document.getElementById("chatConversationList");
    const messages = document.getElementById("chatAdminMessages");
    const title = document.getElementById("chatAdminTitle");
    const notice = document.getElementById("chatAdminNotice");
    const replyForm = document.getElementById("chatAdminReplyForm");
    const replyInput = document.getElementById("chatAdminReply");
    const sendReply = document.getElementById("chatAdminSend");
    const closeChat = document.getElementById("chatAdminClose");
    let activeConversation = null;
    let adminChatChannel = null;
    const chatNotice = (text, kind = "") => { notice.textContent = text; notice.className = "notice " + kind; };

    let unreadByConversation = new Map();
    let unreadTotal = 0;
    async function refreshUnreadCounts() {
      const { data, error } = await client.from("chat_messages")
        .select("conversation_id,sender_role,created_at")
        .order("created_at", { ascending: false }).limit(2000);
      if (error) { chatNotice("未读状态读取失败：" + error.message, "error"); return; }
      const latest = new Map();
      (data || []).forEach(message => {
        if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
      });
      unreadByConversation = new Map();
      latest.forEach((message, id) => {
        if (message.sender_role === "visitor") unreadByConversation.set(id, true);
      });
      unreadTotal = unreadByConversation.size;
      const badge = document.getElementById("chatUnreadSummary");
      if (badge) badge.textContent = unreadTotal ? ("有 " + unreadTotal + " 个会话待回复") : "目前没有待回复留言";
    }

    async function loadChatList() {
      const { data, error } = await client.from("chat_conversations")
        .select("id,owner_id,subject,status,created_at,updated_at")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) { chatNotice("会话读取失败：" + error.message, "error"); return; }
      await refreshUnreadCounts();
      list.replaceChildren();
      if (!data || !data.length) {
        const empty = document.createElement("p"); empty.className = "chat-empty";
        empty.textContent = "目前还没有访客留言。"; list.appendChild(empty); return;
      }
      data.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-conversation-item" + (activeConversation?.id === item.id ? " active" : "");
        const subject = document.createElement("strong"); subject.textContent = (item.subject || "网站内容交流") + (unreadByConversation.has(item.id) ? "　● 待回复" : "");
        const meta = document.createElement("small");
        meta.textContent = (item.status === "open" ? "进行中" : "已结束") + " · " + new Date(item.updated_at).toLocaleString("zh-CN");
        button.append(subject, meta);
        button.addEventListener("click", () => selectConversation(item));
        list.appendChild(button);
      });
      chatNotice("已加载 " + data.length + " 个访客会话。");
    }
    async function loadCustomerContext(visitorId) {
      const panel = document.getElementById("chatCustomerContext");
      if (!panel) return;
      panel.replaceChildren();
      if (!visitorId) { panel.textContent = "此会话没有关联客户档案。"; return; }
      const heading = document.createElement("h3"); heading.textContent = "客户历史记录";
      const intro = document.createElement("p"); intro.textContent = "客户编号：" + visitorId;
      panel.append(heading, intro);
      const [profile, ai, pages] = await Promise.all([
        client.from("visitor_profiles").select("classification,visit_count,first_seen,last_seen").eq("id", visitorId).maybeSingle(),
        client.from("ai_qa_logs").select("question,answer,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(20),
        client.from("site_page_views").select("page_path,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(20)
      ]);
      if (profile.error || ai.error || pages.error) {
        const error = document.createElement("p"); error.textContent = "部分客户历史暂时读取失败，请稍后刷新。"; panel.appendChild(error); return;
      }
      const summary = document.createElement("p");
      summary.textContent = profile.data
        ? "访问次数：" + profile.data.visit_count + " · 首次访问：" + new Date(profile.data.first_seen).toLocaleString("zh-CN") + " · 最近访问：" + new Date(profile.data.last_seen).toLocaleString("zh-CN")
        : "暂时没有客户档案摘要。";
      panel.appendChild(summary);
      const aiTitle = document.createElement("h4"); aiTitle.textContent = "最近 AI 问答（最多 20 条）"; panel.appendChild(aiTitle);
      (ai.data || []).forEach(item => {
        const block = document.createElement("p");
        block.textContent = new Date(item.created_at).toLocaleString("zh-CN") + " · 提问：" + item.question + " · AI 回答：" + item.answer;
        panel.appendChild(block);
      });
      if (!(ai.data || []).length) { const empty = document.createElement("p"); empty.textContent = "暂无 AI 问答记录。"; panel.appendChild(empty); }
      const pageTitle = document.createElement("h4"); pageTitle.textContent = "最近访问页面（最多 20 条）"; panel.appendChild(pageTitle);
      (pages.data || []).forEach(item => {
        const line = document.createElement("p"); line.textContent = new Date(item.created_at).toLocaleString("zh-CN") + " · " + item.page_path; panel.appendChild(line);
      });
      if (!(pages.data || []).length) { const empty = document.createElement("p"); empty.textContent = "暂无页面访问记录。"; panel.appendChild(empty); }
    }

    async function loadChatMessages() {
      if (!activeConversation) return;
      const { data, error } = await client.from("chat_messages")
        .select("id,sender_role,content,created_at")
        .eq("conversation_id", activeConversation.id)
        .order("created_at", { ascending: true });
      if (error) { chatNotice("消息读取失败：" + error.message, "error"); return; }
      messages.replaceChildren();
      if (!data || !data.length) {
        const empty = document.createElement("div"); empty.className = "chat-empty"; empty.textContent = "访客尚未发送消息。"; messages.appendChild(empty);
      } else data.forEach(item => {
        const row = document.createElement("div");
        row.className = "chat-message " + (item.sender_role === "admin" ? "from-visitor" : "from-admin");
        const who = document.createElement("small");
        who.textContent = (item.sender_role === "admin" ? "邻伊管理员 · " : "访客 · ") + new Date(item.created_at).toLocaleString("zh-CN");
        const body = document.createElement("p"); body.textContent = item.content;
        row.append(who, body); messages.appendChild(row);
      });
      messages.scrollTop = messages.scrollHeight;
    }
    async function selectConversation(item) {
      activeConversation = item;
      title.textContent = (item.subject || "网站内容交流") + (item.status === "open" ? " · 进行中" : " · 已结束");
      replyForm.hidden = item.status !== "open";
      await loadChatList(); await loadChatMessages();
      await loadCustomerContext(item.owner_id);
    }
    document.getElementById("refreshChats").addEventListener("click", async () => { await loadChatList(); if (activeConversation) { await loadChatMessages(); await loadCustomerContext(activeConversation.owner_id); } });
    replyForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!activeConversation || activeConversation.status !== "open") return;
      const content = replyInput.value.trim(); if (!content) return;
      sendReply.disabled = true; chatNotice("正在发送回复…");
      const { data: sessionData } = await client.auth.getSession();
      const { error } = await client.from("chat_messages").insert({
        conversation_id: activeConversation.id,
        sender_id: sessionData.session.user.id,
        sender_role: "admin",
        content
      });
      sendReply.disabled = false;
      if (error) { chatNotice("回复失败：" + error.message, "error"); return; }
      replyInput.value = ""; await loadChatMessages(); await loadChatList();
      chatNotice("回复已发送。", "success");
    });
    closeChat.addEventListener("click", async () => {
      if (!activeConversation || !confirm("确认结束这个访客会话？")) return;
      const { error } = await client.from("chat_conversations").update({ status: "closed" }).eq("id", activeConversation.id);
      if (error) { chatNotice("结束会话失败：" + error.message, "error"); return; }
      activeConversation.status = "closed";
      replyForm.hidden = true;
      title.textContent = (activeConversation.subject || "网站内容交流") + " · 已结束";
      await loadChatList(); chatNotice("会话已结束。", "success");
    });
    let chatAdminStarted = false;
    window.loadLinyiAdminChats = async function () {
      if (chatAdminStarted) return;
      chatAdminStarted = true;
      await loadChatList();
      adminChatChannel = client.channel("admin-chat-updates")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async payload => {
          await loadChatList();
          if (activeConversation && payload.new.conversation_id === activeConversation.id) await loadChatMessages();
        })
.subscribe();
      window.setInterval(async () => {
        if (document.visibilityState === "visible") {
          await loadChatList();
          if (activeConversation) await loadChatMessages();
        }
      }, 30000);
    };
  }


  // Unified visitor profiles and cross-channel activity timeline.
  const visitorProfilesSection = document.getElementById("visitorProfilesSection");
  if (visitorProfilesSection) {
    const rows = document.getElementById("visitorProfileRows");
    const notice = document.getElementById("visitorProfilesNotice");
    const timelinePanel = document.getElementById("visitorTimelinePanel");
    const timelineTitle = document.getElementById("visitorTimelineTitle");
    const timeline = document.getElementById("visitorTimeline");
    const labelFor = value => ({ new: "新客户", casual: "流动客户", returning: "回访老客户", regular: "常客" }[value] || value || "未分类");
    const dateText = value => value ? new Date(value).toLocaleString("zh-CN") : "—";

    async function loadVisitorProfiles() {
      notice.textContent = "正在加载客户档案…";
      rows.replaceChildren();
      const { data, error } = await client.from("visitor_profiles")
        .select("id,classification,visit_count,first_seen,last_seen")
        .order("last_seen", { ascending: false }).limit(200);
      if (error) { notice.textContent = "读取失败：" + error.message; return; }
      (data || []).forEach(profile => {
        const tr = document.createElement("tr");
        for (const value of [profile.id, labelFor(profile.classification), profile.visit_count, dateText(profile.first_seen), dateText(profile.last_seen)]) {
          const td = document.createElement("td"); td.textContent = String(value); tr.appendChild(td);
        }
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button"; button.className = "small-button"; button.textContent = "查看互动记录";
        button.addEventListener("click", () => loadVisitorTimeline(profile));
        action.appendChild(button); tr.appendChild(action); rows.appendChild(tr);
      });
      notice.textContent = "已加载 " + (data || []).length + " 位客户（最多显示最近 200 位）。";
    }

    async function loadVisitorTimeline(profile) {
      timelinePanel.hidden = false;
      timelineTitle.textContent = "客户互动时间线 · " + profile.id;
      timeline.textContent = "正在读取 AI、人工客服和页面访问记录…";
      const [aiResult, chatResult, pageResult] = await Promise.all([
        client.from("ai_qa_logs").select("id,question,answer,created_at").eq("visitor_id", profile.id).order("created_at", { ascending: false }).limit(100),
        client.from("chat_conversations").select("id,subject,status,created_at").eq("owner_id", profile.id).order("created_at", { ascending: false }).limit(100),
        client.from("site_page_views").select("page_path,created_at").eq("visitor_id", profile.id).order("created_at", { ascending: false }).limit(200)
      ]);
      const errors = [aiResult.error, chatResult.error, pageResult.error].filter(Boolean);
      if (errors.length) { timeline.textContent = "部分记录读取失败：" + errors.map(e => e.message).join("；"); return; }
      const conversations = chatResult.data || [];
      let humanMessages = [];
      if (conversations.length) {
        const messageResult = await client.from("chat_messages")
          .select("conversation_id,sender_role,content,created_at")
          .in("conversation_id", conversations.map(item => item.id))
          .order("created_at", { ascending: false }).limit(300);
        if (messageResult.error) { timeline.textContent = "人工聊天记录读取失败：" + messageResult.error.message; return; }
        humanMessages = messageResult.data || [];
      }
      const items = [];
      (aiResult.data || []).forEach(item => {
        items.push({ at: item.created_at, type: "AI 问答", content: "访客：" + item.question + "\nAI：" + item.answer });
      });
      humanMessages.forEach(item => {
        items.push({ at: item.created_at, type: item.sender_role === "visitor" ? "人工留言 · 客户" : "人工回复 · 管理员", content: item.content });
      });
      (pageResult.data || []).forEach(item => items.push({ at: item.created_at, type: "页面访问", content: item.page_path }));
      items.sort((a, b) => new Date(b.at) - new Date(a.at));
      const table = document.createElement("table"); table.className = "admin-table";
      const head = document.createElement("thead"); const headRow = document.createElement("tr");
      ["时间", "类型", "内容"].forEach(value => { const th = document.createElement("th"); th.textContent = value; headRow.appendChild(th); });
      head.appendChild(headRow); table.appendChild(head);
      const body = document.createElement("tbody");
      items.forEach(item => {
        const tr = document.createElement("tr");
        for (const value of [dateText(item.at), item.type, item.content]) {
          const td = document.createElement("td"); td.className = "content-cell"; td.textContent = value; tr.appendChild(td);
        }
        body.appendChild(tr);
      });
      if (!items.length) {
        const tr = document.createElement("tr"); const td = document.createElement("td");
        td.colSpan = 3; td.textContent = "该客户暂时没有已关联的 AI、人工客服或页面访问记录。";
        tr.appendChild(td); body.appendChild(tr);
      }
      table.appendChild(body); timeline.replaceChildren(table);
    }

    document.getElementById("refreshVisitorProfiles").addEventListener("click", loadVisitorProfiles);
    window.loadLinyiVisitorProfiles = loadVisitorProfiles;
  }

});
