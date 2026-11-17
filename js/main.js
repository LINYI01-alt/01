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
    if (!window.LINYI_SUPABASE_URL || !window.LINYI_SUPABASE_PUBLISHABLE_KEY) {\n      const script=document.createElement("script"); script.src=(location.pathname.includes("/pages/")?"../":"")+"js/supabase-config.js"; document.head.appendChild(script);\n      script.onload=initLinyiAI; return;\n    }\n    const cfg = window.LINYI_SUPABASE_URL && window.LINYI_SUPABASE_PUBLISHABLE_KEY;
    if (!cfg || document.getElementById("linyi-ai-launcher")) return;
    const style = document.createElement("style");
    style.textContent = `
      #linyi-ai-launcher{position:fixed;right:22px;bottom:22px;z-index:9998;border:0;border-radius:28px;padding:14px 19px;background:#315d4b;color:#fff;font:600 15px inherit;box-shadow:0 5px 22px #0003;cursor:pointer}
      #linyi-ai-panel{position:fixed;right:20px;bottom:82px;width:min(370px,calc(100vw - 28px));height:min(540px,calc(100vh - 120px));z-index:9999;background:#fff;border:1px solid #d9e3dc;border-radius:16px;box-shadow:0 10px 35px #0003;display:none;overflow:hidden;font-family:inherit;color:#263b30}
      #linyi-ai-panel.open{display:flex;flex-direction:column}#linyi-ai-head{padding:14px 16px;background:#315d4b;color:#fff;display:flex;justify-content:space-between;align-items:center}
      #linyi-ai-head button{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer}
      #linyi-ai-messages{padding:14px;overflow:auto;flex:1;background:#fafcf9}#linyi-ai-messages p{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;border-radius:12px;margin:8px 0;max-width:90%;font-size:14px;line-height:1.55}
      #linyi-ai-messages .user{background:#e5f0e9;margin-left:auto}#linyi-ai-messages .bot{background:#f0f2ef;margin-right:auto}
      #linyi-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e9e5}#linyi-ai-input{min-width:0;flex:1;border:1px solid #cbd7ce;border-radius:10px;padding:10px;font:inherit}
      #linyi-ai-form button{border:0;border-radius:10px;background:#315d4b;color:#fff;padding:0 15px;cursor:pointer}
      #linyi-ai-note{font-size:11px;color:#68766d;padding:0 13px 10px}
    `;
    document.head.appendChild(style);
    const launcher=document.createElement("button");launcher.id="linyi-ai-launcher";launcher.type="button";launcher.textContent="✦ AI 科普问答";
    const panel=document.createElement("section");panel.id="linyi-ai-panel";panel.setAttribute("aria-label","邻伊 AI 科普助手");
    panel.innerHTML='<div id="linyi-ai-head"><strong>邻伊 AI 科普助手</strong><button type="button" aria-label="关闭">×</button></div><div id="linyi-ai-messages" aria-live="polite"><p class="bot">你好！可以问我生育基础、检查项目和辅助生殖相关的科普问题。</p></div><form id="linyi-ai-form"><input id="linyi-ai-input" maxlength="2000" placeholder="请输入你的问题…" required><button type="submit">发送</button></form><div id="linyi-ai-note">仅供科普参考，不构成诊断或治疗建议；请勿输入姓名、联系方式等隐私信息。</div>';
    document.body.append(launcher,panel);
    launcher.addEventListener("click",()=>panel.classList.toggle("open"));
    panel.querySelector("#linyi-ai-head button").addEventListener("click",()=>panel.classList.remove("open"));
    const messages=panel.querySelector("#linyi-ai-messages"),form=panel.querySelector("form"),input=panel.querySelector("input"),send=panel.querySelector("form button");
    const history=[];
    function add(text,role){const p=document.createElement("p");p.className=role;p.textContent=text;messages.appendChild(p);messages.scrollTop=messages.scrollHeight;return p;}
    form.addEventListener("submit",async e=>{
      e.preventDefault();const text=input.value.trim();if(!text)return;
      history.push({role:"user",content:text});add(text,"user");input.value="";send.disabled=true;const waiting=add("正在思考…","bot");
      try{
        const res=await fetch(window.LINYI_SUPABASE_URL+"/functions/v1/linyi-ai",{method:"POST",headers:{"Content-Type":"application/json","apikey":window.LINYI_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:"chat",messages:history})});
        const data=await res.json();if(!res.ok)throw new Error(data.error||"暂时无法回答，请稍后重试。");
        waiting.textContent=data.answer||"暂时没有得到回答。";history.push({role:"assistant",content:waiting.textContent});
        if(history.length>12)history.splice(0,2);
      }catch(err){waiting.textContent=err.message||"连接失败，请稍后重试。";history.pop();}
      finally{send.disabled=false;input.focus();}
    });
  })();
