document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("articleAdminList");
  if (!root) return;
  const notice = document.getElementById("articleAdminNotice");
  const filter = document.getElementById("articleStatusFilter");
  const setNotice = (message, kind = "") => { notice.textContent = message; notice.className = "notice " + kind; };
  let client;
  let ready = false;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const categories = ["生育认知", "试管基础", "就诊准备", "流程指南", "深入了解", "科普"];
  async function loadArticles() {
    root.replaceChildren();
    setNotice("正在读取文章…");
    let query = client.from("ai_article_drafts").select("id,title,summary,category,content,status,created_at,published_at").order("created_at", { ascending: false });
    if (filter.value !== "all") query = query.eq("status", filter.value);
    const { data, error } = await query;
    if (error) { setNotice("读取失败：" + error.message, "error"); return; }
    if (!data?.length) { root.textContent = "当前筛选条件下没有文章。"; setNotice("已完成读取。", "success"); return; }
    data.forEach(article => {
      const card = document.createElement("article");
      card.className = "admin-card";
      card.style.margin = "14px 0";
      const heading = document.createElement("h2"); heading.textContent = article.title || "未命名文章";
      const meta = document.createElement("p"); meta.className = "security-note";
      meta.textContent = (article.category || "未分类") + " · " + (article.status === "published" ? "已发布" : "草稿") + " · 创建于 " + new Date(article.created_at).toLocaleString("zh-CN");
      const form = document.createElement("div"); form.style.display = "grid"; form.style.gap = "10px";
      const titleLabel = document.createElement("label"); titleLabel.textContent = "文章标题";
      const titleInput = document.createElement("input"); titleInput.value = article.title || ""; titleInput.maxLength = 180; titleInput.style.cssText = "width:100%;padding:10px;border:1px solid var(--border);border-radius:8px";
      titleLabel.appendChild(titleInput);
      const summaryLabel = document.createElement("label"); summaryLabel.textContent = "摘要";
      const summaryInput = document.createElement("textarea"); summaryInput.rows = 2; summaryInput.value = article.summary || ""; summaryInput.style.cssText = "width:100%;padding:10px;border:1px solid var(--border);border-radius:8px";
      summaryLabel.appendChild(summaryInput);
      const categoryLabel = document.createElement("label"); categoryLabel.textContent = "所属主题";
      const categorySelect = document.createElement("select"); categorySelect.style.cssText = "padding:10px;border:1px solid var(--border);border-radius:8px";
      categories.forEach(category => { const option = document.createElement("option"); option.value = category; option.textContent = category; categorySelect.appendChild(option); });
      if (!categories.includes(article.category)) { const option = document.createElement("option"); option.value = article.category || "科普"; option.textContent = article.category || "科普"; categorySelect.appendChild(option); }
      categorySelect.value = article.category || "科普"; categoryLabel.appendChild(categorySelect);
      const contentLabel = document.createElement("label"); contentLabel.textContent = "正文（支持 Markdown）";
      const contentInput = document.createElement("textarea"); contentInput.rows = 16; contentInput.value = article.content || ""; contentInput.style.cssText = "width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;font:inherit;line-height:1.7";
      contentLabel.appendChild(contentInput);
      const actions = document.createElement("div"); actions.className = "admin-toolbar";
      const save = document.createElement("button"); save.type = "button"; save.className = "btn btn-outline"; save.textContent = "保存修改";
      const publish = document.createElement("button"); publish.type = "button"; publish.className = "btn btn-primary"; publish.textContent = article.status === "published" ? "更新已发布文章" : "发布文章";
      const unpublish = document.createElement("button"); unpublish.type = "button"; unpublish.className = "btn btn-outline"; unpublish.textContent = "退回草稿"; unpublish.hidden = article.status !== "published";
      const saveChanges = async status => {
        const title = titleInput.value.trim();
        if (!title) { setNotice("文章标题不能为空。", "error"); return; }
        const payload = { title, summary: summaryInput.value.trim(), category: categorySelect.value, content: contentInput.value };
        if (status) { payload.status = status; payload.published_at = status === "published" ? (article.published_at || new Date().toISOString()) : null; }
        setNotice("正在保存文章…");
        const { error: saveError } = await client.from("ai_article_drafts").update(payload).eq("id", article.id);
        if (saveError) { setNotice("保存失败：" + saveError.message, "error"); return; }
        setNotice(status === "published" ? "文章已发布，主题页面将读取此文章。" : status === "draft" ? "文章已退回草稿。" : "修改已保存。", "success");
        await loadArticles();
      };
      save.addEventListener("click", () => saveChanges(null));
      publish.addEventListener("click", () => {
        if (confirm(article.status === "published" ? "确认保存修改并更新这篇已公开文章？" : "确认发布？发布后访客可在对应主题页面阅读。")) saveChanges("published");
      });
      unpublish.addEventListener("click", () => {
        if (confirm("将这篇文章退回草稿？退回后访客将无法在主题页面看到它。")) saveChanges("draft");
      });
      actions.append(save, publish, unpublish);
      form.append(titleLabel, summaryLabel, categoryLabel, contentLabel, actions);
      card.append(heading, meta, form); root.appendChild(card);
    });
    setNotice("已加载 " + data.length + " 篇文章。", "success");
  }
  async function initialize() {
    if (ready) return;
    try { client = window.linyiCreateSupabaseClient(); } catch (error) { setNotice(error.message, "error"); return; }
    const { data } = await client.auth.getSession();
    if (!data.session?.user) return;
    const { data: isAdmin, error } = await client.rpc("is_admin");
    if (error || isAdmin !== true) return;
    ready = true;
    await loadArticles();
  }
  document.getElementById("refreshArticles").addEventListener("click", () => ready ? loadArticles() : initialize());
  filter.addEventListener("change", () => ready ? loadArticles() : initialize());
  document.querySelector('[data-admin-tab="aiArticlesSection"]')?.addEventListener("click", initialize);
  initialize();
});
