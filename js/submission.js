document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("storySubmissionForm");
  const message = document.getElementById("submissionMessage");
  const anonymous = document.getElementById("submissionAnonymous");
  const authorWrap = document.getElementById("authorNameWrap");
  if (!form || !message) return;

  anonymous?.addEventListener("change", () => {
    if (authorWrap) authorWrap.hidden = anonymous.checked;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "正在提交…";

    try {
      const client = window.linyiCreateSupabaseClient();
      const fd = new FormData(form);
      const isAnonymous = anonymous.checked;
      const payload = {
        title: String(fd.get("title") || "").trim(),
        category: String(fd.get("category") || "share"),
        content: String(fd.get("content") || "").trim(),
        is_anonymous: isAnonymous,
        author_name: isAnonymous ? null : (String(fd.get("author_name") || "").trim() || null),
        contact: String(fd.get("contact") || "").trim() || null,
        status: "pending"
      };

      if (!payload.title || !payload.content) {
        throw new Error("请填写标题和分享内容。");
      }
      if (payload.content.length > 5000) {
        throw new Error("分享内容请控制在 5000 字以内。");
      }

      const { error } = await client.from("submissions").insert(payload);
      if (error) throw error;

      form.reset();
      if (authorWrap) authorWrap.hidden = false;
      message.textContent = "提交成功！内容已进入审核队列，审核通过后再发布。";
      message.className = "submission-message success";
    } catch (error) {
      message.textContent = error?.message || "提交失败，请稍后重试。";
      message.className = "submission-message error";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "提交审核";
    }
  });
});
