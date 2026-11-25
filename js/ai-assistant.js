/* 邻伊 AI 科普助手：访客身份复用、历史对话列表与自动恢复。 */
(function () {
  if (document.getElementById("linyi-ai-launcher")) return;
  const AI_URL = "https://rhmoeecrznpkhtkoktng.supabase.co/functions/v1/linyi-ai";
  const style = document.createElement("style");
  style.textContent = `
    #linyi-ai-launcher{position:fixed;left:22px;bottom:22px;z-index:2147483000;border:0;border-radius:28px;padding:14px 19px;background:#315d4b;color:#fff;font:600 15px Arial,sans-serif;box-shadow:0 5px 22px #0003;cursor:pointer}
    #linyi-ai-panel{position:fixed;left:20px;bottom:82px;width:min(410px,calc(100vw - 28px));height:min(620px,calc(100vh - 120px));z-index:2147483000;background:#fff;border:1px solid #d9e3dc;border-radius:16px;box-shadow:0 10px 35px #0003;display:none;overflow:hidden;font-family:Arial,sans-serif;color:#263b30}
    #linyi-ai-panel.open{display:flex;flex-direction:column}
    #linyi-ai-head{padding:12px 14px;background:#315d4b;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px}
    #linyi-ai-head button{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer}
    #linyi-ai-actions{display:flex;gap:7px;padding:8px 10px;border-bottom:1px solid #e5e9e5;background:#f8faf8}
    #linyi-ai-actions button{border:1px solid #d4dfd6;border-radius:16px;background:#fff;color:#315d4b;padding:6px 10px;font-size:12px;cursor:pointer}
    #linyi-ai-history{display:none;max-height:150px;overflow:auto;padding:7px 10px;background:#f7faf7;border-bottom:1px solid #e5e9e5}
    #linyi-ai-history.open{display:block}
    .linyi-ai-history-item{display:block;width:100%;text-align:left;border:0;border-radius:8px;background:#fff;padding:8px;margin:3px 0;color:#35483d;cursor:pointer;font-size:12px}
    .linyi-ai-history-item:hover{background:#eaf2ec}
    #linyi-ai-messages{padding:14px;overflow:auto;flex:1;background:#fafcf9}
    #linyi-ai-messages p{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;border-radius:12px;margin:8px 0;max-width:90%;font-size:14px;line-height:1.6}
    #linyi-ai-messages .user{background:#e5f0e9;margin-left:auto}
    #linyi-ai-messages .bot{background:#f0f2ef;margin-right:auto}
    #linyi-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e9e5}
    #linyi-ai-input{min-width:0;flex:1;border:1px solid #cbd7ce;border-radius:10px;padding:10px;font:inherit}
    #linyi-ai-form button{border:0;border-radius:10px;background:#315d4b;color:#fff;padding:0 15px;cursor:pointer}
    #linyi-ai-form button:disabled{opacity:.55;cursor:not-allowed}
    #linyi-ai-note{font-size:11px;color:#68766d;padding:0 13px 10px}
    @media(max-width:480px){#linyi-ai-launcher{left:14px;bottom:14px}#linyi-ai-panel{left:8px;bottom:72px;width:calc(100vw - 16px);height:min(620px,calc(100dvh - 82px))}}
  `;
  document.head.appendChild(style);
  const launcher=document.createElement("button"); launcher.id="linyi-ai-launcher"; launcher.type="button"; launcher.textContent="✦ AI 科普问答";
  const panel=document.createElement("section"); panel.id="linyi-ai-panel"; panel.setAttribute("aria-label","邻伊 AI 科普助手");
  panel.innerHTML='<div id="linyi-ai-head"><strong>邻伊 AI 科普助手</strong><button type="button" aria-label="关闭">×</button></div><div id="linyi-ai-actions"><button id="linyi-ai-new" type="button">＋ 新建对话</button><button id="linyi-ai-history-toggle" type="button">历史对话</button><span id="linyi-ai-status" style="margin-left:auto;font-size:11px;align-self:center">自动保存</span></div><div id="linyi-ai-history" aria-label="历史对话列表"></div><div id="linyi-ai-messages" aria-live="polite"></div><form id="linyi-ai-form"><input id="linyi-ai-input" maxlength="2000" placeholder="请输入你的问题…" required><button type="submit">发送</button></form><div id="linyi-ai-note">提问额度：每位访客每天最多 50 次、每月最多 500 次；同一网络每 15 分钟最多 20 次。仅限试管婴儿与辅助生殖知识科普；不诊断、不解读个人报告、不提供用药或治疗建议。请勿输入姓名、手机号、身份证号、病历或检查报告。</div>';
  document.body.append(launcher,panel);
  const messages=panel.querySelector("#linyi-ai-messages"), form=panel.querySelector("#linyi-ai-form"), input=panel.querySelector("#linyi-ai-input"), send=form.querySelector("button"), historyBox=panel.querySelector("#linyi-ai-history"), status=panel.querySelector("#linyi-ai-status");
  let identity=null, conversationId="", history=[], historyLoaded=false;
  const key="linyi_ai_conversation_id";
  try{conversationId=localStorage.getItem(key)||"";}catch(_){}
  function add(text,role){const p=document.createElement("p");p.className=role;p.textContent=text;messages.appendChild(p);messages.scrollTop=messages.scrollHeight;return p;}
  function greeting(){messages.replaceChildren();add("你好！我可以帮助查找一般生育健康与辅助生殖知识。不能诊断、解读个人报告、提供用药或治疗建议。请勿输入任何个人或健康隐私信息。","bot");}
  async function ensureIdentity(){
    if(!window.linyiGetVisitorSession){
      const ownScript=document.querySelector('script[src*="ai-assistant.js"]');
      const base=ownScript&&ownScript.src?ownScript.src:new URL("js/ai-assistant.js",location.href).href;
      const src=new URL("visitor-identity.js",base).href;
      await new Promise((resolve,reject)=>{
        if(window.linyiGetVisitorSession) return resolve();
        const existing=Array.from(document.scripts).find(s=>s.src===src);
        if(existing){
          existing.addEventListener("load",resolve,{once:true});
          existing.addEventListener("error",reject,{once:true});
          return;
        }
        const script=document.createElement("script");
        script.src=src;
        script.onload=resolve;
        script.onerror=()=>reject(new Error("访客身份组件加载失败，请刷新页面重试。"));
        document.head.appendChild(script);
      });
    }
    if(!window.linyiGetVisitorSession) throw new Error("访客身份组件未能初始化，请刷新页面重试。");
    if(!identity) identity=await window.linyiGetVisitorSession();
    return identity;
  }
  async function api(body){
    const id=await ensureIdentity();
    const controller=new AbortController();
    const timeoutId=window.setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":window.LINYI_SUPABASE_PUBLISHABLE_KEY,"Authorization":"Bearer "+id.session.access_token},body:JSON.stringify(body),signal:controller.signal});
      const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{};}catch(_){throw new Error("AI 服务返回格式异常（HTTP "+response.status+"）。");}
      if(!response.ok)throw new Error((data.error||"请求失败")+"（HTTP "+response.status+"）");
      return data;
    }catch(error){
      if(error&&error.name==="AbortError")throw new Error("AI 服务响应超过 45 秒，已停止等待。请稍后重试。");
      if(error instanceof TypeError)throw new Error("无法连接 AI 服务，请检查网络后重试。");
      throw error;
    }finally{window.clearTimeout(timeoutId);}
  }
  function renderConversation(logs){
    history=[];messages.replaceChildren();
    if(!logs.length){greeting();return;}
    logs.forEach(item=>{add(item.question,"user");add(item.answer,"bot");history.push({role:"user",content:item.question},{role:"assistant",content:item.answer});});
    messages.scrollTop=messages.scrollHeight;
  }
  async function loadHistory(){
    status.textContent="正在同步…";
    const data=await api({action:"history"});
    const conversations=data.conversations||[], logs=data.messages||[];
    historyBox.replaceChildren();
    if(!conversations.length){const empty=document.createElement("div");empty.textContent="还没有历史对话";empty.style.cssText="font-size:12px;color:#78857c;padding:8px";historyBox.appendChild(empty);}
    conversations.forEach(c=>{
      const btn=document.createElement("button");btn.type="button";btn.className="linyi-ai-history-item";
      const related=logs.filter(m=>m.conversation_id===c.id);
      const first=related[0]?.question||c.title||"AI 科普问答";
      btn.textContent=first.slice(0,55)+" · "+new Date(c.updated_at).toLocaleString("zh-CN");
      btn.addEventListener("click",()=>{conversationId=c.id;try{localStorage.setItem(key,conversationId);}catch(_){}renderConversation(related);historyBox.classList.remove("open");status.textContent="已保存";});
      historyBox.appendChild(btn);
    });
    const active=conversations.find(c=>c.id===conversationId);
    if(active)renderConversation(logs.filter(m=>m.conversation_id===conversationId));
    else if(!historyLoaded) {conversationId="";try{localStorage.removeItem(key);}catch(_){}greeting();}
    historyLoaded=true;status.textContent="自动保存";
  }
  launcher.addEventListener("click",async()=>{panel.classList.toggle("open");if(panel.classList.contains("open")&&!historyLoaded){try{await loadHistory();}catch(e){status.textContent="同步失败";greeting();add(e.message,"bot");}}});
  panel.querySelector("#linyi-ai-head button").addEventListener("click",()=>panel.classList.remove("open"));
  panel.querySelector("#linyi-ai-new").addEventListener("click",()=>{conversationId="";history=[];try{localStorage.removeItem(key);}catch(_){}greeting();historyBox.classList.remove("open");status.textContent="新对话";input.focus();});
  panel.querySelector("#linyi-ai-history-toggle").addEventListener("click",()=>historyBox.classList.toggle("open"));
  form.addEventListener("submit",async event=>{
    event.preventDefault();const question=input.value.trim();if(!question)return;
    if(/(?:1[3-9]\d{9}|\d{17}[0-9Xx])/i.test(question)){add("为保护隐私，请不要提交身份证号或手机号。此内容未发送。","bot");return;}
    if(/(我的(检查|报告|化验|B超|超声|AMH|病历)|报告(显示|提示|结果)|帮我(诊断|判断|看报告|制定方案)|该吃什么药|用药剂量|促排方案)/i.test(question)){add("这个问题涉及个人检查结果或诊疗决策，我不能进行诊断、报告解读、用药指导或治疗方案制定。请咨询正规医疗机构的专业人员。","bot");return;}
    add(question,"user");input.value="";send.disabled=true;const waiting=add("正在思考…","bot");
    try{
      const result=await api({action:"chat",question,conversation_id:conversationId});
      waiting.textContent=result.answer;
      conversationId=result.conversation_id||conversationId;
      try{localStorage.setItem(key,conversationId);}catch(_){}
      history.push({role:"user",content:question},{role:"assistant",content:result.answer});
      status.textContent="已自动保存";
      try{await loadHistory();}
      catch(historyError){status.textContent="回答已返回，历史同步暂时失败";}
    }catch(error){waiting.textContent=error.message||"连接失败，请稍后重试。";}
    finally{send.disabled=false;input.focus();}
  });
})();
