/* Great Solomon Manpower Services Inc. Core Transaction 4 - single combined JavaScript file */

/* Preserve the user's exact viewport position across normal form updates.
   Server-side POST/redirect/GET flows stay unchanged; this only restores the
   scroll position after the browser loads the resulting page. */
(function(){
  const KEY='ct4_pending_scroll_position_v1';
  function save(){
    try{
      sessionStorage.setItem(KEY,JSON.stringify({
        x:window.scrollX||0,
        y:window.scrollY||0,
        path:window.location.pathname,
        time:Date.now()
      }));
    }catch(_){}
  }
  /* Use a second listener so defaultPrevented can be checked after submit handlers. */
  document.addEventListener('submit',function(e){
    const form=e.target;
    if(!form || (form.target && form.target!=='_self')) return;
    queueMicrotask(function(){
      if(e.defaultPrevented) return;
      const method=(form.getAttribute('method')||'get').toLowerCase();
      if(method!=='get' && method!=='post') return;
      try{
        const action=new URL(form.getAttribute('action')||window.location.href,window.location.href);
        if(action.origin!==window.location.origin) return;
      }catch(_){ return; }
      save();
    });
  });
  function restore(){
    try{
      const raw=sessionStorage.getItem(KEY);
      if(!raw)return;
      const state=JSON.parse(raw);
      if(!state || Date.now()-Number(state.time||0)>15000)return sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      const restoreNow=()=>{
        window.scrollTo({left:Number(state.x)||0,top:Number(state.y)||0,behavior:'auto'});
      };
      /* Run after DOM/layout and after native #anchor handling. */
      requestAnimationFrame(()=>requestAnimationFrame(restoreNow));
    }catch(_){}
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',restore,{once:true});
  }else{
    restore();
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  if(window.FEEDBACK_SENT){ setTimeout(showFeedbackSentModal, 100); }
  initNotificationWatcher();
  const toggle=document.getElementById('sidebarToggle');
  const sidebar=document.getElementById('sidebar');
  const backdrop=document.getElementById('sidebar-backdrop');
  if(toggle&&sidebar){toggle.addEventListener('click',()=>{sidebar.classList.toggle('open');backdrop&&backdrop.classList.toggle('show');});}
  if(backdrop){backdrop.addEventListener('click',()=>{sidebar?.classList.remove('open');backdrop.classList.remove('show');});}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('modalRoot')?.replaceChildren();sidebar?.classList.remove('open');backdrop?.classList.remove('show');}});
  document.querySelectorAll('input[type="number"]').forEach(i=>i.addEventListener('wheel',e=>e.preventDefault(),{passive:false}));
  document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',()=>{const btn=form.querySelector('button[type="submit"],button:not([type])');if(btn){btn.disabled=true;btn.dataset.originalText=btn.innerHTML;btn.innerHTML='<span class="material-symbols-outlined">hourglass_top</span> Processing...';setTimeout(()=>{btn.disabled=false;btn.innerHTML=btn.dataset.originalText||'Submit';},4000);}}));
  initResizableTables();
  initUpdatePopups();

});

function initResizableTables(){
  document.querySelectorAll('.table-wrap table, .feedback-data-table').forEach(table=>{
    if(table.dataset.ctEnhanced==='1')return;
    table.dataset.ctEnhanced='1';
    if(!/(?:health_all|incident_all|login_all)=1/.test(window.location.search)) table.classList.add('ct-five-row-table');
    table.classList.add('ct-resizable-table');
    const wrap=table.closest('.table-wrap')||table.parentElement;
    wrap?.classList.add('ct-table-scroll');
    const headers=table.querySelectorAll('thead th');
    if(!headers.length)return;
    table.style.minWidth=Math.max(100,headers.length*125)+'px';
    headers.forEach((th,index)=>{
      th.classList.add('ct-resizable-th');
      const grip=document.createElement('span');
      grip.className='ct-col-resizer';
      grip.setAttribute('aria-hidden','true');
      th.appendChild(grip);
      grip.addEventListener('pointerdown',e=>{
        e.preventDefault(); e.stopPropagation();
        const startX=e.clientX, startW=Math.max(70,th.getBoundingClientRect().width);
        const move=ev=>{const w=Math.max(70,startW+(ev.clientX-startX));th.style.width=w+'px';};
        const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};
        document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
      });
    });
  });
}
function initUpdatePopups(){
  document.querySelectorAll('form').forEach(form=>{
    const action=form.querySelector('input[name="action"]')?.value||'';
    if(!/^update_/i.test(action)||form.dataset.ctUpdatePopup==='1')return;
    form.dataset.ctUpdatePopup='1';
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='gw-btn secondary ct-update-trigger';
    trigger.innerHTML='<span class="material-symbols-outlined">edit</span>Update';
    trigger.addEventListener('click',()=>openUpdateForm(form));
    form.hidden=true;
    form.parentNode?.insertBefore(trigger,form);
  });
}
function openUpdateForm(form){
  const root=document.getElementById('modalRoot');if(!root)return;
  const clone=form.cloneNode(true);
  clone.hidden=false;
  clone.removeAttribute('style');
  clone.dataset.ctUpdateClone='1';
  clone.querySelectorAll('button[type="submit"],button:not([type])').forEach(btn=>{
    btn.classList.add('primary');
    btn.innerHTML='<span class="material-symbols-outlined">save</span>Save Update';
  });
  const action=clone.querySelector('input[name="action"]')?.value||'update';
  const title=action.replace(/^update_/i,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const actions=document.createElement('div');
  actions.className='record-actions';
  const cancel=document.createElement('button');
  cancel.type='button';cancel.className='gw-btn secondary';cancel.textContent='Cancel';cancel.onclick=closeModal;
  actions.appendChild(cancel);
  clone.appendChild(actions);
  root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal update-form-modal"><div class="gw-modal-head"><div><strong>${escapeHtml(title)} Update</strong><small>Make changes and save without leaving the current page.</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div><div class="gw-modal-body" id="updateFormModalBody"></div></div></div>`;
  document.getElementById('updateFormModalBody')?.appendChild(clone);
}

function showModal(title,body){const root=document.getElementById('modalRoot');if(!root)return;root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal"><div class="gw-modal-head"><strong>${escapeHtml(title)}</strong><button class="gw-modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button></div><div class="gw-modal-body"><p style="font-size:12px;line-height:1.7;color:#64748b">${escapeHtml(body)}</p><div style="display:flex;justify-content:flex-end;margin-top:20px"><button class="gw-btn primary" onclick="closeModal()">Continue</button></div></div></div></div>`;}
function closeModal(){document.getElementById('modalRoot')?.replaceChildren();}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function toggleUserMenu(){
 const m=document.getElementById('userMenu'); if(!m)return;
 m.classList.toggle('open');
}
document.addEventListener('click',e=>{
 const wrap=document.querySelector('.user-menu-wrap');
 if(wrap && !wrap.contains(e.target)) document.getElementById('userMenu')?.classList.remove('open');
});

function initNotificationWatcher(){
 const topButton=document.querySelector('.gw-notification-trigger');
 if(!topButton || !window.CURRENT_USER?.role)return;
 let lastKnownId=0;
 const seeded=[...(window.ADMIN_NOTIFICATIONS||[]),...(window.STAFF_NOTIFICATIONS||[])];
 if(seeded.length) lastKnownId=Math.max(...seeded.map(n=>Number(n.id)||0));
 let first=true;
 const updateBadge=(count)=>{
   if(count>0){
     topButton?.classList.add('has-new-notification');
     let topBadge=topButton?.querySelector('.top-notification-badge');
     if(topButton && !topBadge){topBadge=document.createElement('span');topBadge.className='top-notification-badge';topButton.appendChild(topBadge);}
     if(topBadge)topBadge.textContent=count>99?'99+':String(count);
     topButton.setAttribute('aria-label',`Notifications${count>0?` — ${count} unread`:''}`);
   }else{
     topButton?.classList.remove('has-new-notification');
     topButton?.querySelector('.top-notification-badge')?.remove();
     topButton.setAttribute('aria-label','Open notifications');
   }
 };
 const notifyNew=(latest)=>{
   if(!latest)return;
   const title=latest.title||'New notification';
   const text=latest.message||'You have a new notification.';
   let toast=document.getElementById('notificationToast');
   if(!toast){
     toast=document.createElement('div');
     toast.id='notificationToast';
     toast.className='notification-toast';
     document.body.appendChild(toast);
   }
   toast.innerHTML=`<span class="material-symbols-outlined">notifications_active</span><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text.length>120?text.slice(0,117)+'...':text)}</span></div><button type="button" aria-label="Open notifications"><span class="material-symbols-outlined">arrow_forward</span></button>`;
   toast.querySelector('button')?.addEventListener('click',()=>{toast.classList.remove('show');showNotificationModal();});
   requestAnimationFrame(()=>toast.classList.add('show'));
   clearTimeout(window.__notificationToastTimer);
   window.__notificationToastTimer=setTimeout(()=>toast.classList.remove('show'),7000);
 };
 const check=()=>fetch(`${window.APP_BASE||''}/includes/notifications_status.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store'})
   .then(r=>r.ok?r.json():null).then(data=>{
     if(!data?.ok)return;
     updateBadge(Number(data.count)||0);
     const id=Number(data.latest?.id)||0;
     if(!first && id>lastKnownId)notifyNew(data.latest);
     if(id>lastKnownId)lastKnownId=id;
     first=false;
   }).catch(()=>{first=false;});
 check();
 window.__notificationWatcher=setInterval(check,15000);
}

function feedbackStatusBadge(status){
  const s=String(status||'New');
  return `<span class="feedback-status-badge ${s.toLowerCase().replace(/\s+/g,'-')}">${escapeHtml(s)}</span>`;
}
function feedbackPriorityBadge(priority){
  return `<span class="feedback-priority-badge ${String(priority||'Medium').toLowerCase()}">${escapeHtml(priority||'Medium')}</span>`;
}
function feedbackOwns(thread){
  const uid=Number(window.CURRENT_USER?.id||0);
  return uid>0 && Number(thread?.user_id||0)===uid;
}
async function reloadFeedbackThreads(){
  try{
    const r=await fetch(`${window.APP_BASE||''}/includes/feedback_threads.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store'});
    const d=await r.json().catch(()=>null);
    if(r.ok&&d?.ok&&Array.isArray(d.threads)){window.FEEDBACK_THREADS=d.threads;return true;}
  }catch(_e){}
  return false;
}
function showFeedbackSentModal(){
  const root=document.getElementById('modalRoot');if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop"><div class="gw-modal feedback-sent-modal"><div class="feedback-sent-icon"><span class="material-symbols-outlined">mark_email_read</span></div><div class="gw-modal-body feedback-sent-body"><strong>Feedback Sent</strong><p>Your feedback has been sent successfully.</p><button class="gw-btn primary" onclick="closeModal()">Done</button></div></div></div>`;
}
function showFeedbackModal(){
  document.getElementById('userMenu')?.classList.remove('open');
  const root=document.getElementById('modalRoot');if(!root)return;
  const user=window.CURRENT_USER||{name:'User',role:'Staff'};
  root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal feedback-modal"><div class="gw-modal-head"><div><strong>Send Feedback</strong><small>Submit feedback from your signed-in account.</small></div><button class="gw-modal-close" onclick="closeModal()">×</button></div><div class="gw-modal-body"><div class="feedback-intro"><span class="material-symbols-outlined">rate_review</span><div><strong>Your account details are automatic</strong><p>Your name and role are taken from the account currently signed in.</p></div></div><form method="post" action="${window.APP_BASE||''}/includes/feedback.php"><input type="hidden" name="csrf_token" value="${escapeHtml(window.CSRF_TOKEN||'')}"/><input type="hidden" name="return_to" value="${escapeHtml(window.location.pathname+window.location.search)}"/><input type="hidden" name="action" value="send"/><div class="feedback-account-grid"><div class="feedback-readonly-field"><label>Name</label><div class="feedback-readonly-value"><span class="material-symbols-outlined">person</span>${escapeHtml(user.name)}</div></div><div class="feedback-readonly-field"><label>Role</label><div class="feedback-readonly-value"><span class="material-symbols-outlined">badge</span>${escapeHtml(user.role)}</div></div></div><div class="feedback-form-grid"><div class="feedback-message-field"><label for="feedbackSubject">Subject <span class="field-required">*</span></label><input id="feedbackSubject" name="subject" maxlength="180" placeholder="Example: Unable to save a safety report" required/></div><div class="feedback-message-field"><label for="feedbackCategory">Category <span class="field-required">*</span></label><select id="feedbackCategory" name="category"><option>General Feedback</option><option>Bug / System Problem</option><option>Suggestion</option><option>Complaint</option><option>Security Concern</option><option>Data Problem</option></select></div><div class="feedback-message-field"><label for="feedbackPriority">Priority <span class="field-required">*</span></label><select id="feedbackPriority" name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div></div><div class="feedback-message-field"><div class="feedback-label-row"><label for="feedbackText">Your Feedback <span class="field-required">*</span></label><span id="feedbackTextCount">0 / 3000</span></div><textarea id="feedbackText" name="feedback" rows="7" required maxlength="3000" placeholder="Describe your feedback clearly..."></textarea><div class="feedback-helper">Do not enter passwords or confidential credentials.</div></div><div class="record-actions"><button type="button" class="gw-btn secondary" onclick="closeModal()">Cancel</button><button class="gw-btn primary" type="submit"><span class="material-symbols-outlined">send</span>Send Feedback</button></div></form></div></div></div>`;
  const text=document.getElementById('feedbackText'),count=document.getElementById('feedbackTextCount');
  if(text&&count){const update=()=>count.textContent=`${text.value.length} / 3000`;text.addEventListener('input',update);update();}
  setTimeout(()=>document.getElementById('feedbackSubject')?.focus(),50);
}
function renderAdminFeedbackCards(threads){
  if(!threads.length)return `<div class="notification-empty"><span class="material-symbols-outlined">feedback</span><strong>No employee feedback yet</strong><p>New Staff feedback will appear here.</p></div>`;
  return threads.map(t=>{const first=Array.isArray(t.messages)&&t.messages.length?t.messages[0]:null;return `<div class="notification-card feedback-thread-card"><div class="notification-card-head"><div><strong>${escapeHtml(t.subject||'Feedback')}</strong><span>${escapeHtml(t.owner_name||'Employee')} · ${escapeHtml(t.category||'General Feedback')}</span></div><small>${renderDate(t.created_at)}</small></div><div class="feedback-thread-meta">${feedbackPriorityBadge(t.priority)} ${feedbackStatusBadge(t.status)}</div><p>${escapeHtml(first?.message||t.last_message||'No message')}</p><div class="notification-actions"><button type="button" class="gw-btn secondary" onclick="showFeedbackThread(${Number(t.id)})"><span class="material-symbols-outlined">visibility</span>View</button><button type="button" class="gw-btn btn-danger" onclick="deleteEmployeeFeedback(${Number(t.id)})"><span class="material-symbols-outlined">archive</span>Delete</button></div></div>`;}).join('');
}
async function deleteEmployeeFeedback(threadId){
  const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===Number(threadId)); if(!t)return;
  if(!confirm(`Delete “${t.subject||'this feedback'}”? It will first be moved to Archive.`))return;
  const body=new URLSearchParams({action:'admin_delete',thread_id:String(threadId),csrf_token:String(window.CSRF_TOKEN||''),return_to:window.location.pathname+window.location.search});
  try{const r=await fetch(`${window.APP_BASE||''}/includes/feedback.php`,{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()});const d=await r.json().catch(()=>({ok:false,message:'Invalid server response.'}));if(!r.ok||!d.ok)throw new Error(d.message||'Unable to delete feedback.');await reloadFeedbackThreads();await showNotificationModal(false);}catch(e){alert(e.message||'Unable to delete feedback.');}
}
function renderFeedbackCards(threads,isAdmin){
  if(!threads.length)return `<div class="notification-empty"><span class="material-symbols-outlined">feedback</span><strong>No feedback yet</strong><p>Use “Send Feedback” to submit a new feedback record.</p></div>`;
  return threads.map(t=>{
    const first=Array.isArray(t.messages)&&t.messages.length?t.messages[0]:null;
    const own=feedbackOwns(t);
    const canUnsend=own;
    const actions=canUnsend
      ? `<button type="button" class="gw-btn btn-danger" onclick="unsendFeedback(${Number(t.id)})"><span class="material-symbols-outlined">undo</span>Unsend</button>`
      : '';
    return `<div class="notification-card feedback-thread-card">
      <div class="notification-card-head"><div><strong>${escapeHtml(t.subject||'Feedback')}</strong><span>${escapeHtml(t.owner_name||'User')} · ${escapeHtml(t.category||'General Feedback')}</span></div><small>${renderDate(t.created_at)}</small></div>
      <div class="feedback-thread-meta">${feedbackPriorityBadge(t.priority)} ${feedbackStatusBadge(t.status)}</div>
      <p>${escapeHtml(first?.message||t.last_message||'No message')}</p>
      ${actions?`<div class="notification-actions">${actions}</div>`:''}
    </div>`;
  }).join('');
}
async function showNotificationModal(fresh=true){
  if(fresh)await reloadFeedbackThreads();
  const root=document.getElementById('modalRoot');if(!root)return;
  const user=window.CURRENT_USER||{};
  if(user.role!=='Staff' && user.role!=='Administrator'){ closeModal(); return; }
  const threads=Array.isArray(window.FEEDBACK_THREADS)?window.FEEDBACK_THREADS:[];
  const visible=user.role==='Administrator' ? threads : threads.filter(feedbackOwns);
  if(user.role==='Administrator'){
    root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal notifications-modal feedback-inbox-modal">
      <div class="gw-modal-head"><div><strong>Employee Feedback</strong><small>View employee feedback and move records to Archive.</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
      <div class="gw-modal-body"><div class="feedback-inbox-toolbar"><div><strong>${visible.length}</strong><span>employee feedback record${visible.length===1?'':'s'}</span></div></div>
      <div id="feedbackThreadList" class="notification-list">${renderAdminFeedbackCards(visible)}</div>
      <div class="record-actions"><button class="gw-btn primary" onclick="closeModal()">Close</button></div></div></div></div>`;
    return;
  }
  root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal notifications-modal feedback-inbox-modal">
    <div class="gw-modal-head"><div><strong>Feedback</strong><small>Send and unsend your feedback.</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
    <div class="gw-modal-body"><div class="feedback-inbox-toolbar"><div><strong>${visible.length}</strong><span>feedback record${visible.length===1?'':'s'}</span></div><button class="gw-btn primary" type="button" onclick="showFeedbackModal()"><span class="material-symbols-outlined">add_comment</span>Send Feedback</button></div>
    <div id="feedbackThreadList" class="notification-list">${renderFeedbackCards(visible,false)}</div>
    <div class="record-actions"><button class="gw-btn primary" onclick="closeModal()">Close</button></div></div></div></div>`;
  fetch(`${window.APP_BASE||''}/includes/mark_notifications_read.php`,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest','X-CSRF-Token':window.CSRF_TOKEN||''},credentials:'same-origin'}).catch(()=>{});
}
async function handleNotificationBell(){ await showNotificationModal(true); }
async function unsendFeedback(threadId){
  const id=Number(threadId)||0;if(!id)return;
  const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===id);
  if(!t||!feedbackOwns(t))return;
  if(!confirm(`Unsend “${t.subject||'this feedback'}”? This will remove your feedback record.`))return;
  const body=new URLSearchParams({action:'unsend',thread_id:String(id),csrf_token:String(window.CSRF_TOKEN||''),return_to:window.location.pathname+window.location.search});
  try{
    const r=await fetch(`${window.APP_BASE||''}/includes/feedback.php`,{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()});
    const d=await r.json().catch(()=>({ok:false,message:'Invalid server response.'}));
    if(!r.ok||!d.ok)throw new Error(d.message||'Unable to unsend feedback.');
    await reloadFeedbackThreads(); await showNotificationModal(false);
  }catch(e){alert(e.message||'Unable to unsend feedback.');}
}
async function showFeedbackThread(threadId){
  const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===Number(threadId));if(!t)return;
  const first=Array.isArray(t.messages)&&t.messages.length?t.messages[0]:null;
  const root=document.getElementById('modalRoot');if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal feedback-modal feedback-thread-detail"><div class="gw-modal-head"><div><strong>${escapeHtml(t.subject||'Feedback')}</strong><small>${escapeHtml(t.owner_name||'User')} · ${escapeHtml(t.category||'General Feedback')}</small></div><button class="gw-modal-close" onclick="closeModal()">×</button></div><div class="gw-modal-body"><div class="feedback-chat-scroll feedback-thread-history"><div class="feedback-bubble feedback-bubble-out"><strong>${escapeHtml(first?.sender_name||t.owner_name||'User')}</strong><small>${renderDate(first?.created_at||t.created_at)}</small><p>${escapeHtml(first?.message||t.last_message||'')}</p></div></div><div class="record-actions">${(window.CURRENT_USER?.role==='Administrator')?`<button class="gw-btn btn-danger" type="button" onclick="deleteEmployeeFeedback(${Number(t.id)})">Delete Feedback</button>`:(feedbackOwns(t)?`<button class="gw-btn btn-danger" type="button" onclick="unsendFeedback(${Number(t.id)})">Unsend Feedback</button>`:'')}<button class="gw-btn secondary" type="button" onclick="closeModal()">Close</button></div></div></div></div>`;
}
function refreshFeedbackDataTable(){ return; }
function renderFeedbackDataTable(){ return; }
function showTermsModal(){
 document.getElementById('userMenu')?.classList.remove('open');
 const root=document.getElementById('modalRoot'); if(!root)return;
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal terms-modal">
 <div class="gw-modal-head"><div><strong>Terms and Conditions</strong><small>Great Solomon Manpower Services Inc. — Core Transaction 4</small></div></div>
 <div class="gw-modal-body terms-body">
 <p>By accessing and using this system, you acknowledge that it is intended only for authorized Great Solomon Manpower Services Inc. administrators and staff. You are responsible for using your assigned account appropriately, keeping your password and verification information confidential, and ensuring that records you create or update are accurate and used only for legitimate company purposes. Sharing accounts, attempting to access another user's account, bypassing access controls, or using the system for unauthorized purposes is prohibited.</p>
 <p>The system processes personal and, where applicable, sensitive personal information. The company will handle such information in accordance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, including its principles on transparency, legitimate purpose, proportionality, and appropriate protection of personal information. Users must not disclose, copy, download, or otherwise process personal information beyond what is authorized for their work responsibilities.</p>
 <p>Users must also use the system and its computer resources responsibly and must not perform unauthorized access, interception, alteration, deletion, disruption, introduction of malicious code, or other prohibited activity. The <strong>Cybercrime Prevention Act of 2012 (Republic Act No. 10175)</strong> addresses offenses involving the confidentiality, integrity, and availability of computer data and systems, and this system's security controls and audit records may be used to support legitimate security and compliance activities.</p>
 <p>For workplace health and safety records, users must enter and maintain information responsibly and support the company's safety processes. The <strong>Occupational Safety and Health Standards Law (Republic Act No. 11058)</strong> strengthens compliance with occupational safety and health standards and provides duties and protections relating to workplace hazards, safety programs, training, incident reporting, and worker safety. Records in this system should therefore be used only for authorized health, safety, welfare, and compliance purposes.</p>
 <p>Electronic records, messages, and transactions handled through this system may also be subject to the <strong>Electronic Commerce Act of 2000 (Republic Act No. 8792)</strong> and other applicable Philippine laws and regulations. By continuing to use the system, you agree to follow company policies, applicable laws, and authorized instructions; system activity may be logged for security, audit, operational, and compliance purposes. These terms describe system-use rules and are not a substitute for legal advice; applicable laws and regulations prevail where they conflict with these terms.</p>
 <div class="terms-note"><span class="material-symbols-outlined">verified_user</span><span>Use the system responsibly and report security, privacy, or data-quality concerns to the appropriate administrator.</span></div>
 <div class="terms-confirmation"><label class="auth-checkbox"><input type="checkbox" id="modalTermsCheckbox"><span>I have read and agree to these Terms and Conditions.</span></label><button type="button" class="gw-btn primary" id="modalTermsConfirm" disabled onclick="if(document.getElementById('modalTermsCheckbox')?.checked)closeModal()">Confirm Terms</button></div>
 </div></div></div>`;
 const box=document.getElementById('modalTermsCheckbox'), confirm=document.getElementById('modalTermsConfirm');
 box?.addEventListener('change',()=>{if(confirm)confirm.disabled=!box.checked;});
}
function showEditUserModal(id,name,email,role){
 const root=document.getElementById('modalRoot'); if(!root)return;
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal">
 <div class="gw-modal-head"><strong>Edit User Account</strong><button class="gw-modal-close" onclick="closeModal()">×</button></div>
 <div class="gw-modal-body"><form method="post" action="${window.location.pathname}">
 <input type="hidden" name="csrf_token" value="${escapeHtml(window.CSRF_TOKEN||'')}"><input type="hidden" name="action" value="edit_user"><input type="hidden" name="id" value="${escapeHtml(id)}">
 <div class="form-grid edit-user-fields">
 <div class="full"><label>New Name</label><input class="edit-user-input" name="name" value="${escapeHtml(name)}" required autocomplete="name"></div>
 <div class="full"><label>New Email</label><input class="edit-user-input" type="email" name="email" value="${escapeHtml(email)}" required autocomplete="email"></div>
 <div class="full"><label>New Role</label><select class="edit-user-input" name="role" required><option value="Administrator" ${role==="Administrator"?"selected":""}>Administrator</option><option value="Staff" ${role==="Staff"?"selected":""}>Staff</option></select></div>
 <div class="full"><label>New Password</label><input class="edit-user-input" type="password" name="password" minlength="6" placeholder="Leave blank to keep current password" autocomplete="new-password"></div></div>
 <div class="record-actions"><button type="button" class="gw-btn secondary" onclick="closeModal()">Cancel</button><button class="gw-btn primary"><span class="material-symbols-outlined">save</span>Save Changes</button></div>
 </form></div></div></div>`;
}

/* CT4 Gemini AI Assistant */
document.addEventListener('DOMContentLoaded',()=>{
 const form=document.getElementById('aiForm'), input=document.getElementById('aiInput'), messages=document.getElementById('aiMessages');
 if(!form||!input||!messages)return;
 const clearBtn=document.getElementById('aiClear');
 const base=window.APP_BASE||'';
 let history=[];
 try{history=JSON.parse(sessionStorage.getItem('ct4_ai_history')||'[]');}catch(e){history=[];}
 function esc(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
 function renderText(v){return esc(v).replace(/\n/g,'<br>');}
 function addMessage(role,text){
   const row=document.createElement('div'); row.className='ai-message '+(role==='user'?'user':'assistant');
   row.innerHTML=role==='user'
    ? '<div class="ai-message-content"><strong>You</strong><p>'+renderText(text)+'</p></div>'
    : '<div class="ai-msg-icon"><span class="material-symbols-outlined">auto_awesome</span></div><div><strong>CT4 AI</strong><p>'+renderText(text)+'</p></div>';
   messages.appendChild(row); messages.scrollTop=messages.scrollHeight;
 }
 function save(){sessionStorage.setItem('ct4_ai_history',JSON.stringify(history.slice(-8)));}
 function setBusy(b){input.disabled=b;form.querySelector('button[type="submit"]').disabled=b;}
 function ask(text){
   text=(text||'').trim(); if(!text||input.disabled)return;
   addMessage('user',text);
   history.push({role:'user',text:text});
   save(); input.value=''; input.style.height='auto'; setBusy(true);
   const thinking=document.createElement('div'); thinking.className='ai-message assistant ai-thinking'; thinking.innerHTML='<div class="ai-msg-icon"><span class="material-symbols-outlined">auto_awesome</span></div><div><strong>CT4 AI</strong><p><span class="ai-dots">Thinking…</span></p></div>'; messages.appendChild(thinking); messages.scrollTop=messages.scrollHeight;
   const fd=new FormData(); fd.append('csrf_token',window.CSRF_TOKEN||''); fd.append('message',text); fd.append('history',JSON.stringify(history.slice(-8)));
   fetch(base+'/services/api/gemini.php',{method:'POST',body:fd,credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'}})
    .then(r=>r.json().catch(()=>({ok:false,error:'Invalid server response.'})).then(data=>({status:r.status,data})))
    .then(({data})=>{
      thinking.remove();
      if(data.ok){
        addMessage('assistant',data.answer); history.push({role:'model',text:data.answer}); save();
      }else addMessage('assistant','I could not answer that right now. '+(data.error||'Please try again.'));
    }).catch(()=>{thinking.remove();addMessage('assistant','The AI service could not be reached. Please check the server connection and Gemini environment configuration.');})
    .finally(()=>setBusy(false));
 }
 form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(input.value);}});
 input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px';});
 document.querySelectorAll('.ai-suggestions button').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.prompt||'')));
 clearBtn?.addEventListener('click',()=>{history=[];sessionStorage.removeItem('ct4_ai_history');messages.innerHTML='<div class="ai-message assistant"><div class="ai-msg-icon"><span class="material-symbols-outlined">auto_awesome</span></div><div><strong>CT4 AI</strong><p>Chat cleared. What would you like to know about Core Transaction 4?</p></div></div>';});
});

/* CT4 global account tools: theme, data storage, logout confirmation, inactivity timer */
function formatBytes(bytes){
  bytes=Number(bytes)||0;
  if(bytes<1024) return bytes+' B';
  if(bytes<1024*1024) return (bytes/1024).toFixed(1)+' KB';
  if(bytes<1024*1024*1024) return (bytes/1024/1024).toFixed(1)+' MB';
  return (bytes/1024/1024/1024).toFixed(1)+' GB';
}
window.DATA_STORAGE_HAS_FILES=null;
function showDataStorageModal(){
  document.getElementById('userMenu')?.classList.remove('open');
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop data-storage-backdrop" onclick="if(event.target===this)closeModal()">
    <div class="gw-modal data-storage-modal">
      <div class="gw-modal-head"><div><strong>Data Storage</strong><small>Data/files received from other branches.</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
      <div class="gw-modal-body">
        <div class="data-storage-toolbar">
          <div><strong>DATA / FILES</strong><span>Stored data/files received from other branches.</span></div>
          <form id="dataStorageUploadForm" class="data-storage-upload" onsubmit="handleDataStorageUpload(event)">
            <input type="file" name="data_file" id="dataStorageFileInput" required>
            <input type="text" name="source_branch" placeholder="Branch / Source (optional)">
            <button class="gw-btn primary" type="submit" id="dataStorageUploadBtn"><span class="material-symbols-outlined">upload</span>UPLOAD</button>
            <button class="gw-btn secondary" type="button" onclick="showDownloadAllConfirm()"><span class="material-symbols-outlined">download</span>DOWNLOAD ALL</button>
          </form>
        </div>
        <div id="dataStorageList" class="data-storage-list"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading stored files...</div></div>
      </div>
    </div>
  </div>`;
  loadDataStorageList();
}
function handleDataStorageUpload(e){
  e.preventDefault();
  const form=e.target;
  const fileInput=form.querySelector('input[type="file"]');
  if(!fileInput || !fileInput.files.length) return;
  const btn=document.getElementById('dataStorageUploadBtn');
  const originalHtml=btn?btn.innerHTML:'';
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="material-symbols-outlined">hourglass_top</span> Uploading...'; }
  const fd=new FormData(form); fd.append('csrf_token',window.CSRF_TOKEN||'');
  fetch(`${window.APP_BASE||''}/includes/data_storage.php?action=upload`,{
    method:'POST',
    body:fd,
    credentials:'same-origin',
    headers:{'X-Requested-With':'XMLHttpRequest'}
  })
    .then(r=>r.json().catch(()=>({ok:false,error:'Server returned invalid response.'})))
    .then(data=>{
      if(btn){ btn.disabled=false; btn.innerHTML=originalHtml; }
      if(data.ok){
        window.DATA_STORAGE_HAS_FILES=null;
        form.reset();
        loadDataStorageList();
        showModal('Success','File uploaded and stored successfully.');
      } else {
        showModal('Upload Failed',data.error||'Unable to upload file.');
      }
    })
    .catch(err=>{
      if(btn){ btn.disabled=false; btn.innerHTML=originalHtml; }
      showModal('Upload Error',err.message||'Failed to communicate with server.');
    });
}
function loadDataStorageList(){
  fetch(`${window.APP_BASE||''}/includes/data_storage.php?action=list`,{credentials:'same-origin'})
    .then(r=>r.json()).then(data=>{
      const box=document.getElementById('dataStorageList'); if(!box)return;
      window.DATA_STORAGE_HAS_FILES=!!(data.ok && Array.isArray(data.items) && data.items.length);
      if(!window.DATA_STORAGE_HAS_FILES){
        box.innerHTML=`<div class="notification-empty"><span class="material-symbols-outlined">folder_off</span><strong>NO DATA/FILES STORED YET.</strong><p>DATA/FILES RECEIVED FROM OTHER BRANCHES WILL APPEAR HERE.</p></div>`; return;
      }
      box.innerHTML=data.items.map(f=>`<button type="button" class="data-storage-item" onclick="showStoredFile(${Number(f.id)},${JSON.stringify(String(f.file_name))},${JSON.stringify(String(f.file_type||''))})">
        <span class="data-storage-file-icon material-symbols-outlined">${String(f.file_type||'').startsWith('image/')?'image':'description'}</span>
        <span class="data-storage-file-main"><strong>${escapeHtml(f.file_name)}</strong><small>${escapeHtml(f.source_branch||'Other Branch')} · ${escapeHtml(formatBytes(f.file_size))}</small></span>
        <span class="material-symbols-outlined">chevron_right</span>
      </button>`).join('');
    }).catch(()=>{window.DATA_STORAGE_HAS_FILES=null;const box=document.getElementById('dataStorageList');if(box)box.innerHTML='<div class="notification-empty"><span class="material-symbols-outlined">error</span><strong>UNABLE TO LOAD DATA/FILES.</strong><p>PLEASE TRY AGAIN.</p></div>';});
}
function showStoredFile(id,name,type){
  const root=document.getElementById('modalRoot'); if(!root)return;
  const src=`${window.APP_BASE||''}/includes/data_storage.php?action=view&id=${encodeURIComponent(id)}`;
  const isImg = String(type||'').startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/i.test(name);
  const isPdf = (type === 'application/pdf') || /\.pdf$/i.test(name);
  const isTxt = String(type||'').startsWith('text/') || /\.(txt|csv|log|json|xml|html)$/i.test(name);
  let previewContent = '';
  if (isImg) {
    previewContent = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f1f5f9;padding:12px"><img src="${src}" alt="${escapeHtml(name)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px"></div>`;
  } else if (isPdf || isTxt) {
    previewContent = `<iframe src="${src}" title="${escapeHtml(name)}" style="width:100%;height:100%;border:0"></iframe>`;
  } else {
    previewContent = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:#64748b;text-align:center;padding:24px"><span class="material-symbols-outlined" style="font-size:54px;color:#4f46e5">description</span><strong>${escapeHtml(name)}</strong><p style="margin:0;font-size:13px">Direct preview is not available for this file type (${escapeHtml(type||'binary')}).<br>You can safely download the file below to view it.</p></div>`;
  }
  root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)showDataStorageModal()"><div class="gw-modal data-file-viewer-modal">
    <div class="gw-modal-head"><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(type||'Stored file')}</small></div><button class="gw-modal-close" onclick="showDataStorageModal()" aria-label="Back">×</button></div>
    <div class="gw-modal-body">
      <div class="data-file-preview">${previewContent}</div>
      <div class="record-actions"><button type="button" class="gw-btn secondary" onclick="showDownloadConfirm(${Number(id)},${JSON.stringify(String(name))})"><span class="material-symbols-outlined">download</span>DOWNLOAD</button><button type="button" class="gw-btn btn-danger" onclick="deleteStoredFile(${Number(id)},${JSON.stringify(String(name))})"><span class="material-symbols-outlined">delete</span>DELETE</button></div>
    </div>
  </div></div>`;
}
function deleteStoredFile(id,name){
  const fd=new FormData(); fd.append('csrf_token',window.CSRF_TOKEN||''); fd.append('id',id);
  if(!confirm('Delete '+name+'? The file will be moved to Archive and can be recovered later.')) return;
  fetch(`${window.APP_BASE||''}/includes/data_storage.php?action=delete`,{method:'POST',body:fd,credentials:'same-origin'})
   .then(r=>r.json()).then(data=>{if(!data.ok)throw new Error(data.error||'Delete failed.');window.DATA_STORAGE_HAS_FILES=null;showDataStorageModal();})
   .catch(e=>showModal('Delete failed',e.message));
}
function showDownloadConfirm(id,name){
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop"><div class="gw-modal confirmation-modal">
    <div class="gw-modal-head"><div><strong>DOWNLOAD CONFIRMATION</strong></div><button class="gw-modal-close" onclick="showStoredFile(${Number(id)},${JSON.stringify(String(name))},'Stored file')">×</button></div>
    <div class="gw-modal-body"><div class="confirmation-icon"><span class="material-symbols-outlined">download</span></div><p class="confirmation-text">ARE YOU SURE TO DOWNLOAD THE DATA/FILES</p>
      <div class="record-actions"><button class="gw-btn secondary" type="button" onclick="showStoredFile(${Number(id)},${JSON.stringify(String(name))},'Stored file')">NO</button><button class="gw-btn primary" type="button" onclick="window.location.href='${window.APP_BASE||''}/includes/data_storage.php?action=download&id=${Number(id)}'">YES, DOWNLOAD</button></div>
    </div>
  </div></div>`;
}
function showNoDownloadableFilesModal(){
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop"><div class="gw-modal confirmation-modal">
    <div class="gw-modal-head"><strong>DOWNLOAD ALL</strong><button class="gw-modal-close" onclick="showDataStorageModal()" aria-label="Close">×</button></div>
    <div class="gw-modal-body"><div class="confirmation-icon"><span class="material-symbols-outlined">folder_off</span></div>
      <p class="confirmation-text">THERE ARE NO DATA/FILES CAN BE DOWNLOAD</p>
      <div class="record-actions"><button class="gw-btn primary" type="button" onclick="showDataStorageModal()">OK</button></div>
    </div>
  </div></div>`;
}
function showDownloadAllConfirm(){
  if(window.DATA_STORAGE_HAS_FILES===false){ showNoDownloadableFilesModal(); return; }
  if(window.DATA_STORAGE_HAS_FILES===null){
    fetch(`${window.APP_BASE||''}/includes/data_storage.php?action=list`,{credentials:'same-origin'})
      .then(r=>r.json()).then(data=>{
        window.DATA_STORAGE_HAS_FILES=!!(data.ok && Array.isArray(data.items) && data.items.length);
        if(window.DATA_STORAGE_HAS_FILES) showDownloadAllConfirm();
        else showNoDownloadableFilesModal();
      }).catch(()=>showNoDownloadableFilesModal());
    return;
  }
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop"><div class="gw-modal confirmation-modal">
    <div class="gw-modal-head"><strong>DOWNLOAD ALL CONFIRMATION</strong><button class="gw-modal-close" onclick="showDataStorageModal()" aria-label="Close">×</button></div>
    <div class="gw-modal-body"><div class="confirmation-icon"><span class="material-symbols-outlined">download_for_offline</span></div><p class="confirmation-text">ARE YOU SURE TO DOWNLOAD ALL DATA/FILES</p>
      <div class="record-actions"><button class="gw-btn secondary" type="button" onclick="showDataStorageModal()">NO</button><button class="gw-btn primary" type="button" onclick="window.location.href='${window.APP_BASE||''}/includes/data_storage.php?action=download_all'">YES, DOWNLOAD ALL</button></div>
    </div>
  </div></div>`;
}
function showLogoutModal(){
  document.getElementById('userMenu')?.classList.remove('open');
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop"><div class="gw-modal confirmation-modal">
    <div class="gw-modal-head"><strong>LOGOUT CONFIRMATION</strong><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
    <div class="gw-modal-body"><div class="confirmation-icon"><span class="material-symbols-outlined">logout</span></div><p class="confirmation-text">ARE YOU SURE YOU WANT TO LOGOUT</p>
      <div class="record-actions"><button class="gw-btn secondary" type="button" onclick="closeModal()">NO</button><button class="gw-btn primary" type="button" onclick="window.location.href='${window.APP_BASE||''}/auth/logout.php'">YES</button></div>
    </div>
  </div></div>`;
}

/* Automatic logout: only authenticated users, exactly 5 minutes of inactivity.
   Login and OTP pages do not expose CURRENT_USER and are therefore excluded. */
(function(){
  const LIMIT=5*60*1000;
  let lastActivity=Date.now(), timerId=null, lastMove=0;
  function logout(){ if(timerId)clearTimeout(timerId); window.location.href=`${window.APP_BASE||''}/auth/logout.php?reason=inactivity`; }
  function schedule(){ clearTimeout(timerId); timerId=setTimeout(logout,LIMIT); }
  function markActivity(){
    lastActivity=Date.now();
    schedule();
  }
  function init(){
    if(!window.CURRENT_USER || !window.CURRENT_USER.name) return;
    ['keydown','mousedown','touchstart','scroll','click','wheel','input','change','focus'].forEach(evt=>window.addEventListener(evt,markActivity,{passive:true}));
    window.addEventListener('mousemove',()=>{
      const now=Date.now(); if(now-lastMove>300){lastMove=now;markActivity();}
    },{passive:true});
    markActivity();
    setInterval(()=>{ if(Date.now()-lastActivity>=LIMIT) logout(); },10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Generate module shortcuts from the module's actual content sections.
   Existing links are reused; duplicate shortcuts are never created. */
(function(){
  function slug(text){return String(text).toLowerCase().trim().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);}
  function initShortcuts(){
    const path=window.location.pathname||'';
    const modulePaths=['/modules/health_safety/','/modules/legal_compliance/','/modules/system_admin_security/','/modules/asset_equipment/'];
    if(!modulePaths.some(p=>path.includes(p))) return;
    const shell=document.querySelector('.page-shell'); if(!shell)return;
    const existingBar=shell.querySelector('.gw-quick-actions');
    const bar=existingBar||document.createElement('section');
    bar.className='gw-quick-actions module-auto-shortcuts';
    const used=new Set([...bar.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')));
    const sections=[...shell.querySelectorAll(':scope > section')].filter(sec=>{
      const h=sec.querySelector('.gw-panel-head h2, h2');
      return h && !sec.classList.contains('gw-hero') && !sec.classList.contains('gw-stats') && !sec.classList.contains('gw-quick-actions');
    });
    sections.forEach(sec=>{
      const h=sec.querySelector('.gw-panel-head h2, h2'); if(!h)return;
      if(!sec.id) sec.id=slug(h.textContent);
      if(!sec.id)return;
      const href='#'+sec.id; if(used.has(href))return;
      used.add(href);
      const a=document.createElement('a'); a.href=href;
      a.innerHTML='<span class="material-symbols-outlined">shortcut</span>'+h.textContent.trim();
      bar.appendChild(a);
    });
    if(!existingBar && bar.children.length){ const hero=shell.querySelector('.gw-hero'); hero?.after(bar); }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initShortcuts);else initShortcuts();
})();

/* Archive: deleted records/files are retained and can be recovered into data storage/database. */
function showArchiveModal(){
  document.getElementById('userMenu')?.classList.remove('open');
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop archive-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal archive-modal">
    <div class="gw-modal-head"><div><strong>Archive</strong><small>Deleted data and files retained for recovery.</small></div><button class="gw-modal-close" onclick="closeModal()">×</button></div>
    <div class="gw-modal-body"><div class="archive-toolbar"><select id="archiveTypeFilter" onchange="loadArchiveItems(this.value)"><option value="">All archived data</option><option value="feedback">Employee Feedback</option><option value="record">Records</option><option value="file">Files</option></select>${(window.CURRENT_USER?.role==='Administrator')?`<div class="archive-backup-actions"><a class="gw-btn secondary" href="${window.APP_BASE||''}/includes/archive.php?action=backup&type=all"><span class="material-symbols-outlined">download</span>Backup All</a><a class="gw-btn secondary" href="${window.APP_BASE||''}/includes/archive.php?action=backup&type=feedback"><span class="material-symbols-outlined">download</span>Backup Feedback</a></div>`:''}</div><div id="archiveList" class="data-storage-list"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading archive...</div></div></div>
  </div></div>`;
  loadArchiveItems('');
}
function loadArchiveItems(type){
  const box=document.getElementById('archiveList'); if(!box)return; box.innerHTML='<div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading archive...</div>';
  fetch(`${window.APP_BASE||''}/includes/archive.php?action=list${type?'&type='+encodeURIComponent(type):''}`,{credentials:'same-origin'})
   .then(r=>r.json()).then(data=>{
    const box=document.getElementById('archiveList'); if(!box)return;
    if(!data.ok||!data.items?.length){box.innerHTML='<div class="notification-empty"><span class="material-symbols-outlined">inventory_2</span><strong>Archive is empty</strong><p>Deleted data and files will appear here.</p></div>';return;}
    box.innerHTML=data.items.map(x=>`<div class="data-storage-item archive-item">
      <span class="data-storage-file-icon material-symbols-outlined">${x.item_type==='file'?'description':'dataset'}</span>
      <span class="data-storage-file-main"><strong>${escapeHtml(x.item_name)}</strong><small>${escapeHtml(x.item_type)} · Deleted ${escapeHtml(x.deleted_at||'')}</small></span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="gw-btn primary" type="button" onclick="recoverArchive(${Number(x.id)})"><span class="material-symbols-outlined">restore</span>Recover</button>
        <button class="gw-btn btn-danger" type="button" onclick="deleteArchiveItem(${Number(x.id)},${JSON.stringify(String(x.item_name))})"><span class="material-symbols-outlined">delete_forever</span>Delete</button>
      </div>
    </div>`).join('');
   }).catch(()=>{const box=document.getElementById('archiveList');if(box)box.innerHTML='<div class="notification-empty"><strong>Unable to load archive.</strong><p>Please try again.</p></div>';});
}
function recoverArchive(id){
  const fd=new FormData(); fd.append('csrf_token',window.CSRF_TOKEN||''); fd.append('id',id); fd.append('action','recover');
  fetch(`${window.APP_BASE||''}/includes/archive.php?action=recover`,{method:'POST',body:fd,credentials:'same-origin'})
   .then(r=>r.json()).then(data=>{if(!data.ok)throw new Error(data.error||'Recovery failed.');window.DATA_STORAGE_HAS_FILES=null;showArchiveModal();})
   .catch(e=>showModal('Recovery failed',e.message));
}
function deleteArchiveItem(id,name){
  if(!confirm('Permanently delete "'+name+'"? This action cannot be undone.')) return;
  const fd=new FormData(); fd.append('csrf_token',window.CSRF_TOKEN||''); fd.append('id',id); fd.append('action','delete');
  fetch(`${window.APP_BASE||''}/includes/archive.php?action=delete`,{method:'POST',body:fd,credentials:'same-origin'})
   .then(r=>r.json()).then(data=>{if(!data.ok)throw new Error(data.error||'Delete failed.');showArchiveModal();})
   .catch(e=>showModal('Delete failed',e.message));
}

/* Module top navigation: enabled only on the four module pages. */
(function(){
  function initModuleTop(){
    const btn=document.getElementById('moduleTopButton');
    if(!btn)return;
    const toggle=()=>btn.classList.toggle('visible',window.scrollY>280);
    btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    window.addEventListener('scroll',toggle,{passive:true});
    toggle();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initModuleTop);else initModuleTop();
})();



/* Shared form workflow guard:
   - preserves the user's position after POST redirects,
   - prevents accidental double submissions,
   - keeps the existing visual design and server-side workflow intact. */
(function(){
  const KEY='ct4_return_position';
  function savePosition(form){
    if(!form || String(form.method||'get').toLowerCase()==='get') return;
    try{
      sessionStorage.setItem(KEY,JSON.stringify({
        path:window.location.pathname+window.location.search,
        y:Math.max(0,window.scrollY||0),
        hash:window.location.hash||''
      }));
    }catch(_e){}
  }
  function restorePosition(){
    try{
      const raw=sessionStorage.getItem(KEY); if(!raw)return;
      sessionStorage.removeItem(KEY);
      const state=JSON.parse(raw);
      if(!state || state.path!==window.location.pathname+window.location.search)return;
      const y=Number(state.y)||0;
      if(state.hash){
        const target=document.querySelector(state.hash);
        if(target) target.scrollIntoView({block:'start'});
      }
      window.setTimeout(()=>window.scrollTo({top:y,behavior:'auto'}),80);
    }catch(_e){}
  }
  document.addEventListener('submit',function(e){
    const form=e.target;
    if(!(form instanceof HTMLFormElement))return;
    if(form.dataset.ct4Handled==='1') return;
    form.dataset.ct4Handled='1';
    savePosition(form);
    const submitters=[...form.querySelectorAll('button[type="submit"],input[type="submit"]')];
    submitters.forEach(btn=>{
      if(btn.disabled)return;
      btn.dataset.ct4OriginalHtml=btn.innerHTML;
      btn.disabled=true;
      if(btn.tagName==='BUTTON'){
        btn.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">hourglass_top</span> Processing...';
      }
    });
    /* Native navigation normally follows immediately; re-enable after a short
       delay so validation/server-side interception can still recover. */
    window.setTimeout(()=>{
      submitters.forEach(btn=>{if(btn.dataset.ct4OriginalHtml){btn.disabled=false;btn.innerHTML=btn.dataset.ct4OriginalHtml;}});
      form.dataset.ct4Handled='0';
    },5000);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restorePosition);
  else restorePosition();
})();

window.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{refreshFeedbackDataTable();},0);});
