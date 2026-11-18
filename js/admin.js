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
    showDashboard(data.user);
    await loadSubmissions();
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
      showDashboard(data.session.user);
      await loadSubmissions();
    } else {
      showLogin();
    }
  });


  // AI 科普文章草稿管理
  const articleBox = document.getElementById("aiArticleSection");
  if (articleBox) {
    const topicInput=document.getElementById("aiArticleTopic");
    const generateBtn=document.getElementById("generateAiArticle");
    const articleRows=document.getElementById("aiArticleRows");
    const articleMessage=document.getElementById("aiArticleMessage");
    const editor=document.getElementById("aiArticleEditor");
    const titleInput=document.getElementById("aiArticleTitle");
    const summaryInput=document.getElementById("aiArticleSummary");
    const contentInput=document.getElementById("aiArticleContent");
    const saveBtn=document.getElementById("saveAiArticle");
    const publishBtn=document.getElementById("publishAiArticle");
    let currentArticleId=null;
    const articleNotice=(s,kind="")=>{articleMessage.textContent=s;articleMessage.className="notice "+kind;};
    async function loadAiArticles(){
      const {data,error}=await client.from("ai_article_drafts").select("*").order("created_at",{ascending:false});
      if(error){articleNotice("文章读取失败："+error.message,"error");return;}
      articleRows.replaceChildren();
      for(const item of data||[]){
        const tr=document.createElement("tr"),td=document.createElement("td"),title=document.createElement("strong");
        title.textContent=item.title;td.appendChild(title);
        const state=document.createElement("small");state.textContent=item.status==="published"?"已发布":"草稿";td.appendChild(state);
        const action=document.createElement("td"),edit=document.createElement("button");edit.type="button";edit.className="small-button";edit.textContent="编辑";
        edit.addEventListener("click",()=>{currentArticleId=item.id;titleInput.value=item.title;summaryInput.value=item.summary||"";contentInput.value=item.content;editor.hidden=false;publishBtn.hidden=item.status==="published";articleNotice("正在编辑："+item.title);});
        action.appendChild(edit);tr.append(td,action);articleRows.appendChild(tr);
      }
      articleNotice("已加载 "+(data||[]).length+" 篇文章。");
    }
    generateBtn.addEventListener("click",async()=>{
      const topic=topicInput.value.trim();if(!topic){articleNotice("请先填写文章主题。","error");return;}
      generateBtn.disabled=true;articleNotice("GPT 正在生成文章，请稍候…");
      try{
        const {data:{session}}=await client.auth.getSession();if(!session)throw new Error("登录已失效，请重新登录。");
        const response=await fetch(window.LINYI_SUPABASE_URL+"/functions/v1/linyi-ai",{method:"POST",headers:{"Content-Type":"application/json","apikey":window.LINYI_SUPABASE_PUBLISHABLE_KEY,"Authorization":"Bearer "+session.access_token},body:JSON.stringify({action:"generate_article",topic})});
        const result=await response.json();if(!response.ok)throw new Error(result.error||"生成失败。");
        const item=result.draft;currentArticleId=item.id;titleInput.value=item.title;summaryInput.value=item.summary||"";contentInput.value=item.content;editor.hidden=false;publishBtn.hidden=false;articleNotice("文章已生成并保存为草稿，尚未公开。","success");await loadAiArticles();
      }catch(error){articleNotice(error.message,"error");}
      finally{generateBtn.disabled=false;}
    });
    saveBtn.addEventListener("click",async()=>{
      if(!currentArticleId){articleNotice("请先选择或生成一篇文章。","error");return;}
      saveBtn.disabled=true;articleNotice("正在保存为草稿…");
      const {error}=await client.from("ai_article_drafts").update({title:titleInput.value.trim(),summary:summaryInput.value.trim(),content:contentInput.value,status:"draft",published_at:null,updated_at:new Date().toISOString()}).eq("id",currentArticleId);
      saveBtn.disabled=false;if(error){articleNotice("保存失败："+error.message,"error");return;}
      articleNotice("已保存为草稿，未公开。","success");await loadAiArticles();
    });
    publishBtn.addEventListener("click",async()=>{
      if(!currentArticleId)return;
      if(!confirm("确认发布这篇文章？发布后访客可以阅读。"))return;
      publishBtn.disabled=true;
      const {error}=await client.from("ai_article_drafts").update({title:titleInput.value.trim(),summary:summaryInput.value.trim(),content:contentInput.value,status:"published",published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",currentArticleId);
      publishBtn.disabled=false;if(error){articleNotice("发布失败："+error.message,"error");return;}
      articleNotice("文章已发布。","success");await loadAiArticles();
    });
    loadAiArticles();
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
    loadChatList();
    adminChatChannel = client.channel("admin-chat-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async payload => {
        await loadChatList();
        if (activeConversation && payload.new.conversation_id === activeConversation.id) await loadChatMessages();
      })
      .subscribe();
  }


});
