/* Shared anonymous visitor identity for AI, human chat and analytics. */
(function () {
  if (window.linyiGetVisitorSession) return;

  let clientPromise = null;
  let pageViewRecorded = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(s => s.src === src);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error("无法加载访客身份服务。"));
      document.head.appendChild(script);
    });
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const script = document.querySelector('script[src*="js/visitor-identity.js"]');
        const base = script && script.src ? script.src : new URL("js/visitor-identity.js", location.href).href;
        if (!window.supabase || !window.supabase.createClient) {
          await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
        }
        if (!window.linyiCreateSupabaseClient) {
          await loadScript(new URL("supabase-config.js", base).href);
        }
        return window.linyiCreateSupabaseClient();
      })().catch(error => {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  window.linyiGetVisitorSession = async function () {
    const client = await getClient();
    let { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      const result = await client.auth.signInAnonymously();
      if (result.error) throw result.error;
      data = { session: result.data.session };
    }
    if (!data.session || !data.session.user) throw new Error("无法建立访客身份，请刷新页面重试。");
    return { client, session: data.session, user: data.session.user };
  };

  window.linyiRecordPageView = async function (pagePath) {
    if (pageViewRecorded || /\/admin\.html$/i.test(location.pathname)) return;
    pageViewRecorded = true;
    try {
      const { client } = await window.linyiGetVisitorSession();
      const { error } = await client.rpc("record_visitor_page_view", {
        p_page_path: String(pagePath || location.pathname).slice(0, 300)
      });
      if (error) throw error;
    } catch (error) {
      pageViewRecorded = false;
      console.warn("访客统计暂不可用", error && error.message);
    }
  };
})();
