/* 邻伊全站在线交流浮窗：复用现有 Supabase 会话与管理员后台 */
(function () {
  const currentScript = document.currentScript;
  const widgetScriptUrl = currentScript && currentScript.src
    ? currentScript.src
    : new URL("js/chat-widget.js", window.location.href).href;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(item => item.src === src);
      if (existing) {
        if (src.includes("visitor-identity.js") && window.linyiGetVisitorSession) return resolve();
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureSupabase() {
    if (!window.supabase || !window.supabase.createClient) {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    const identityUrl = new URL("visitor-identity.js", widgetScriptUrl).href;
    if (!window.linyiGetVisitorSession) await loadScript(identityUrl);
    if (!window.linyiCreateSupabaseClient) {
      const configUrl = new URL("supabase-config.js", widgetScriptUrl).href;
      await loadScript(configUrl);
    }
    if (!window.linyiGetVisitorSession || !window.linyiCreateSupabaseClient) {
      throw new Error("访客身份服务未能加载，请刷新页面重试。");
    }
  }

  function init() {
    if (document.getElementById("linyi-chat-widget")) return;

    const style = document.createElement("style");
    style.textContent = `
      /* 将原有 AI 科普助手移至左下角，避免与在线客服重叠 */
      #linyi-ai-launcher{left:22px!important;right:auto!important;bottom:22px!important}
      #linyi-ai-panel{left:20px!important;right:auto!important;bottom:82px!important}
      /* 两个底部入口统一尺寸，避免文字长度造成视觉大小不一致 */
      #linyi-ai-launcher,#linyi-chat-launcher{box-sizing:border-box!important;width:180px!important;height:52px!important;min-height:52px!important;padding:0 12px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;white-space:nowrap!important;font-size:14px!important;line-height:1!important;border-radius:28px!important}
      #linyi-chat-launcher{position:fixed;right:22px;bottom:22px;z-index:2147483001;min-height:52px;padding:0 20px;border:0;border-radius:28px;background:linear-gradient(135deg,#f6a45f,#e77b35);color:#fff;font:600 15px "Noto Sans SC",Arial,sans-serif;box-shadow:0 7px 24px rgba(183,91,37,.28);cursor:pointer;display:flex;align-items:center;gap:9px}
      #linyi-chat-launcher:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(183,91,37,.34)}
      #linyi-chat-launcher .chat-launcher-dot{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.2)}
      #linyi-chat-panel{position:fixed;right:22px;bottom:86px;width:min(390px,calc(100vw - 28px));height:min(620px,calc(100vh - 112px));z-index:2147483002;display:none;flex-direction:column;overflow:hidden;border:1px solid #f0d8c7;border-radius:20px;background:#fffdfb;box-shadow:0 18px 55px rgba(83,53,34,.22);font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",Arial,sans-serif;color:#49392f}
      #linyi-chat-panel.open{display:flex}
      #linyi-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:linear-gradient(120deg,#fff0e3,#ffe3cc);border-bottom:1px solid #f4dfcf}
      #linyi-chat-head strong{display:block;font-size:16px;color:#633f2c}
      #linyi-chat-head small{display:block;margin-top:3px;color:#946c54;font-size:11px}
      #linyi-chat-head button{width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.72);color:#754a32;font-size:24px;cursor:pointer}
      #linyi-chat-status{display:inline-flex;align-items:center;gap:6px;margin-top:7px;color:#6c785a;font-size:11px}
      #linyi-chat-status:before{content:"";width:7px;height:7px;border-radius:50%;background:#83ad72}
      #linyi-chat-intro{padding:13px 16px 8px;background:#fffaf6;color:#806d60;font-size:12px;line-height:1.7}
      #linyi-chat-quick{display:flex;flex-wrap:wrap;gap:7px;padding:4px 14px 12px;background:#fffaf6}
      #linyi-chat-quick button{min-height:34px;padding:6px 10px;border:1px solid #f0d2bc;border-radius:18px;background:#fff;color:#a45e36;font:12px "Noto Sans SC",Arial,sans-serif;cursor:pointer}
      #linyi-chat-quick button:hover{background:#fff0e4}
      #linyi-chat-messages{display:flex;flex:1;flex-direction:column;gap:10px;min-height:120px;overflow:auto;padding:14px;background:#fff}
      .linyi-chat-bubble{max-width:88%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
      .linyi-chat-bubble small{display:block;margin-bottom:4px;color:#9b8a7e;font-size:10px}
      .linyi-chat-bubble.visitor{align-self:flex-end;border-bottom-right-radius:4px;background:#ffeadb;color:#69432e}
      .linyi-chat-bubble.admin,.linyi-chat-bubble.system{align-self:flex-start;border-bottom-left-radius:4px;background:#f7f3ef;color:#5f5148}
      #linyi-chat-notice{min-height:18px;padding:5px 14px 0;color:#8a796d;background:#fff;font-size:11px}
      #linyi-chat-notice.error{color:#b33e35}
      #linyi-chat-compose{padding:10px 13px 12px;border-top:1px solid #f1e6de;background:#fffdfb}
      #linyi-chat-input{display:block;width:100%;min-height:66px;max-height:110px;resize:vertical;padding:10px 11px;border:1px solid #ead9cc;border-radius:11px;background:#fff;font:13px/1.6 "Noto Sans SC",Arial,sans-serif;color:#49392f;outline-color:#e99a62}
      #linyi-chat-compose-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
      #linyi-chat-compose-bottom small{color:#9a8b80;font-size:10px}
      #linyi-chat-send{min-width:78px;min-height:40px;padding:0 16px;border:0;border-radius:22px;background:#e9894b;color:#fff;font:600 13px "Noto Sans SC",Arial,sans-serif;cursor:pointer}
      #linyi-chat-send:disabled{opacity:.55;cursor:not-allowed}
      #linyi-chat-privacy{padding:0 13px 10px;background:#fffdfb;color:#a09186;font-size:10px;line-height:1.5}
      @media(max-width:520px){
        #linyi-chat-launcher{right:14px;bottom:14px;min-height:48px;padding:0 16px}
        #linyi-chat-panel{right:8px;bottom:70px;width:calc(100vw - 16px);height:min(620px,calc(100dvh - 82px));border-radius:17px}
        #linyi-ai-launcher{left:14px!important;bottom:14px!important;width:180px!important;height:48px!important;min-height:48px!important}
        #linyi-chat-launcher{right:14px!important;bottom:14px!important;width:180px!important;height:48px!important;min-height:48px!important}
        #linyi-ai-panel{left:8px!important;bottom:70px!important;width:min(350px,calc(100vw - 16px))}
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "linyi-chat-widget";
    root.innerHTML = `
      <button id="linyi-chat-launcher" type="button" aria-expanded="false" aria-controls="linyi-chat-panel"><span class="chat-launcher-dot"></span>在线交流</button>
      <section id="linyi-chat-panel" role="dialog" aria-label="邻伊在线交流" aria-modal="false">
        <header id="linyi-chat-head">
          <div><strong>邻伊在线交流</strong><small>认真倾听每一条建议</small><span id="linyi-chat-status">留言通道 · 人工客服稍后跟进</span></div>
          <button id="linyi-chat-close" type="button" aria-label="关闭聊天窗口">×</button>
        </header>
        <div id="linyi-chat-intro">您好，欢迎联系邻伊！这里可以反馈网站使用问题、科普内容建议或资料出处。</div>
        <div id="linyi-chat-quick" aria-label="常见问题快捷选项">
          <button type="button" data-message="我想反馈网站使用问题：">网站使用问题</button>
          <button type="button" data-message="我想建议增加的科普主题是：">科普内容建议</button>
          <button type="button" data-message="我想咨询网站内容出处：">资料出处反馈</button>
          <button type="button" data-message="其他留言：">其他问题</button>
        </div>
        <div id="linyi-chat-messages" aria-live="polite"><div class="linyi-chat-bubble system">您好！欢迎来到邻伊，很高兴为您服务！😊</div></div>
        <div id="linyi-chat-notice" role="status" aria-live="polite">正在连接留言服务…</div>
        <form id="linyi-chat-compose">
          <label for="linyi-chat-input" class="sr-only">输入留言内容</label>
          <textarea id="linyi-chat-input" maxlength="1200" placeholder="请输入您想反馈的内容…" required></textarea>
          <div id="linyi-chat-compose-bottom"><small><span id="linyi-chat-count">0</span>/1200 字</small><button id="linyi-chat-send" type="submit">发送留言</button></div>
        </form>
        <div id="linyi-chat-privacy">仅处理科普内容、资料反馈和网站使用问题，不提供诊断或治疗建议。请勿填写姓名、电话、身份证号、病历或检查报告。</div>
      </section>`;
    document.body.appendChild(root);

    const launcher = root.querySelector("#linyi-chat-launcher");
    const panel = root.querySelector("#linyi-chat-panel");
    const input = root.querySelector("#linyi-chat-input");
    const send = root.querySelector("#linyi-chat-send");
    const messages = root.querySelector("#linyi-chat-messages");
    const notice = root.querySelector("#linyi-chat-notice");
    const status = root.querySelector("#linyi-chat-status");
    const count = root.querySelector("#linyi-chat-count");
    let client = null;
    let conversationId = null;
    let channel = null;
    let pollTimer = null;
    let realtimeConnectTimer = null;
    let ready = false;
    let connecting = false;
    let connectPromise = null;
    let lastConnectError = null;

    function setNotice(message, isError) {
      notice.textContent = message;
      notice.classList.toggle("error", Boolean(isError));
    }
    function addBubble(text, role, timestamp) {
      const bubble = document.createElement("div");
      bubble.className = "linyi-chat-bubble " + role;
      if (timestamp) {
        const meta = document.createElement("small");
        meta.textContent = timestamp;
        bubble.appendChild(meta);
      }
      const body = document.createElement("span");
      body.textContent = text;
      bubble.appendChild(body);
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
      return bubble;
    }
    async function loadMessages() {
      const { data, error } = await client.from("chat_messages")
        .select("id,sender_role,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      messages.replaceChildren();
      if (!data || !data.length) {
        addBubble("您好！欢迎来到邻伊，很高兴为您服务！😊", "system");
      } else {
        data.forEach(item => {
          const role = item.sender_role === "visitor" ? "visitor" : item.sender_role === "ai" ? "ai" : "admin";
          const label = item.sender_role === "ai" ? "邻伊 AI：" : item.sender_role === "admin" ? "人工客服：" : "";
          addBubble(label + item.content, role, new Date(item.created_at).toLocaleString("zh-CN"));
        });
      }
      messages.scrollTop = messages.scrollHeight;
    }

    async function pollMessages() {
      if (!ready || !client || !conversationId || document.hidden) return;
      try { await loadMessages(); }
      catch (error) { console.warn("留言轮询暂时失败", error && error.message); }
    }
    function startMessagePolling() {
      if (pollTimer) return;
      setNotice("实时通道暂不可用，已切换定时刷新；留言发送仍可使用。");
      pollTimer = window.setInterval(pollMessages, 7000);
      pollMessages();
    }
    function stopMessagePolling() {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
    }
    function clearRealtimeConnectTimer() {
      if (realtimeConnectTimer) window.clearTimeout(realtimeConnectTimer);
      realtimeConnectTimer = null;
    }
    function connect() {
      if (ready) return Promise.resolve();
      // Share one in-flight connection between initial panel load and send click.
      if (connectPromise) return connectPromise;
      connecting = true;
      connectPromise = (async () => {
        lastConnectError = null;
        try {
          await ensureSupabase();
          const identity = await window.linyiGetVisitorSession();
          client = identity.client;
          const user = identity.user;
          if (!user) throw new Error("暂时无法建立访客会话，请稍后重试。");
          const { data: existing, error: findError } = await client.from("chat_conversations")
            .select("id,status").eq("owner_id", user.id).maybeSingle();
          if (findError) throw findError;
          if (existing) {
            conversationId = existing.id;
            if (existing.status !== "open") {
              const { error: reopenError } = await client.from("chat_conversations")
                .update({ status: "open", updated_at: new Date().toISOString() }).eq("id", conversationId);
              if (reopenError) throw reopenError;
            }
          } else {
            const { data: created, error: createError } = await client.from("chat_conversations")
              .insert({ owner_id: user.id, subject: "邻伊 AI 统一咨询" }).select("id").single();
            if (createError?.code === "23505") {
              const { data: raced, error: raceError } = await client.from("chat_conversations")
                .select("id").eq("owner_id", user.id).single();
              if (raceError || !raced) throw createError;
              conversationId = raced.id;
            } else if (createError) throw createError;
            else conversationId = created.id;
          }
          await loadMessages();
          ready = true;
          status.textContent = "留言通道可用 · 人工客服稍后跟进";
          send.disabled = false;
          setNotice("已连接。您发送的留言会进入现有管理员后台。");
          channel = client.channel("linyi-floating-chat-" + conversationId)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: "conversation_id=eq." + conversationId }, () => {
              loadMessages().catch(error => console.warn("实时消息刷新失败", error));
            })
            .subscribe((subscriptionStatus, subscriptionError) => {
              if (subscriptionStatus === "SUBSCRIBED") {
                clearRealtimeConnectTimer();
                stopMessagePolling();
                status.textContent = "实时留言已连接 · 人工客服稍后跟进";
                setNotice("已连接。您发送的留言会进入现有管理员后台。");
              } else if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT" || subscriptionStatus === "CLOSED") {
                clearRealtimeConnectTimer();
                console.warn("留言实时通道不可用，启用轮询备用方案", subscriptionStatus, subscriptionError);
                status.textContent = "留言通道备用模式";
                startMessagePolling();
              }
            });
          realtimeConnectTimer = window.setTimeout(() => {
            if (!pollTimer) {
              console.warn("留言实时通道连接超时，启用轮询备用方案");
              status.textContent = "留言通道备用模式";
              startMessagePolling();
            }
          }, 9000);
        } catch (error) {
          lastConnectError = error;
          console.error("邻伊在线交流连接失败", { message: error && error.message, code: error && error.code, status: error && error.status, details: error && error.details, hint: error && error.hint });
          status.textContent = "留言服务暂不可用";
          setNotice(error.message || "连接失败，请稍后重试或前往在线交流页面。", true);
          client = null;
          conversationId = null;
          ready = false;
          send.disabled = false;
        } finally {
          connecting = false;
        }
      })();
      return connectPromise.finally(() => { connectPromise = null; });
    }

    function openPanel() {
      panel.classList.add("open");
      launcher.setAttribute("aria-expanded", "true");
      connect();
      window.setTimeout(() => input.focus(), 80);
    }
    function closePanel() {
      panel.classList.remove("open");
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    }
    launcher.addEventListener("click", () => panel.classList.contains("open") ? closePanel() : openPanel());
    root.querySelector("#linyi-chat-close").addEventListener("click", closePanel);
    input.addEventListener("input", () => { count.textContent = String(input.value.length); });
    root.querySelectorAll("#linyi-chat-quick button").forEach(button => {
      button.addEventListener("click", () => {
        input.value = button.dataset.message || "";
        count.textContent = String(input.value.length);
        input.focus();
      });
    });

    root.querySelector("#linyi-chat-compose").addEventListener("submit", async event => {
      event.preventDefault();
      const content = input.value.trim();
      if (!content) return;
      if (!ready || !client || !conversationId) {
        setNotice("正在重新连接留言服务…");
        await connect();
        if (!ready || !client || !conversationId) {
          const detail = lastConnectError && lastConnectError.message ? "（" + lastConnectError.message + "）" : "";
          setNotice("连接失败" + detail + "。请稍后重试；您输入的文字会保留。", true);
          return;
        }
      }
      if (content.length > 1200) { setNotice("留言请控制在 1200 字以内。", true); return; }
      const hasPhone = /(?:\+?86[- ]?)?1[3-9]\d{9}/.test(content);
      const hasId = /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]\b/.test(content);
      const personalMedical = /(我的|本人|我这边).{0,8}(病历|检查报告|化验单|用药记录|诊断结果|检查结果)/.test(content);
      if (hasPhone || hasId || personalMedical) {
        setNotice("为保护隐私，这条留言未发送。请删除联系方式及个人健康资料。", true);
        return;
      }
      send.disabled = true;
      setNotice("正在发送…");
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData.session) throw sessionError || new Error("访客会话已失效，请刷新页面。");
        const { error } = await client.from("chat_messages").insert({
          conversation_id: conversationId,
          sender_id: sessionData.session.user.id,
          sender_role: "visitor",
          content
        });
        if (error) throw error;
        input.value = "";
        count.textContent = "0";
        addBubble(content, "visitor", new Date().toLocaleString("zh-CN"));
        setNotice("留言发送成功。");
        loadMessages().catch(error => console.warn("留言已保存，但刷新消息列表失败", error));
      } catch (error) {
        console.error("邻伊留言发送失败", error);
        setNotice("发送失败：" + (error && error.message ? error.message : "未知错误"), true);
      } finally {
        send.disabled = !ready;
      }
    });

    // 所有指向在线交流页的入口改为直接打开浮窗。
    document.addEventListener("click", event => {
      const link = event.target.closest && event.target.closest('a[href*="jiaoliu.html"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openPanel();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && panel.classList.contains("open")) closePanel();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && ready && pollTimer) pollMessages();
    });
    window.addEventListener("beforeunload", () => {
      stopMessagePolling();
      clearRealtimeConnectTimer();
      if (channel && client) client.removeChannel(channel);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();