// 邻伊网站 交互脚本
document.addEventListener('DOMContentLoaded', function () {
  // 多语言翻译：通过 Google 网站翻译为页面文字提供实际翻译能力。
  const languagePicker = document.getElementById('siteLanguage');
  if (languagePicker) {
    const translateHost = document.createElement('div');
    translateHost.id = 'google_translate_element';
    translateHost.setAttribute('aria-hidden', 'true');
    translateHost.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(translateHost);

    window.googleTranslateElementInit = function () {
      if (window.google && google.translate && google.translate.TranslateElement) {
        new google.translate.TranslateElement({
          pageLanguage: 'zh-CN',
          includedLanguages: 'zh-TW,en,ja,ko,fr,de,es,pt,ru',
          autoDisplay: false
        }, 'google_translate_element');
      }
    };

    const translateScript = document.createElement('script');
    translateScript.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    translateScript.async = true;
    document.head.appendChild(translateScript);

    languagePicker.addEventListener('change', function () {
      const targetLanguage = this.value;
      if (targetLanguage === 'zh-CN') {
        // 恢复原始简体中文页面。
        document.cookie = 'googtrans=/zh-CN/zh-CN;path=/';
        document.cookie = 'googtrans=/zh-CN/zh-CN;path=/;domain=' + location.hostname;
        location.reload();
        return;
      }
      let attempts = 0;
      const chooseTranslation = function () {
        const googlePicker = document.querySelector('.goog-te-combo');
        if (googlePicker) {
          googlePicker.value = targetLanguage;
          googlePicker.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (attempts++ < 30) {
          window.setTimeout(chooseTranslation, 300);
        } else {
          console.warn('网页翻译组件暂不可用，请检查网络后重试。');
        }
      };
      chooseTranslation();
    });
  }
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


  // 首页综合搜索：先匹配本站内容，同时提供全网网页、医学文献和专业指南搜索入口。
  const searchForm = document.getElementById('siteSearchForm');
  const searchInput = document.getElementById('siteSearchInput');
  const searchResults = document.getElementById('siteSearchResults');
  const knowledgeIndex = [
    {title:'生育基础认知',desc:'了解自然受孕过程、生育力相关因素与何时寻求专业评估。',url:'pages/kepu.html#jichu',keys:'生育基础 自然受孕 受孕过程 生育力 不孕 不孕症'},
    {title:'身体与备孕',desc:'了解备孕期间的身体准备、双方参与和生活节奏。',url:'pages/kepu.html#beiyun',keys:'备孕 备孕准备 孕前准备 身体准备 夫妻 双方'},
    {title:'常见检查解读：AMH与卵巢储备',desc:'认识AMH、超声、卵巢储备及男性生育相关检查。',url:'pages/kepu.html#jiancha',keys:'AMH 抗缪勒管激素 卵巢储备 卵巢功能 检查 报告 超声 精液分析 精子'},
    {title:'年龄与生育力',desc:'了解年龄与女性、男性生育力相关因素。',url:'pages/kepu.html#nianling',keys:'年龄 生育力 女性年龄 卵巢储备 高龄生育'},
    {title:'生活方式与生育',desc:'了解睡眠、饮食、运动、烟酒与压力等生活方式因素。',url:'pages/kepu.html#shenghuo',keys:'生活方式 饮食 睡眠 运动 压力 吸烟 饮酒 生育健康'},
    {title:'心理与情绪管理',desc:'了解备孕和辅助生殖过程中的常见情绪体验与支持方式。',url:'pages/kepu.html#xinli',keys:'心理 情绪 焦虑 压力 心理支持 备孕情绪'},
    {title:'IVF基础知识：体外受精与试管婴儿',desc:'了解IVF、体外受精与胚胎移植的基本概念。',url:'pages/kepu.html#ivf',keys:'IVF 试管婴儿 体外受精 体外受精胚胎移植 ART 辅助生殖'},
    {title:'促排卵基础知识',desc:'了解促排卵的目的、卵泡监测概念与用药边界。',url:'pages/kepu.html#cui-pai',keys:'促排卵 促排 卵泡 药物 监测 控制性卵巢刺激'},
    {title:'取卵与受精过程',desc:'了解取卵、取精、受精和实验室环节的基本概念。',url:'pages/kepu.html#quluan',keys:'取卵 受精 取精 实验室 卵子 精子 ICSI'},
    {title:'胚胎培养与移植科普',desc:'了解胚胎培养、囊胚、胚胎评估和移植的概念。',url:'pages/kepu.html#peitai',keys:'胚胎 培养 移植 囊胚 胚胎等级 冻胚 新鲜移植'},
    {title:'冻胚与冻卵知识',desc:'了解冻胚、冻卵保存对象和生育力保存的差异。',url:'pages/kepu.html#dongluan',keys:'冻胚 冻卵 冷冻 保存 生育力保存 卵子冷冻 胚胎冷冻'},
    {title:'辅助生殖伦理与风险',desc:'了解知情同意、机构资质、隐私与医疗风险。',url:'pages/kepu.html#lunli',keys:'伦理 风险 隐私 资质 知情同意 法律 规范'},
    {title:'辅助生殖技术专题解读',desc:'了解人工授精、IVF及相关辅助生殖技术概念。',url:'pages/zhuanti.html#fuzhu',keys:'辅助生殖技术 人工授精 IUI IVF ICSI'},
    {title:'不同年龄段的生育力关注点',desc:'按年龄阶段了解生育规划相关知识。',url:'pages/zhuanti.html#nianling',keys:'年龄 生育力 高龄 备孕 生育规划'},
    {title:'检查报告怎么看',desc:'了解常见生育检查报告的阅读思路与局限。',url:'pages/zhuanti.html#baogao',keys:'检查报告 AMH 激素 卵巢储备 超声 精液'},
    {title:'试管婴儿治疗周期全流程',desc:'了解辅助生殖治疗周期各阶段的概念与时间不确定性。',url:'pages/zhuanti.html#zhouqi',keys:'试管婴儿流程 IVF流程 治疗周期 促排 取卵 移植'},
    {title:'冻卵与生育力保存专题',desc:'了解卵子冷冻、生育力保存的现实限制与知情选择。',url:'pages/zhuanti.html#dongluan',keys:'冻卵 卵子冷冻 生育力保存 冷冻保存'},
    {title:'辅助生殖常见误区澄清',desc:'辨别成功率、偏方、检查结果与网络经验中的常见误区。',url:'pages/zhuanti.html#wuqu',keys:'辅助生殖误区 成功率 偏方 IVF成功率'},
    {title:'反复种植失败（RIF）',desc:'了解RIF的定义、可能因素和系统评估思路。',url:'pages/faq.html#faq-repeat-failure',keys:'RIF 反复种植失败 反复移植失败 未着床 胚胎移植失败'},
    {title:'常见问题问答',desc:'按分类浏览IVF、AMH、促排卵、胚胎移植等高频问题。',url:'pages/faq.html',keys:'FAQ 常见问题 问答 试管婴儿'},
    {title:'在线交流与服务边界',desc:'了解邻伊的非诊疗服务范围与隐私提醒。',url:'pages/jiaoliu.html',keys:'在线交流 反馈 隐私 服务范围'}
  ];
  function runSiteSearch(value) {
    if (!searchResults) return;
    const query = (value || '').trim().toLowerCase();
    searchResults.textContent = '';
    if (!query) { searchResults.textContent = '请输入关键词，例如 IVF、AMH、反复种植失败或胚胎培养。'; return; }
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = knowledgeIndex.filter(item => terms.some(term => (item.title+' '+item.desc+' '+item.keys).toLowerCase().includes(term)));

    const heading = document.createElement('h3');
    heading.textContent = '邻伊站内内容';
    searchResults.appendChild(heading);
    if (matches.length) {
      matches.forEach(item => {
        const a = document.createElement('a'); a.className = 'site-search-result'; a.href = item.url;
        const strong = document.createElement('strong'); strong.textContent = item.title;
        const small = document.createElement('small'); small.textContent = item.desc;
        a.append(strong, small); searchResults.appendChild(a);
      });
    } else {
      const empty = document.createElement('p');
      empty.textContent = '本站暂时没有匹配的文章。你可以继续使用下面的全网搜索，不必局限于本站。';
      searchResults.appendChild(empty);
    }

    const webHeading = document.createElement('h3');
    webHeading.textContent = '全网搜索与医学资料';
    webHeading.style.marginTop = '22px';
    searchResults.appendChild(webHeading);
    const encoded = encodeURIComponent(value.trim());
    const guidelineQuery = encodeURIComponent(value.trim() + ' (ASRM OR ESHRE OR HFEA)');
    const links = [
      {label:'Google 全网搜索',desc:'搜索互联网网页、医院科普及相关资料。',url:'https://www.google.com/search?q='+encoded+'&hl=zh-CN'},
      {label:'Bing 全网搜索',desc:'使用另一搜索引擎查找网页和相关内容。',url:'https://www.bing.com/search?q='+encoded},
      {label:'PubMed 医学文献',desc:'查找生殖医学、妇产科学及辅助生殖研究论文。',url:'https://pubmed.ncbi.nlm.nih.gov/?term='+encoded},
      {label:'专业机构指南检索',desc:'重点查找 ASRM、ESHRE、HFEA 等专业机构发布的指南和声明。',url:'https://www.google.com/search?q='+guidelineQuery}
    ];
    links.forEach(item => {
      const a = document.createElement('a');
      a.className = 'site-search-result';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const strong = document.createElement('strong'); strong.textContent = item.label;
      const small = document.createElement('small'); small.textContent = item.desc;
      a.append(strong, small);
      searchResults.appendChild(a);
    });
    const note = document.createElement('p');
    note.className = 'search-help';
    note.textContent = '提示：外部搜索由相应平台提供，搜索词会发送给该平台。医学信息请优先核对专业指南、同行评审研究及正规医疗机构资料；搜索结果不能替代医生诊疗。';
    searchResults.appendChild(note);
  }
  if (searchForm && searchInput) {
    const enginePicker = document.getElementById('siteSearchEngine');
    const engines = {
      baidu: { action: 'https://www.baidu.com/s', field: 'wd' },
      bing: { action: 'https://cn.bing.com/search', field: 'q' },
      '360': { action: 'https://www.so.com/s', field: 'q' },
      sogou: { action: 'https://www.sogou.com/web', field: 'query' },
      google: { action: 'https://www.google.com/search', field: 'q' },
      pubmed: { action: 'https://pubmed.ncbi.nlm.nih.gov/', field: 'term' }
    };
    searchForm.method = 'get';
    searchForm.target = '_blank';
    function setSearchEngine() {
      const engine = engines[enginePicker ? enginePicker.value : 'baidu'] || engines.baidu;
      searchForm.action = engine.action;
      searchInput.name = engine.field;
    }
    if (enginePicker) enginePicker.addEventListener('change', setSearchEngine);
    setSearchEngine();
    searchForm.addEventListener('submit', function(){ setSearchEngine(); runSiteSearch(searchInput.value); });
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

  // AI 科普助手独立模块：支持历史会话恢复，避免主站脚本过长。
(function loadLinyiAIAssistant() {
  if (document.getElementById("linyi-ai-assistant-loader")) return;
  const current = document.querySelector('script[src*="js/main.js"]');
  const base = current && current.src ? current.src : new URL("js/main.js", location.href).href;
  const script = document.createElement("script");
  script.id = "linyi-ai-assistant-loader";
  script.src = new URL("ai-assistant.js", base).href;
  script.defer = true;
  document.head.appendChild(script);
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


// 统一匿名访客统计：复用 Supabase Anonymous Auth UUID，不再生成独立 analytics visitor key。
(function recordAnonymousPageView() {
  if (/\/admin\.html$/i.test(window.location.pathname)) return;
  const mainScript = document.querySelector('script[src*="js/main.js"]');
  const helperUrl = new URL("visitor-identity.js", mainScript && mainScript.src ? mainScript.src : window.location.href.replace(/[^/]*$/, "js/main.js")).href;
  const existing = Array.from(document.scripts).find(script => script.src === helperUrl);
  const record = () => {
    if (typeof window.linyiRecordPageView === "function") {
      window.linyiRecordPageView(window.location.pathname.slice(0, 300) || "/");
    }
  };
  if (window.linyiRecordPageView) {
    record();
  } else if (existing) {
    existing.addEventListener("load", record, { once: true });
  } else {
    const script = document.createElement("script");
    script.src = helperUrl;
    script.onload = record;
    script.onerror = () => console.warn("统一访客统计组件加载失败。");
    document.head.appendChild(script);
  }
})();
