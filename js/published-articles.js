document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("linyiPublishedArticles");
  if (!root) return;
  const category = root.dataset.category;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const inline = text => esc(text)
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  function markdown(source) {
    const lines = String(source || "").replace(/\r/g, "").split("\n");
    const out = []; let listOpen = false;
    const closeList = () => { if (listOpen) { out.push("</ul>"); listOpen = false; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { closeList(); continue; }
      if (/^---+$/.test(line)) { closeList(); out.push("<hr>"); continue; }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) { closeList(); const level = Math.min(heading[1].length + 1, 5); out.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">"); continue; }
      const item = line.match(/^[-*]\s+(.+)$/);
      if (item) { if (!listOpen) { out.push("<ul>"); listOpen = true; } out.push("<li>" + inline(item[1]) + "</li>"); continue; }
      closeList(); out.push("<p>" + inline(line) + "</p>");
    }
    closeList(); return out.join("");
  }
  root.innerHTML = '<div class="learning-section"><div><p>正在加载已发布文章…</p></div></div>';
  try {
    const client = window.linyiCreateSupabaseClient();
    const { data, error } = await client.from("ai_article_drafts")
      .select("id,title,summary,content,category,published_at,created_at")
      .eq("status", "published").eq("category", category)
      .order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) throw error;
    root.replaceChildren();
    const heading = document.createElement("div"); heading.className = "published-articles-heading";
    const title = document.createElement("h2"); title.textContent = "邻伊最新科普文章";
    const intro = document.createElement("p"); intro.textContent = "以下内容由邻伊编辑整理，供一般知识学习与就诊沟通参考。";
    heading.append(title, intro); root.appendChild(heading);
    if (!data?.length) {
      const empty = document.createElement("p"); empty.className = "published-articles-empty"; empty.textContent = "该主题暂时没有已发布的新文章，敬请关注。"; root.appendChild(empty); return;
    }
    data.forEach(article => {
      const card = document.createElement("article"); card.className = "published-article-card";
      const h = document.createElement("h3"); h.textContent = article.title;
      const summary = document.createElement("p"); summary.className = "published-article-summary"; summary.textContent = article.summary || "";
      const date = document.createElement("small"); date.className = "published-article-date";
      const at = article.published_at || article.created_at; date.textContent = at ? "发布日期：" + new Date(at).toLocaleDateString("zh-CN") : "";
      const body = document.createElement("div"); body.className = "published-article-body"; body.innerHTML = markdown(article.content);
      card.append(h, summary, date, body); root.appendChild(card);
    });
  } catch (error) {
    root.replaceChildren();
    const message = document.createElement("p"); message.className = "published-articles-empty";
    message.textContent = "文章暂时无法加载，请稍后刷新页面。";
    root.appendChild(message);
    console.warn("邻伊已发布文章加载失败：", error);
  }
});
