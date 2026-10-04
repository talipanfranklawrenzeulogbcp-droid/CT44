/* Great Solomon Manpower Services Inc. Core Transaction 4 - single combined JavaScript file */
document.addEventListener('DOMContentLoaded', () => {
  if(window.FEEDBACK_SENT){ setTimeout(showFeedbackSentModal, 100); }
  const toggle=document.getElementById('sidebarToggle');
  const sidebar=document.getElementById('sidebar');
  const backdrop=document.getElementById('sidebar-backdrop');
  if(toggle&&sidebar){toggle.addEventListener('click',()=>{sidebar.classList.toggle('open');backdrop&&backdrop.classList.toggle('show');});}
  if(backdrop){backdrop.addEventListener('click',()=>{sidebar?.classList.remove('open');backdrop.classList.remove('show');});}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('modalRoot')?.replaceChildren();sidebar?.classList.remove('open');backdrop?.classList.remove('show');}});
  document.querySelectorAll('input[type="number"]').forEach(i=>i.addEventListener('wheel',e=>e.preventDefault(),{passive:false}));
  document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',()=>{const btn=form.querySelector('button[type="submit"],button:not([type])');if(btn){btn.disabled=true;btn.dataset.originalText=btn.innerHTML;btn.innerHTML='<span class="material-symbols-outlined">hourglass_top</span> Processing...';setTimeout(()=>{btn.disabled=false;btn.innerHTML=btn.dataset.originalText||'Submit';},4000);}}));
});
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

/* ===== CT4 Notifications & Feedback (v2) ===== */
const NOTIF_ICONS={feedback:'rate_review',feedback_reply:'reply',data_transfer:'folder_data',file_release:'task',file_request:'description',system:'info'};
const NOTIF_LABELS={feedback:'Feedback',feedback_reply:'Reply',data_transfer:'Data Transfer',file_release:'File Release',file_request:'File Request',system:'System'};
const NOTIF_STATE={filter:'all',items:[],hasMore:false,busy:false,timer:null};
function isAdminUser(){return window.CURRENT_USER?.role==='Administrator';}
function apiUrl(path){return `${window.APP_BASE||''}/includes/${path}`;}
function apiPost(path,data){
  const fd=new FormData(); Object.entries(data||{}).forEach(([k,v])=>fd.append(k,v)); fd.append('csrf_token',window.CSRF_TOKEN||'');
  return fetch(apiUrl(path),{method:'POST',body:fd,credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest','X-CSRF-Token':window.CSRF_TOKEN||''}}).then(r=>r.json().catch(()=>({ok:false,error:'Invalid server response.'})));
}
function apiGet(path){return fetch(apiUrl(path),{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'}}).then(r=>r.json().catch(()=>({ok:false,error:'Invalid server response.'})));}
function parseServerDate(v){const d=new Date(String(v||'').replace(' ','T'));return isNaN(d.getTime())?null:d;}
function timeAgo(v){
  const d=parseServerDate(v); if(!d)return escapeHtml(v||'');
  const s=Math.max(0,Math.floor((Date.now()-d.getTime())/1000));
  if(s<60)return 'Just now'; if(s<3600)return Math.floor(s/60)+' min ago'; if(s<86400)return Math.floor(s/3600)+' hr ago';
  if(s<604800)return Math.floor(s/86400)+' d ago'; return d.toLocaleDateString();
}
function fullTime(v){const d=parseServerDate(v);return d?d.toLocaleString():String(v||'');}
function setUnread(n){
  n=Math.max(0,Number(n)||0); window.NOTIF_UNREAD=n;
  const label=n>99?'99+':String(n);
  const b=document.getElementById('notifMenuBadge'); if(b){b.textContent=label;b.hidden=n===0;}
  const d=document.getElementById('notifDot'); if(d)d.hidden=n===0;
  document.title=document.title.replace(/^\(\d+\+?\)\s*/,'');
  if(n>0)document.title=`(${label}) ${document.title}`;
}
function starsHtml(r){r=Number(r)||0;if(r<1)return '';return `<span class="fb-stars" title="${r} out of 5">${'★'.repeat(r)}<i>${'★'.repeat(5-r)}</i></span>`;}
function statusBadge(s){s=s||'open';return `<span class="fb-status ${escapeHtml(s)}">${escapeHtml(s.charAt(0).toUpperCase()+s.slice(1))}</span>`;}
function repliesHtml(list){
  if(!list||!list.length)return '';
  return `<div class="fb-thread">${list.map(r=>`<div class="fb-reply"><div class="fb-reply-head"><strong>${escapeHtml(r.sender_name||'Administrator')}</strong><small title="${escapeHtml(fullTime(r.created_at))}">${timeAgo(r.created_at)}</small></div><p>${escapeHtml(r.message||'')}</p></div>`).join('')}</div>`;
}
function notificationCard(n){
  const unread=Number(n.is_read)===0, isFb=n.type==='feedback';
  const canDismiss=!isFb && n.user_id!==null && n.user_id!==undefined;
  const meta=[];
  if(isFb&&n.category)meta.push(`<span class="fb-chip">${escapeHtml(n.category)}</span>`);
  if(isFb)meta.push(statusBadge(n.status)); if(isFb&&n.rating)meta.push(starsHtml(n.rating));
  let actions='';
  if(isFb&&isAdminUser()){
    actions=`<div class="notification-actions"><button type="button" class="gw-btn secondary" data-nact="resolve" data-id="${Number(n.id)}" data-status="${n.status==='resolved'?'open':'resolved'}"><span class="material-symbols-outlined">${n.status==='resolved'?'undo':'task_alt'}</span>${n.status==='resolved'?'Reopen':'Mark Resolved'}</button><button type="button" class="gw-btn secondary" data-nact="reply" data-id="${Number(n.id)}"><span class="material-symbols-outlined">reply</span>Reply</button></div>`;
  }
  return `<div class="notification-card ${unread?'unread':''}" data-id="${Number(n.id)}" data-unread="${unread?1:0}">
    <div class="notification-card-head"><div class="notif-type-icon ${escapeHtml(n.type||'system')}"><span class="material-symbols-outlined">${NOTIF_ICONS[n.type]||'notifications'}</span></div>
      <div class="notif-head-main"><strong>${escapeHtml(n.title||'Notification')}</strong><span>${escapeHtml(n.sender_name||'System')} · ${escapeHtml(n.sender_role||'System')}</span></div>
      <small title="${escapeHtml(fullTime(n.created_at))}">${timeAgo(n.created_at)}</small>
      ${canDismiss?`<button type="button" class="notif-dismiss" data-nact="dismiss" data-id="${Number(n.id)}" aria-label="Dismiss" title="Dismiss"><span class="material-symbols-outlined">close</span></button>`:''}</div>
    ${meta.length?`<div class="fb-meta">${meta.join('')}</div>`:''}
    <p>${escapeHtml(n.message||'')}</p>${repliesHtml(n.replies)}${actions}</div>`;
}
function notifTabs(){
  const tabs=[['all','All'],['unread','Unread']]; if(isAdminUser())tabs.push(['feedback','Feedback Inbox']);
  return tabs.map(([k,l])=>`<button type="button" class="notif-tab ${NOTIF_STATE.filter===k?'active':''}" data-nact="tab" data-tab="${k}">${l}</button>`).join('');
}
function showNotificationModal(){
  document.getElementById('userMenu')?.classList.remove('open');
  const root=document.getElementById('modalRoot'); if(!root)return;
  const admin=isAdminUser();
  const subtitle=admin?'Staff feedback, file requests and data transfers.':'Transferred data/files, file releases and replies to your feedback.';
  NOTIF_STATE.filter='all';
  root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal notifications-modal" id="notifModal">
    <div class="gw-modal-head"><div><strong>${admin?'Admin Notifications':'Notifications'}</strong><small>${subtitle}</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
    <div class="gw-modal-body"><div class="notif-toolbar"><div class="notif-tabs" id="notifTabs">${notifTabs()}</div><button type="button" class="gw-btn secondary" data-nact="read_all"><span class="material-symbols-outlined">done_all</span>Mark all read</button></div>
    <div class="notification-list" id="notifList"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading notifications...</div></div>
    <div class="record-actions"><button class="gw-btn primary" onclick="closeModal()">Close</button></div></div></div></div>`;
  loadNotifications(true);
}
function renderNotifList(append){
  const box=document.getElementById('notifList'); if(!box)return;
  const tabs=document.getElementById('notifTabs'); if(tabs)tabs.innerHTML=notifTabs();
  const feedbackTab=NOTIF_STATE.filter==='feedback';
  if(!NOTIF_STATE.items.length){
    box.innerHTML=`<div class="notification-empty"><span class="material-symbols-outlined">${NOTIF_STATE.filter==='unread'?'mark_email_read':'notifications_none'}</span><strong>${NOTIF_STATE.filter==='unread'?'You are all caught up':feedbackTab?'No feedback yet':'No notifications yet'}</strong><p>${NOTIF_STATE.filter==='unread'?'There is nothing unread.':feedbackTab?'Feedback from staff will appear here.':'New activity will appear here.'}</p></div>`; return;
  }
  box.innerHTML=NOTIF_STATE.items.map(notificationCard).join('')+(NOTIF_STATE.hasMore?`<button type="button" class="gw-btn secondary notif-more" data-nact="more">Load older</button>`:'');
}
function loadNotifications(reset){
  if(NOTIF_STATE.busy)return; NOTIF_STATE.busy=true;
  const f=NOTIF_STATE.filter, last=NOTIF_STATE.items.length?NOTIF_STATE.items[NOTIF_STATE.items.length-1].id:0;
  const before=reset?'':(last?`&before_id=${Number(last)}`:'');
  const url=f==='feedback'?`notifications.php?action=feedback_inbox${before}`:`notifications.php?action=list&filter=${f==='unread'?'unread':''}${before}`;
  apiGet(url).then(d=>{
    if(!d.ok)throw new Error(d.error||'Unable to load notifications.');
    NOTIF_STATE.items=reset?d.items:NOTIF_STATE.items.concat(d.items); NOTIF_STATE.hasMore=!!d.has_more;
    if(typeof d.unread==='number')setUnread(d.unread);
    renderNotifList();
  }).catch(e=>{const box=document.getElementById('notifList');if(box)box.innerHTML=`<div class="notification-empty"><span class="material-symbols-outlined">error</span><strong>Unable to load notifications</strong><p>${escapeHtml(e.message||'Please try again.')}</p></div>`;})
  .finally(()=>{NOTIF_STATE.busy=false;});
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-nact]');
  if(btn&&btn.closest('#notifModal')){
    const act=btn.dataset.nact, id=Number(btn.dataset.id||0);
    if(act==='tab'){NOTIF_STATE.filter=btn.dataset.tab;NOTIF_STATE.items=[];loadNotifications(true);return;}
    if(act==='more'){loadNotifications(false);return;}
    if(act==='read_all'){apiPost('notifications.php',{action:'read_all'}).then(d=>{if(d.ok){setUnread(0);NOTIF_STATE.items.forEach(n=>{n.is_read=1;});if(NOTIF_STATE.filter==='unread'){NOTIF_STATE.items=[];}renderNotifList();}});return;}
    if(act==='dismiss'){e.stopPropagation();apiPost('notifications.php',{action:'dismiss',id}).then(d=>{if(d.ok){NOTIF_STATE.items=NOTIF_STATE.items.filter(n=>Number(n.id)!==id);setUnread(d.unread);renderNotifList();}});return;}
    if(act==='resolve'){e.stopPropagation();apiPost('notifications.php',{action:'feedback_status',id,status:btn.dataset.status}).then(d=>{if(!d.ok)return showModal('Unable to update',d.error||'Please try again.');NOTIF_STATE.items=[];loadNotifications(true);});return;}
    if(act==='reply'){e.stopPropagation();const n=NOTIF_STATE.items.find(x=>Number(x.id)===id)||{};showFeedbackReply(id,n.sender_name||'Staff',n.sender_role||'Staff',n.message||'');return;}
  }
  const card=e.target.closest('#notifList .notification-card');
  if(card&&card.dataset.unread==='1'){
    const id=Number(card.dataset.id); card.classList.remove('unread'); card.dataset.unread='0';
    const n=NOTIF_STATE.items.find(x=>Number(x.id)===id); if(n)n.is_read=1;
    apiPost('notifications.php',{action:'read',id}).then(d=>{if(d.ok)setUnread(d.unread);});
  }
});
/* Live badge: passive polling never extends the 5-minute inactivity timer (server uses require_login_passive). */
(function(){
  let stopped=false, last=null;
  function poll(){
    if(stopped||document.hidden)return;
    apiGet('notifications.php?action=count').then(d=>{
      if(!d||d.ok!==true){ if(d&&d.error==='Session expired')stopped=true; return; }
      if(last!==null&&d.unread>last){document.getElementById('notifDot')?.classList.add('pulse');setTimeout(()=>document.getElementById('notifDot')?.classList.remove('pulse'),2500);
        if(document.getElementById('notifModal')&&NOTIF_STATE.filter!=='feedback'){NOTIF_STATE.items=[];loadNotifications(true);}}
      last=d.unread; setUnread(d.unread);
    }).catch(()=>{});
  }
  function init(){
    const role=window.CURRENT_USER?.role; if(role!=='Administrator'&&role!=='Staff')return;
    last=Number(window.NOTIF_UNREAD)||0;
    setInterval(poll,60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
function showFeedbackReply(notificationId,staffName,staffRole,originalMessage){
 closeModal();
 showFeedbackModal({replyTo:Number(notificationId),recipientName:staffName,recipientRole:staffRole,originalMessage:originalMessage});
}
function showFeedbackSentModal(){
  const root=document.getElementById('modalRoot'); if(!root)return;
  root.innerHTML=`<div class="gw-modal-backdrop"><div class="gw-modal feedback-sent-modal">
    <div class="feedback-sent-icon"><span class="material-symbols-outlined">mark_email_read</span></div>
    <div class="gw-modal-body feedback-sent-body"><strong>Success</strong><p>Your message has been sent successfully.</p><button class="gw-btn primary" onclick="closeModal()">Done</button></div>
  </div></div>`;
}
const FEEDBACK_CATEGORIES=['Suggestion','Problem / Bug','Compliment','Question','Other'];
function showFeedbackModal(replyContext=null){
 document.getElementById('userMenu')?.classList.remove('open');
 const root=document.getElementById('modalRoot'); if(!root)return;
 const user=window.CURRENT_USER||{name:'User',role:'Staff'};
 const replying=!!replyContext;
 const recipientName=replyContext?.recipientName||'', recipientRole=replyContext?.recipientRole||'', original=replyContext?.originalMessage||'';
 const extra=replying?'':`<div class="feedback-account-grid"><div class="feedback-readonly-field"><label for="fbCategory">Category</label><select id="fbCategory" name="category" class="edit-user-input">${FEEDBACK_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div><div class="feedback-readonly-field"><label>Overall experience <small style="font-weight:500;color:#94a3b8">(optional)</small></label><div class="fb-rate" id="fbRate" role="radiogroup" aria-label="Rating">${[1,2,3,4,5].map(i=>`<button type="button" data-r="${i}" aria-label="${i} star${i>1?'s':''}">★</button>`).join('')}</div><input type="hidden" name="rating" id="fbRating" value=""></div></div>`;
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal feedback-modal">
 <div class="gw-modal-head"><div><strong>${replying?'Reply to Feedback':'Send Feedback'}</strong><small>${replying?'Send a response directly to '+escapeHtml(recipientName)+'.':'Help us improve the Great Solomon Manpower Services system.'}</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
 <div class="gw-modal-body">
 ${replying?'':`<div class="notif-tabs fb-modal-tabs"><button type="button" class="notif-tab active" id="fbTabNew">New Feedback</button><button type="button" class="notif-tab" id="fbTabMine">My Feedback</button></div>`}
 <div id="fbPaneNew">
 ${replying?`<div class="feedback-reply-context"><strong>Original feedback from ${escapeHtml(recipientName)} (${escapeHtml(recipientRole)})</strong><p>${escapeHtml(original)}</p></div>`:`<div class="feedback-intro"><span class="material-symbols-outlined">rate_review</span><div><strong>Your account details are automatic</strong><p>Your name and role are taken from the account currently signed in.</p></div></div>`}
 <form method="post" action="${window.APP_BASE||''}/includes/feedback.php">
 <input type="hidden" name="csrf_token" value="${escapeHtml(window.CSRF_TOKEN||'')}">
 <input type="hidden" name="return_to" value="${escapeHtml(window.location.pathname + window.location.search)}">
 ${replying?`<input type="hidden" name="action" value="reply"><input type="hidden" name="notification_id" value="${Number(replyContext.replyTo)}">`:''}
 <div class="feedback-account-grid"><div class="feedback-readonly-field"><label>${replying?'From':'Name'}</label><div class="feedback-readonly-value"><span class="material-symbols-outlined">person</span>${escapeHtml(user.name)}</div></div><div class="feedback-readonly-field"><label>${replying?'To':'Role'}</label><div class="feedback-readonly-value"><span class="material-symbols-outlined">${replying?'person':'badge'}</span>${escapeHtml(replying?recipientName:user.role)}</div></div></div>
 ${extra}
 <div class="feedback-message-field"><label for="feedbackText">${replying?'Reply':'Your Feedback'}</label><textarea id="feedbackText" name="feedback" rows="7" required minlength="${replying?1:5}" maxlength="3000" placeholder="${replying?'Write your reply...':'Tell us what worked well, what should be improved, or if you found a problem...'}"></textarea><div class="feedback-helper"><span>Please avoid including passwords or other sensitive information.</span><span id="fbCount" class="fb-count">0 / 3000</span></div></div>
 <div class="record-actions"><button type="button" class="gw-btn secondary" onclick="closeModal()">Cancel</button><button class="gw-btn primary" type="submit"><span class="material-symbols-outlined">${replying?'reply':'send'}</span>${replying?'Send Reply':'Send Feedback'}</button></div>
 </form></div>
 <div id="fbPaneMine" hidden></div>
 </div></div></div>`;
 const ta=document.getElementById('feedbackText'), cnt=document.getElementById('fbCount');
 ta?.addEventListener('input',()=>{if(cnt)cnt.textContent=`${ta.value.length} / 3000`;});
 document.getElementById('fbRate')?.addEventListener('click',e=>{
   const b=e.target.closest('button[data-r]'); if(!b)return; const hid=document.getElementById('fbRating');
   const v=hid.value===b.dataset.r?'':b.dataset.r; hid.value=v;
   document.querySelectorAll('#fbRate button').forEach(x=>x.classList.toggle('on',Number(x.dataset.r)<=Number(v||0)));
 });
 const tabNew=document.getElementById('fbTabNew'), tabMine=document.getElementById('fbTabMine');
 tabNew?.addEventListener('click',()=>{tabNew.classList.add('active');tabMine.classList.remove('active');document.getElementById('fbPaneNew').hidden=false;document.getElementById('fbPaneMine').hidden=true;});
 tabMine?.addEventListener('click',()=>{
   tabMine.classList.add('active');tabNew.classList.remove('active');document.getElementById('fbPaneNew').hidden=true;
   const pane=document.getElementById('fbPaneMine'); pane.hidden=false;
   pane.innerHTML='<div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading your feedback...</div>';
   apiGet('notifications.php?action=my_feedback').then(d=>{
     if(!d.ok)throw new Error(d.error||'Unable to load.');
     pane.innerHTML=d.items.length?`<div class="notification-list">${d.items.map(f=>`<div class="notification-card"><div class="fb-meta">${f.category?`<span class="fb-chip">${escapeHtml(f.category)}</span>`:''}${statusBadge(f.status)}${starsHtml(f.rating)}<small class="fb-when" title="${escapeHtml(fullTime(f.created_at))}">${timeAgo(f.created_at)}</small></div><p>${escapeHtml(f.message)}</p>${repliesHtml(f.replies)}</div>`).join('')}</div>`:'<div class="notification-empty"><span class="material-symbols-outlined">forum</span><strong>No feedback sent yet</strong><p>Feedback you send, and any replies, will appear here.</p></div>';
   }).catch(e=>{pane.innerHTML=`<div class="notification-empty"><strong>${escapeHtml(e.message)}</strong></div>`;});
 });
 setTimeout(()=>ta?.focus(),50);
}
function showTermsModal(){
 document.getElementById('userMenu')?.classList.remove('open');
 const root=document.getElementById('modalRoot'); if(!root)return;
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal terms-modal">
 <div class="gw-modal-head"><div><strong>Terms and Conditions</strong><small>Great Solomon Manpower Services Inc. — Core Transaction 4</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
 <div class="gw-modal-body terms-body">
 <p>By accessing and using this system, you acknowledge that it is intended only for authorized Great Solomon Manpower Services Inc. administrators and staff. You are responsible for using your assigned account appropriately, keeping your password and verification information confidential, and ensuring that records you create or update are accurate and used only for legitimate company purposes. Sharing accounts, attempting to access another user's account, bypassing access controls, or using the system for unauthorized purposes is prohibited.</p>
 <p>The system processes personal and, where applicable, sensitive personal information. The company will handle such information in accordance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, including its principles on transparency, legitimate purpose, proportionality, and appropriate protection of personal information. Users must not disclose, copy, download, or otherwise process personal information beyond what is authorized for their work responsibilities.</p>
 <p>Users must also use the system and its computer resources responsibly and must not perform unauthorized access, interception, alteration, deletion, disruption, introduction of malicious code, or other prohibited activity. The <strong>Cybercrime Prevention Act of 2012 (Republic Act No. 10175)</strong> addresses offenses involving the confidentiality, integrity, and availability of computer data and systems, and this system's security controls and audit records may be used to support legitimate security and compliance activities.</p>
 <p>For workplace health and safety records, users must enter and maintain information responsibly and support the company's safety processes. The <strong>Occupational Safety and Health Standards Law (Republic Act No. 11058)</strong> strengthens compliance with occupational safety and health standards and provides duties and protections relating to workplace hazards, safety programs, training, incident reporting, and worker safety. Records in this system should therefore be used only for authorized health, safety, welfare, and compliance purposes.</p>
 <p>Electronic records, messages, and transactions handled through this system may also be subject to the <strong>Electronic Commerce Act of 2000 (Republic Act No. 8792)</strong> and other applicable Philippine laws and regulations. By continuing to use the system, you agree to follow company policies, applicable laws, and authorized instructions; system activity may be logged for security, audit, operational, and compliance purposes. These terms describe system-use rules and are not a substitute for legal advice; applicable laws and regulations prevail where they conflict with these terms.</p>
 <div class="terms-note"><span class="material-symbols-outlined">verified_user</span><span>Use the system responsibly and report security, privacy, or data-quality concerns to the appropriate administrator.</span></div>
 <div class="record-actions"><button type="button" class="gw-btn primary" onclick="closeModal()">I Understand</button></div>
 </div></div></div>`;
}
function showEditUserModal(id,name,email,role){
 const root=document.getElementById('modalRoot'); if(!root)return;
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal">
 <div class="gw-modal-head"><strong>Edit User Account</strong><button class="gw-modal-close" onclick="closeModal()">×</button></div>
 <div class="gw-modal-body"><form method="post" action="${window.location.pathname}">
 <input type="hidden" name="action" value="edit_user"><input type="hidden" name="id" value="${escapeHtml(id)}">
 <div class="form-grid edit-user-fields">
 <div class="full"><label>New Name</label><input class="edit-user-input" name="name" value="${escapeHtml(name)}" required autocomplete="name"></div>
 <div class="full"><label>New Email</label><input class="edit-user-input" type="email" name="email" value="${escapeHtml(email)}" required autocomplete="email"></div>
 <div class="full"><label>New Role</label><select class="edit-user-input" name="role" required><option value="Administrator" ${role==="Administrator"?"selected":""}>Administrator</option><option value="Staff" ${role==="Staff"?"selected":""}>Staff</option></select></div>
 <div class="full"><label>New Password</label><input class="edit-user-input" type="password" name="password" minlength="6" placeholder="Leave blank to keep current password" autocomplete="new-password"></div></div>
 <div class="record-actions"><button type="button" class="gw-btn secondary" onclick="closeModal()">Cancel</button><button class="gw-btn primary">Save Changes</button></div>
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
   const fd=new FormData(); fd.append('message',text); fd.append('history',JSON.stringify(history.slice(-8)));
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
  const fd=new FormData(form);
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
  const fd=new FormData(); fd.append('id',id);
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
    <div class="gw-modal-body"><div id="archiveList" class="data-storage-list"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading archive...</div></div></div>
  </div></div>`;
  fetch(`${window.APP_BASE||''}/includes/archive.php?action=list`,{credentials:'same-origin'})
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
  const fd=new FormData(); fd.append('id',id); fd.append('action','recover');
  fetch(`${window.APP_BASE||''}/includes/archive.php?action=recover`,{method:'POST',body:fd,credentials:'same-origin'})
   .then(r=>r.json()).then(data=>{if(!data.ok)throw new Error(data.error||'Recovery failed.');window.DATA_STORAGE_HAS_FILES=null;showArchiveModal();})
   .catch(e=>showModal('Recovery failed',e.message));
}
function deleteArchiveItem(id,name){
  if(!confirm('Permanently delete "'+name+'"? This action cannot be undone.')) return;
  const fd=new FormData(); fd.append('id',id); fd.append('action','delete');
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

/* Release-file picker: reuses Data Storage without exposing its management controls. */
function getSelectedReleaseFiles(){
 const box=document.getElementById('releaseStorageFileIds');
 if(!box)return [];
 return [...box.querySelectorAll('input[name="storage_file_ids[]"]')].map(i=>Number(i.value)).filter(Boolean);
}
function renderSelectedReleaseFiles(){
 const display=document.getElementById('selectedReleaseFile'); if(!display)return;
 const items=window.SELECTED_RELEASE_FILES||[];
 display.innerHTML=items.length ? items.map(f=>`<div class="selected-file-chip"><span class="material-symbols-outlined">description</span><span class="selected-file-chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><button type="button" onclick="removeReleaseFile(${Number(f.id)})" aria-label="Remove ${escapeHtml(f.name)}"><span class="material-symbols-outlined">close</span></button></div>`).join('') : '<div class="selected-file-note">No data/file selected.</div>';
 const hidden=document.getElementById('releaseStorageFileIds');
 if(hidden)hidden.innerHTML=items.map(f=>`<input type="hidden" name="storage_file_ids[]" value="${Number(f.id)}">`).join('');
}
function showReleaseFileStoragePicker(){
 const root=document.getElementById('modalRoot'); if(!root)return;
 const selected=new Set((window.SELECTED_RELEASE_FILES||[]).map(f=>Number(f.id)));
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal data-storage-modal">
   <div class="gw-modal-head"><div><strong>Data Storage</strong><small>Choose one or more data/files to release.</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
   <div class="gw-modal-body"><div id="releaseStoragePickerList" class="data-storage-list"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading stored files...</div></div><div class="record-actions"><button type="button" class="gw-btn primary" onclick="closeModal()">Done</button></div></div>
 </div></div>`;
 fetch(`${window.APP_BASE||''}/includes/data_storage.php?action=list`,{credentials:'same-origin'}).then(r=>r.json()).then(data=>{
   const box=document.getElementById('releaseStoragePickerList'); if(!box)return;
   if(!data.ok || !Array.isArray(data.items) || !data.items.length){box.innerHTML='<div class="notification-empty"><span class="material-symbols-outlined">folder_off</span><strong>NO DATA/FILES STORED YET.</strong></div>';return;}
   box.innerHTML=data.items.map(f=>{
     const checked=selected.has(Number(f.id));
     return `<button type="button" class="data-storage-item ${checked?'selected-storage-item':''}" onclick="toggleReleaseFileSelection(${Number(f.id)},${JSON.stringify(String(f.file_name))},${JSON.stringify(String(f.file_type||''))})"><span class="data-storage-file-icon material-symbols-outlined">${checked?'check_circle':'description'}</span><span class="data-storage-file-main"><strong>${escapeHtml(f.file_name)}</strong><small>${escapeHtml(f.source_branch||'Other Branch')} · ${escapeHtml(formatBytes(f.file_size))}</small></span><span class="material-symbols-outlined">${checked?'check':'add'}</span></button>`;
   }).join('');
 }).catch(()=>{const box=document.getElementById('releaseStoragePickerList');if(box)box.innerHTML='<div class="notification-empty"><span class="material-symbols-outlined">error</span><strong>UNABLE TO LOAD DATA/FILES.</strong><p>Please try again.</p></div>';});
}
function toggleReleaseFileSelection(id,name,type){
 window.SELECTED_RELEASE_FILES=window.SELECTED_RELEASE_FILES||[];
 const i=window.SELECTED_RELEASE_FILES.findIndex(f=>Number(f.id)===Number(id));
 if(i>=0)window.SELECTED_RELEASE_FILES.splice(i,1); else window.SELECTED_RELEASE_FILES.push({id:Number(id),name:String(name),type:String(type||'')});
 renderSelectedReleaseFiles();
 showReleaseFileStoragePicker();
}
function removeReleaseFile(id){
 window.SELECTED_RELEASE_FILES=(window.SELECTED_RELEASE_FILES||[]).filter(f=>Number(f.id)!==Number(id));
 renderSelectedReleaseFiles();
}
