// 邻伊网站 交互脚本
document.addEventListener('DOMContentLoaded', function () {
  // 移动端菜单
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  // 移动端子菜单展开
  document.querySelectorAll('.main-nav > li').forEach(function (li) {
    const link = li.querySelector(':scope > a');
    const dropdown = li.querySelector('.dropdown');
    if (dropdown && link) {
      link.addEventListener('click', function (e) {
        if (window.innerWidth <= 900) {
          e.preventDefault();
          li.classList.toggle('open');
        }
      });
    }
  });


  // 首页站内搜索：仅在浏览器本地匹配，不上传搜索词。
  const searchForm = document.getElementById('siteSearchForm');
  const searchInput = document.getElementById('siteSearchInput');
  const searchResults = document.getElementById('siteSearchResults');
  const knowledgeIndex = [
    {title:'IVF 基础知识：体外受精是什么？',desc:'了解体外受精与胚胎移植的基本概念。',url:'pages/kepu.html#ivf',keys:'IVF 试管婴儿 体外受精 胚胎移植'},
    {title:'促排卵基础知识',desc:'了解促排卵的目的、监测概念与用药边界。',url:'pages/kepu.html#cui-pai',keys:'促排卵 促排 卵泡 药物 监测'},
    {title:'取卵与受精过程',desc:'了解取卵、受精和实验室环节的基本概念。',url:'pages/kepu.html#quluan',keys:'取卵 受精 取精 实验室'},
    {title:'胚胎培养与移植科普',desc:'了解胚胎培养、评估和移植的概念。',url:'pages/kepu.html#peitai',keys:'胚胎 培养 移植 囊胚 冻胚'},
    {title:'冻胚与冻卵知识',desc:'了解冻胚、冻卵保存对象和流程差异。',url:'pages/kepu.html#dongluan',keys:'冻胚 冻卵 冷冻 保存 生育力'},
    {title:'辅助生殖伦理与风险',desc:'了解知情同意、机构资质、隐私与风险。',url:'pages/kepu.html#lunli',keys:'伦理 风险 隐私 资质 知情同意'},
    {title:'常见检查解读',desc:'了解 AMH、超声及男性相关检查的基础概念。',url:'pages/kepu.html#jiancha',keys:'AMH 检查 报告 卵巢储备 精液'},
    {title:'年龄与生育力',desc:'了解年龄与生育力变化的基本知识。',url:'pages/kepu.html#nianling',keys:'年龄 生育力 卵巢储备'},
    {title:'常见问题问答',desc:'按分类浏览辅助生殖和生育健康高频问题。',url:'pages/faq.html',keys:'FAQ 常见问题 问答'},
    {title:'在线交流与服务边界',desc:'了解邻伊的非诊疗服务范围与隐私提醒。',url:'pages/jiaoliu.html',keys:'在线交流 反馈 隐私 服务'}
  ];
  function runSiteSearch(value) {
    if (!searchResults) return;
    const query = (value || '').trim().toLowerCase();
    searchResults.textContent = '';
    if (!query) { searchResults.textContent = '请输入关键词，例如 IVF、AMH、促排卵或胚胎培养。'; return; }
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = knowledgeIndex.filter(item => terms.some(term => (item.title+' '+item.desc+' '+item.keys).toLowerCase().includes(term)));
    if (!matches.length) { searchResults.textContent = '暂未找到相关内容。可以尝试“IVF”“检查”“胚胎”或浏览科普专题。'; return; }
    matches.forEach(item => {
      const a = document.createElement('a'); a.className = 'site-search-result'; a.href = item.url;
      const strong = document.createElement('strong'); strong.textContent = item.title;
      const small = document.createElement('small'); small.textContent = item.desc;
      a.append(strong, small); searchResults.appendChild(a);
    });
  }
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', function(e){ e.preventDefault(); runSiteSearch(searchInput.value); });
    searchInput.addEventListener('input', function(){ if (searchInput.value.trim().length >= 2) runSiteSearch(searchInput.value); else if(searchResults) searchResults.textContent=''; });
  }

  // FAQ 本地筛选：不把搜索词发送到服务器。
  const faqForm = document.getElementById('faqSearchForm');
  const faqInput = document.getElementById('faqSearchInput');
  if (faqForm && faqInput) {
    const cards = Array.from(document.querySelectorAll('.faq-card'));
    const count = document.getElementById('faqSearchCount');
    const noResults = document.getElementById('faqNoResults');
    function filterFaq() {
      const q = faqInput.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach(card => {
        const show = !q || (card.innerText+' '+(card.dataset.search || '')).toLowerCase().includes(q);
        card.hidden = !show; if (show) visible++;
      });
      document.querySelectorAll('.faq-group').forEach(group => { group.hidden = !Array.from(group.querySelectorAll('.faq-card')).some(card => !card.hidden); });
      if (count) count.textContent = q ? '找到 '+visible+' 个相关问题' : '可搜索下方全部问答';
      if (noResults) noResults.hidden = visible !== 0;
    }
    faqForm.addEventListener('submit', function(e){ e.preventDefault(); filterFaq(); });
    faqInput.addEventListener('input', filterFaq);
  }


  // FAQ 手风琴
  document.querySelectorAll('.faq-question').forEach(function (q) {
    q.addEventListener('click', function () {
      const item = this.parentElement;
      const isOpen = item.classList.contains('open');
      // 可选：只开一个
      document.querySelectorAll('.faq-item.open').forEach(function (el) {
        el.classList.remove('open');
      });
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
});

  // 邻伊 AI 科普助手：所有页面统一加载
(function initLinyiAI() {
  const SUPABASE_URL = "https://rhmoeecrznpkhtkoktng.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rKZZQZ5ULF11IcXyWHggmg_CX24p7od";
  if (document.getElementById("linyi-ai-launcher")) return;

  const style = document.createElement("style");
  style.textContent = `
    #linyi-ai-launcher{position:fixed;right:22px;bottom:22px;z-index:2147483000;border:0;border-radius:28px;padding:14px 19px;background:#315d4b;color:#fff;font:600 15px Arial,sans-serif;box-shadow:0 5px 22px #0003;cursor:pointer}
    #linyi-ai-panel{position:fixed;right:20px;bottom:82px;width:min(370px,calc(100vw - 28px));height:min(540px,calc(100vh - 120px));z-index:2147483000;background:#fff;border:1px solid #d9e3dc;border-radius:16px;box-shadow:0 10px 35px #0003;display:none;overflow:hidden;font-family:Arial,sans-serif;color:#263b30}
    #linyi-ai-panel.open{display:flex;flex-direction:column}
    #linyi-ai-head{padding:14px 16px;background:#315d4b;color:#fff;display:flex;justify-content:space-between;align-items:center}
    #linyi-ai-head button{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer}
    #linyi-ai-messages{padding:14px;overflow:auto;flex:1;background:#fafcf9}
    #linyi-ai-messages p{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;border-radius:12px;margin:8px 0;max-width:90%;font-size:14px;line-height:1.55}
    #linyi-ai-messages .user{background:#e5f0e9;margin-left:auto}
    #linyi-ai-messages .bot{background:#f0f2ef;margin-right:auto}
    #linyi-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e9e5}
    #linyi-ai-input{min-width:0;flex:1;border:1px solid #cbd7ce;border-radius:10px;padding:10px;font:inherit}
    #linyi-ai-form button{border:0;border-radius:10px;background:#315d4b;color:#fff;padding:0 15px;cursor:pointer}
    #linyi-ai-note{font-size:11px;color:#68766d;padding:0 13px 10px}
    @media(max-width:480px){#linyi-ai-launcher{right:14px;bottom:14px}#linyi-ai-panel{right:10px;bottom:72px}}
  `;

  const launcher = document.createElement("button");
  launcher.id = "linyi-ai-launcher";
  launcher.type = "button";
  launcher.textContent = "✦ AI 科普问答";
  launcher.setAttribute("aria-label", "打开 AI 科普问答");

  const panel = document.createElement("section");
  panel.id = "linyi-ai-panel";
  panel.setAttribute("aria-label", "邻伊 AI 科普助手");
  panel.innerHTML = '<div id="linyi-ai-head"><strong>邻伊 AI 科普助手</strong><button type="button" aria-label="关闭">×</button></div><div id="linyi-ai-messages" aria-live="polite"><p class="bot">你好！我可以帮助查找一般生育健康与辅助生殖知识。不能诊断、解读个人报告、提供用药或治疗建议。请勿输入任何个人或健康隐私信息。</p></div><form id="linyi-ai-form"><input id="linyi-ai-input" maxlength="2000" placeholder="请输入你的问题…" required><button type="submit">发送</button></form><div id="linyi-ai-note">仅限一般知识科普；不诊断、不解读个人报告、不提供用药或治疗建议。请勿输入姓名、手机号、身份证号、病历或检查报告。</div>';

  document.head.appendChild(style);
  document.body.append(launcher, panel);

  launcher.addEventListener("click", function () {
    panel.classList.toggle("open");
  });
  panel.querySelector("#linyi-ai-head button").addEventListener("click", function () {
    panel.classList.remove("open");
  });

  const messages = panel.querySelector("#linyi-ai-messages");
  const form = panel.querySelector("#linyi-ai-form");
  const input = panel.querySelector("#linyi-ai-input");
  const send = form.querySelector("button");
  const history = [];

  function addMessage(text, role) {
    const p = document.createElement("p");
    p.className = role;
    p.textContent = text;
    messages.appendChild(p);
    messages.scrollTop = messages.scrollHeight;
    return p;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    // 敏感个人信息和个体化诊疗请求不发送给 AI。
    const hasPersonalId = /(?:1[3-9]\d{9}|\d{17}[0-9Xx])/i.test(question);
    const clinicalRequest = /(我的(检查|报告|化验|B超|超声|AMH|病历)|报告(显示|提示|结果)|数值(偏高|偏低)|帮我(诊断|判断|看报告|制定方案)|该吃什么药|用药剂量|打多少(单位|针)|促排方案|成功率(多少|预测)|是否(能怀孕|适合试管)|症状.*怎么办)/i.test(question);
    if (hasPersonalId || clinicalRequest) {
      addMessage(hasPersonalId
        ? "为保护隐私，请不要提交身份证号或手机号。此内容未发送。"
        : "这个问题涉及个人检查结果或诊疗决策，我不能进行诊断、报告解读、用药指导或成功率预测。请向正规医疗机构的专业人员咨询。你可以改问一般概念，例如“AMH 是什么？”或“胚胎培养是什么意思？”。此内容未发送。", "bot");
      input.value = "";
      return;
    }

    history.push({ role: "user", content: question });
    addMessage(question, "user");
    input.value = "";
    send.disabled = true;
    const waiting = addMessage("正在思考…", "bot");

    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/linyi-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY
        },
        body: JSON.stringify({ action: "chat", messages: history })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "暂时无法回答，请稍后重试。");
      waiting.textContent = result.answer || "暂时没有得到回答。";
      history.push({ role: "assistant", content: waiting.textContent });
      if (history.length > 12) history.splice(0, 2);
    } catch (error) {
      waiting.textContent = error.message || "连接失败，请稍后重试。";
      history.pop();
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
})();


// 全站加载右下角在线交流浮窗；保留左下角 AI 科普助手。
(function loadLinyiChatWidget() {
  if (document.getElementById("linyi-chat-widget-loader")) return;
  const script = document.createElement("script");
  script.id = "linyi-chat-widget-loader";
  script.src = new URL("chat-widget.js", document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : window.location.href.replace(/[^/]*$/, "js/main.js")).href;
  script.defer = true;
  document.head.appendChild(script);
})();
