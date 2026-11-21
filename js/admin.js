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
    if (typeof window.loadLinyiSiteAnalytics === "function") await window.loadLinyiSiteAnalytics();
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



  // 匿名访客统计：仅管理员可读取，明细仅包含随机访客标识、页面路径与时间。
  const analyticsSection = document.getElementById("siteAnalyticsSection");
  if (analyticsSection) {
    const analyticsNotice = document.getElementById("analyticsNotice");
    const setAnalyticsNotice = (message, kind = "") => {
      analyticsNotice.textContent = message;
      analyticsNotice.className = "notice " + kind;
    };
    const localDayKey = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    };
    async function loadSiteAnalytics() {
      setAnalyticsNotice("正在读取匿名访问统计…");
      const { data, error } = await client.from("site_page_views")
        .select("visitor_key,page_path,created_at")
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) {
        setAnalyticsNotice("统计读取失败：" + error.message, "error");
        return;
      }
      const rows = data || [];
      const todayKey = localDayKey(new Date());
      const todayRows = rows.filter(row => localDayKey(new Date(row.created_at)) === todayKey);
      document.getElementById("analyticsTodayVisitors").textContent = new Set(todayRows.map(row => row.visitor_key)).size.toLocaleString("zh-CN");
      document.getElementById("analyticsTodayViews").textContent = todayRows.length.toLocaleString("zh-CN");
      document.getElementById("analyticsAllVisitors").textContent = new Set(rows.map(row => row.visitor_key)).size.toLocaleString("zh-CN");
      document.getElementById("analyticsAllViews").textContent = rows.length.toLocaleString("zh-CN");

      const dailyRows = document.getElementById("analyticsDailyRows");
      dailyRows.replaceChildren();
      for (let offset = 0; offset < 7; offset++) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - offset);
        const key = localDayKey(date);
        const dayRows = rows.filter(row => localDayKey(new Date(row.created_at)) === key);
        const tr = document.createElement("tr");
        for (const value of [key, new Set(dayRows.map(row => row.visitor_key)).size, dayRows.length]) {
          const td = document.createElement("td");
          td.textContent = String(value);
          tr.appendChild(td);
        }
        dailyRows.appendChild(tr);
      }

      const pageCounts = new Map();
      rows.forEach(row => pageCounts.set(row.page_path, (pageCounts.get(row.page_path) || 0) + 1));
      const pageRows = document.getElementById("analyticsPageRows");
      pageRows.replaceChildren();
      const topPages = Array.from(pageCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (!topPages.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 2;
        td.textContent = "暂时还没有访问记录。";
        tr.appendChild(td);
        pageRows.appendChild(tr);
      } else {
        topPages.forEach(([path, count]) => {
          const tr = document.createElement("tr");
          const pathCell = document.createElement("td");
          pathCell.textContent = path;
          const countCell = document.createElement("td");
          countCell.textContent = String(count);
          tr.append(pathCell, countCell);
          pageRows.appendChild(tr);
        });
      }
      setAnalyticsNotice("统计已更新。累计最多显示最近 10,000 次页面浏览记录；访客数按浏览器匿名标识估算。", "success");
    }
    document.getElementById("refreshAnalytics").addEventListener("click", loadSiteAnalytics);
    window.loadLinyiSiteAnalytics = loadSiteAnalytics;
  }

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

    async function loadChatList() {
      const { data, error } = await client.from("chat_conversations")
        .select("id,subject,status,created_at,updated_at")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) { chatNotice("会话读取失败：" + error.message, "error"); return; }
      list.replaceChildren();
      if (!data || !data.length) {
        const empty = document.createElement("p"); empty.className = "chat-empty";
        empty.textContent = "目前还没有访客留言。"; list.appendChild(empty); return;
      }
      data.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-conversation-item" + (activeConversation?.id === item.id ? " active" : "");
        const subject = document.createElement("strong"); subject.textContent = item.subject || "网站内容交流";
        const meta = document.createElement("small");
        meta.textContent = (item.status === "open" ? "进行中" : "已结束") + " · " + new Date(item.updated_at).toLocaleString("zh-CN");
        button.append(subject, meta);
        button.addEventListener("click", () => selectConversation(item));
        list.appendChild(button);
      });
      chatNotice("已加载 " + data.length + " 个访客会话。");
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
    }
    document.getElementById("refreshChats").addEventListener("click", loadChatList);
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
    };
  }


});
