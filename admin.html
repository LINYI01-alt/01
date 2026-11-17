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
      td.colSpan = 6;
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
});
