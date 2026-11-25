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
    activateAdminPanel("visitorProfilesSection");
  };

  function activateAdminPanel(panelName) {
    document.querySelectorAll("[data-admin-panel]").forEach(panel => { panel.hidden = panel.dataset.adminPanel !== panelName; });
    document.querySelectorAll("[data-admin-tab]").forEach(button => button.classList.toggle("active", button.dataset.adminTab === panelName));
  }

  document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => activateAdminPanel(button.dataset.adminTab)));

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
    const pendingStat = document.getElementById("statPending");
    if (pendingStat) {
      const { count, error: countError } = await client.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingStat.textContent = countError ? "—" : String(count ?? 0);
    }
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
        const td = document.createElement("td"); td.colSpan = 4; td.textContent = "暂时没有 AI 问答记录。";
        tr.appendChild(td); aiQaRows.appendChild(tr);
      } else data.forEach(item => {
        const tr = document.createElement("tr");
        for (const value of [String(item.visitor_id || "").slice(0, 5), new Date(item.created_at).toLocaleString("zh-CN"), "客户提问：\n" + (item.question || "") + "\n\n邻伊 AI 回答：\n" + (item.answer || "")]) {
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
    let pendingByConversation = new Map();
    let unreadTotal = 0;
    async function refreshUnreadCounts(conversations) {
      const { data, error } = await client.from("chat_messages")
        .select("conversation_id,sender_role,created_at")
        .in("sender_role", ["visitor", "admin"])
        .order("created_at", { ascending: false }).limit(2000);
      if (error) { chatNotice("未读状态读取失败：" + error.message, "error"); return; }
      const latest = new Map();
      const latestVisitor = new Map();
      (data || []).forEach(message => {
        if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
        if (message.sender_role === "visitor" && !latestVisitor.has(message.conversation_id)) latestVisitor.set(message.conversation_id, message);
      });
      unreadByConversation = new Map();
      pendingByConversation = new Map();
      (conversations || []).forEach(conversation => {
        const lastMessage = latest.get(conversation.id);
        const lastVisitorMessage = latestVisitor.get(conversation.id);
        if (lastMessage?.sender_role === "visitor") pendingByConversation.set(conversation.id, true);
        if (lastVisitorMessage && (!conversation.admin_last_read_at || new Date(lastVisitorMessage.created_at) > new Date(conversation.admin_last_read_at))) {
          unreadByConversation.set(conversation.id, true);
        }
      });
      unreadTotal = unreadByConversation.size;
      const pendingTotal = pendingByConversation.size;
      const unreadStat = document.getElementById("statUnread");
      if (unreadStat) unreadStat.textContent = String(unreadTotal);
      const badge = document.getElementById("chatUnreadSummary");
      if (badge) badge.textContent = "未读 " + unreadTotal + " 个 · 待回复 " + pendingTotal + " 个";
    }

    async function loadChatList() {
      const { data, error } = await client.from("chat_conversations")
        .select("id,owner_id,subject,status,created_at,updated_at,admin_last_read_at")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) { chatNotice("会话读取失败：" + error.message, "error"); return; }
      const humanMessages = await client.from("chat_messages").select("conversation_id").in("sender_role", ["visitor", "admin"]).limit(5000);
      if (humanMessages.error) { chatNotice("人工客服会话读取失败：" + humanMessages.error.message, "error"); return; }
      const humanIds = new Set((humanMessages.data || []).map(message => message.conversation_id));
      const humanConversations = (data || []).filter(item => humanIds.has(item.id));
      await refreshUnreadCounts(humanConversations);
      const chatStat = document.getElementById("statChats");
      if (chatStat) chatStat.textContent = String(humanConversations.length);
      list.replaceChildren();
      if (!humanConversations.length) {
        const empty = document.createElement("p"); empty.className = "chat-empty";
        empty.textContent = "目前还没有在线交流消息。"; list.appendChild(empty); return;
      }
      humanConversations.forEach(item => {
        const row = document.createElement("div");
        row.className = "chat-conversation-row";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-conversation-item" + (activeConversation?.id === item.id ? " active" : "");
        const subject = document.createElement("strong"); subject.textContent = "在线交流" + (unreadByConversation.has(item.id) ? "　未读" : "");
        const meta = document.createElement("small");
        meta.textContent = "ID：" + String(item.owner_id || "未知").slice(0, 5) + " · " + new Date(item.updated_at).toLocaleString("zh-CN");
        button.append(subject, meta);
        button.addEventListener("click", () => selectConversation(item));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "small-button delete chat-conversation-delete";
        del.textContent = "删除";
        del.setAttribute("aria-label", "删除此客户聊天会话");
        del.addEventListener("click", event => { event.stopPropagation(); deleteChatConversation(item); });
        row.append(button, del);
        list.appendChild(row);
      });
      chatNotice("已加载 " + humanConversations.length + " 个在线交流。");
    }
    async function deleteChatConversation(item) {
      const label = "在线交流";
      if (!confirm("确定删除客户“" + label + "”的这条在线交流会话及其全部聊天消息吗？此操作不可撤销。")) return;
      chatNotice("正在删除聊天记录…");
      const { data, error } = await client.rpc("admin_delete_chat_conversation", { p_conversation_id: item.id });
      if (error) { chatNotice("删除失败：" + error.message, "error"); return; }
      if (activeConversation?.id === item.id) {
        activeConversation = null;
        title.textContent = "选择一个在线交流";
        replyForm.hidden = true;
        messages.replaceChildren();
        const empty = document.createElement("div");
        empty.className = "chat-empty";
        empty.textContent = "选择左侧在线交流后显示聊天内容。";
        messages.appendChild(empty);
        const context = document.getElementById("chatCustomerContext");
        if (context) context.textContent = "选择客户后显示历史资料。";
      }
      await loadChatList();
      chatNotice(data ? "聊天会话及消息已删除。" : "该聊天会话可能已被删除。", "success");
      if (typeof window.loadLinyiVisitorProfiles === "function") await window.loadLinyiVisitorProfiles();
    }

    async function loadCustomerContext(visitorId) {
      const panel = document.getElementById("chatCustomerContext"); if (!panel) return;
      panel.replaceChildren();
      const heading = document.createElement("h3"); heading.textContent = "AI对话内容"; panel.appendChild(heading);
      if (!visitorId) { const p = document.createElement("p"); p.textContent = "该在线交流暂未关联客户 AI 历史。"; panel.appendChild(p); return; }
      const { data, error } = await client.from("ai_qa_logs").select("question,answer,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(100);
      if (error) { const p = document.createElement("p"); p.textContent = "AI 对话读取失败：" + error.message; panel.appendChild(p); return; }
      if (!data || !data.length) { const p = document.createElement("p"); p.textContent = "该客户暂无 AI 对话。"; panel.appendChild(p); return; }
      data.forEach(item => { const row = document.createElement("div"); row.className = "chat-ai-history-item"; const time = document.createElement("small"); time.textContent = new Date(item.created_at).toLocaleString("zh-CN"); const body = document.createElement("div"); body.textContent = "客户提问：\n" + (item.question || "") + "\n\nAI回答：\n" + (item.answer || ""); row.append(time, body); panel.appendChild(row); });
    }
    async function loadChatMessages() {
      if (!activeConversation) return;
      const { data, error } = await client.from("chat_messages")
        .select("id,sender_role,content,created_at")
        .eq("conversation_id", activeConversation.id)
        .in("sender_role", ["visitor", "admin"])
        .order("created_at", { ascending: true });
      if (error) { chatNotice("消息读取失败：" + error.message, "error"); return; }
      messages.replaceChildren();
      if (!data || !data.length) {
        const empty = document.createElement("div"); empty.className = "chat-empty"; empty.textContent = "访客尚未发送消息。"; messages.appendChild(empty);
      } else data.forEach(item => {
        const row = document.createElement("div");
        row.className = "chat-message " + (item.sender_role === "visitor" ? "from-visitor" : "from-admin");
        row.dataset.sender = item.sender_role;
        const who = document.createElement("small");
        const senderLabel = item.sender_role === "admin" ? "客服" : "客户";
        who.textContent = senderLabel + " · " + new Date(item.created_at).toLocaleString("zh-CN");
        const body = document.createElement("p"); body.textContent = item.content;
        row.append(who, body); messages.appendChild(row);
      });
      messages.scrollTop = messages.scrollHeight;
    }
    async function selectConversation(item) {
      activeConversation = item;
      const { error: readError } = await client.from("chat_conversations").update({ admin_last_read_at: new Date().toISOString() }).eq("id", item.id);
      if (readError) chatNotice("已打开会话，但已读状态保存失败：" + readError.message, "error");
      title.textContent = "在线交流";
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
        const values = [String(profile.id).slice(0, 5), labelFor(profile.classification), profile.visit_count, dateText(profile.first_seen), dateText(profile.last_seen)];
        values.forEach((value, index) => { const td = document.createElement("td"); td.textContent = String(value); if (index === 0) td.className = "customer-id"; tr.appendChild(td); });
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button"; button.className = "customer-content-button"; button.textContent = "查看内容";
        button.addEventListener("click", async () => { await loadVisitorTimeline(profile); activateAdminPanel("customerDetailsSection"); const empty = document.getElementById("customerDetailsEmpty"); if (empty) empty.hidden = true; });
        action.appendChild(button); tr.appendChild(action); rows.appendChild(tr);
      });
      notice.textContent = "已加载 " + (data || []).length + " 位客户（最多显示最近 200 位）。";
      const customerStat = document.getElementById("statCustomers");
      if (customerStat) customerStat.textContent = String((data || []).length);
    }

    async function deleteVisitorProfile(profile) {
      const shortId = String(profile.id).slice(0, 5);
      if (!confirm("确定永久删除客户 " + shortId + "… 的全部资料吗？\n\n将同时删除该客户的 AI 问答、AI 对话、在线交流会话及消息、页面访问记录和客户档案。此操作不可撤销。")) return;
      notice.textContent = "正在删除客户及关联记录…";
      const { data, error } = await client.rpc("admin_delete_customer", { p_visitor_id: profile.id });
      if (error) { notice.textContent = "删除失败：" + error.message; return; }
      if (timelinePanel) timelinePanel.hidden = true;
      await loadVisitorProfiles();
      if (typeof window.loadLinyiAdminChats === "function") await window.loadLinyiAdminChats();
      if (typeof window.loadLinyiAiQaLogs === "function") await window.loadLinyiAiQaLogs();
      notice.textContent = data ? "客户资料及关联记录已删除。" : "未找到该客户的关联记录。";
    }

    async function loadVisitorTimeline(profile) {
      timelinePanel.hidden = false; timelineTitle.textContent = "客户详细 · ID " + String(profile.id).slice(0, 5); timeline.replaceChildren();
      const results = await Promise.all([
        client.from("visitor_profiles").select("id,classification,visit_count,first_seen,last_seen").eq("id", profile.id).maybeSingle(),
        client.from("ai_qa_logs").select("question,answer,created_at").eq("visitor_id", profile.id).order("created_at", { ascending: true }).limit(500),
        client.from("site_page_views").select("page_path,created_at").eq("visitor_id", profile.id).order("created_at", { ascending: true }).limit(500),
        client.from("chat_conversations").select("id,subject,status").eq("owner_id", profile.id).limit(50)
      ]);
      const [profileResult, aiResult, pageResult, conversationResult] = results;
      const errors = results.map(item => item.error).filter(Boolean);
      if (errors.length) { const p = document.createElement("p"); p.textContent = "部分记录读取失败：" + errors.map(item => item.message).join("；"); timeline.appendChild(p); }
      const p = profileResult.data || profile;
      const summary = document.createElement("div"); summary.className = "customer-detail-summary";
      const summaryItems = [
        ["ID", String(p.id).slice(0, 5)],
        ["时间", dateText(p.last_seen)],
        ["次数", String(p.visit_count || 0)],
        ["客户分类", labelFor(p.classification)]
      ];
      summaryItems.forEach(([label, value]) => { const item = document.createElement("div"); const small = document.createElement("small"); small.textContent = label; const strong = document.createElement("strong"); strong.textContent = value; item.append(small, strong); summary.appendChild(item); });
      timeline.appendChild(summary);
      const sourceSection = document.createElement("section"); sourceSection.className = "customer-detail-section";
      const sourceTitle = document.createElement("h4"); sourceTitle.textContent = "访问形式"; sourceSection.appendChild(sourceTitle);
      const paths = pageResult.data || [];
      if (!paths.length) { const note = document.createElement("p"); note.textContent = "暂无访问来源记录。"; sourceSection.appendChild(note); }
      else paths.forEach(item => { const line = document.createElement("div"); line.className = "customer-content-item"; const time = document.createElement("small"); time.className = "customer-content-time"; time.textContent = dateText(item.created_at); const value = document.createElement("div"); value.textContent = "网站访问 · " + (item.page_path || "页面路径未记录"); line.append(time, value); sourceSection.appendChild(line); });
      timeline.appendChild(sourceSection);
      const contentSection = document.createElement("section"); contentSection.className = "customer-detail-section";
      const contentTitle = document.createElement("h4"); contentTitle.textContent = "内容（客服对话 + AI对话）"; contentSection.appendChild(contentTitle);
      const contentItems = [];
      (aiResult.data || []).forEach(item => contentItems.push({ time: item.created_at, type: "AI对话", content: "客户提问：\n" + (item.question || "") + "\n\n邻伊 AI 回答：\n" + (item.answer || "") }));
      const conversations = conversationResult.data || [];
      if (conversations.length) {
        const messageResult = await client.from("chat_messages").select("sender_role,content,created_at,conversation_id").in("conversation_id", conversations.map(item => item.id)).in("sender_role", ["visitor", "admin"]).order("created_at", { ascending: true }).limit(2000);
        if (messageResult.error) { const p = document.createElement("p"); p.textContent = "客服聊天读取失败：" + messageResult.error.message; contentSection.appendChild(p); }
        else (messageResult.data || []).forEach(item => contentItems.push({ time: item.created_at, type: item.sender_role === "admin" ? "人工客服" : "客户", content: item.content }));
      }
      contentItems.sort((a,b) => new Date(a.time) - new Date(b.time));
      if (!contentItems.length) { const empty = document.createElement("p"); empty.textContent = "暂无 AI 或人工客服对话内容。"; contentSection.appendChild(empty); }
      contentItems.forEach(item => { const row = document.createElement("div"); row.className = "customer-content-item"; const time = document.createElement("small"); time.className = "customer-content-time"; time.textContent = dateText(item.time) + " · " + item.type; const body = document.createElement("div"); body.textContent = item.content; row.append(time, body); contentSection.appendChild(row); });
      timeline.append(contentSection);
      const del = document.createElement("button"); del.type = "button"; del.className = "small-button delete"; del.textContent = "删除客户及全部记录"; del.addEventListener("click", () => deleteVisitorProfile(profile)); timeline.appendChild(del);
      const empty = document.getElementById("customerDetailsEmpty"); if (empty) empty.hidden = true;
    }
    document.getElementById("refreshVisitorProfiles").addEventListener("click", loadVisitorProfiles);
    window.loadLinyiVisitorProfiles = loadVisitorProfiles;
  }

});
