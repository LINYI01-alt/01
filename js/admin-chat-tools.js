/* 邻伊管理员聊天记录筛选与可读性增强。仅调整展示，不改动消息数据。 */
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("chatAdminSection");
  const list = document.getElementById("chatAdminMessages");
  const search = document.getElementById("chatMessageSearch");
  const role = document.getElementById("chatMessageRole");
  const count = document.getElementById("chatMessageCount");
  if (!root || !list || !search || !role || !count) return;

  const normalize = value => String(value || "").toLocaleLowerCase();
  function refresh() {
    const keyword = normalize(search.value.trim());
    const selectedRole = role.value;
    let total = 0;
    let shown = 0;
    Array.from(list.querySelectorAll(".chat-message")).forEach(row => {
      const label = row.querySelector("small")?.textContent || "";
      const sender = label.includes("邻伊人工客服") ? "admin"
        : label.includes("邻伊 AI") ? "ai"
        : label.includes("访客") ? "visitor" : "unknown";
      row.dataset.sender = sender;
      const matchesRole = selectedRole === "all" || selectedRole === sender;
      const matchesText = !keyword || normalize(row.textContent).includes(keyword);
      const visible = matchesRole && matchesText;
      row.hidden = !visible;
      total += 1;
      if (visible) shown += 1;
    });
    const hasMessages = total > 0;
    count.textContent = hasMessages
      ? (shown === total ? "共 " + total + " 条消息" : "显示 " + shown + " / " + total + " 条")
      : "暂无聊天消息";
  }

  search.addEventListener("input", refresh);
  role.addEventListener("change", refresh);
  const observer = new MutationObserver(refresh);
  observer.observe(list, { childList: true, subtree: true });
  refresh();
});
