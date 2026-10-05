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



function initUpdatePopups(){
 document.querySelectorAll('details').forEach(details=>{
   const form=details.querySelector('form');
   const action=form?.querySelector('input[name="action"]')?.value||'';
   if(!form || !/^update|^edit|^set_user_status/.test(action))return;
   const summary=details.querySelector('summary'); if(!summary || summary.dataset.popupBound)return;
   summary.dataset.popupBound='1';
   summary.addEventListener('click',e=>{
     e.preventDefault();
     const root=document.getElementById('modalRoot'); if(!root)return;
     const clone=form.cloneNode(true);
     clone.removeAttribute('onsubmit');
     clone.querySelectorAll('[autofocus]').forEach(x=>x.removeAttribute('autofocus'));
     root.innerHTML='';
     const backdrop=document.createElement('div');backdrop.className='gw-modal-backdrop';
     backdrop.innerHTML='<div class="gw-modal update-popup-form"><div class="gw-modal-head"><div><strong>Update Record</strong><small>Edit the selected record without leaving this page.</small></div><button type="button" class="gw-modal-close" onclick="closeModal()">×</button></div><div class="gw-modal-body"></div></div>';
     backdrop.addEventListener('click',ev=>{if(ev.target===backdrop)closeModal();});
     backdrop.querySelector('.gw-modal-body').appendChild(clone);
     root.appendChild(backdrop);
   });
 });
 // Compact status-only update forms are not inside <details>; convert their
 // submit controls into the same centered popup without changing the POST action.
 document.querySelectorAll('form').forEach(form=>{
   const action=form.querySelector('input[name="action"]')?.value||'';
   if(!/^update_/.test(action)||form.closest('details')||form.dataset.popupBound)return;
   const button=form.querySelector('button[type="submit"],button:not([type])'); if(!button)return;
   form.dataset.popupBound='1';
   form.addEventListener('submit',e=>{
     if(form.dataset.popupSubmitting==='1')return;
     e.preventDefault();
     const root=document.getElementById('modalRoot');if(!root)return;
     const clone=form.cloneNode(true);clone.dataset.popupSubmitting='1';
     const backdrop=document.createElement('div');backdrop.className='gw-modal-backdrop';
     backdrop.innerHTML='<div class="gw-modal update-popup-form"><div class="gw-modal-head"><div><strong>Confirm Update</strong><small>Review the update before saving it.</small></div><button type="button" class="gw-modal-close" onclick="closeModal()">×</button></div><div class="gw-modal-body"></div></div>';
     backdrop.addEventListener('click',ev=>{if(ev.target===backdrop)closeModal();});
     backdrop.querySelector('.gw-modal-body').appendChild(clone);root.innerHTML='';root.appendChild(backdrop);
     clone.addEventListener('submit',()=>{form.dataset.popupSubmitting='1';});
   });
 });
}

function initTableEnhancements(){
 document.querySelectorAll('.table-wrap, .feedback-table-wrap').forEach(w=>{w.classList.add('resizable-table-wrap');});
 document.querySelectorAll('.data-table, .feedback-data-table').forEach(table=>{
   table.classList.add('resizable-data-table');
   const heads=table.querySelectorAll('thead th');
   heads.forEach((th,index)=>{
     if(th.querySelector('.table-resize-handle'))return;
     const handle=document.createElement('span'); handle.className='table-resize-handle'; handle.title='Drag to resize column';
     th.style.position='relative'; th.appendChild(handle);
     let startX=0,startW=0;
     handle.addEventListener('mousedown',e=>{
       e.preventDefault(); e.stopPropagation(); startX=e.clientX; startW=th.getBoundingClientRect().width;
       const move=ev=>{const width=Math.max(80,startW+(ev.clientX-startX)); th.style.width=width+'px'; th.style.minWidth=width+'px'; table.style.minWidth=Math.max(table.scrollWidth,width*heads.length)+'px';};
       const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
       document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
     });
   });
   // Keep the first five records visible by default; existing explicit "see all"
   // links can opt into all rows with data-show-all="1".
   if(table.dataset.showAll!=='1'){
     [...table.tBodies].forEach(tbody=>[...tbody.rows].forEach((row,i)=>{
       row.classList.toggle('table-row-over-limit',i>=5 && !row.querySelector('.feedback-table-empty,.empty'));
     }));
   }
 });
}

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
  initTableEnhancements();
  initUpdatePopups();
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
 const s=String(status||'New'); const cls=s.toLowerCase().replace(/\s+/g,'-');
 return `<span class="feedback-status-badge ${cls}">${escapeHtml(s)}</span>`;
}
function feedbackPriorityBadge(priority){return `<span class="feedback-priority-badge ${String(priority||'Medium').toLowerCase()}">${escapeHtml(priority||'Medium')}</span>`;}
function feedbackThreadCard(thread,isAdmin){
 const msgs=Array.isArray(thread.messages)?thread.messages:[];
 const last=msgs.length?msgs[msgs.length-1]:null;
 const action=isAdmin
   ? `<button type="button" class="gw-btn secondary" onclick="showFeedbackThread(${Number(thread.id)})"><span class="material-symbols-outlined">visibility</span>View</button><button type="button" class="gw-btn btn-danger" onclick="deleteFeedbackThread(${Number(thread.id)})"><span class="material-symbols-outlined">delete</span>Delete</button>`
   : `<button type="button" class="gw-btn primary" onclick="showFeedbackThread(${Number(thread.id)})"><span class="material-symbols-outlined">visibility</span>View</button><button type="button" class="gw-btn btn-danger" onclick="deleteStaffFeedback(${Number(thread.id)})"><span class="material-symbols-outlined">undo</span>Unsend</button>`;
 return `<div class="notification-card feedback-thread-card" data-feedback-thread="${Number(thread.id)}"><div class="notification-card-head"><div><strong>${escapeHtml(thread.subject||'Feedback')}</strong><span>${escapeHtml(thread.owner_name||'Employee')} · ${escapeHtml(thread.category||'General Feedback')}</span></div><small>${renderDate(thread.updated_at||thread.created_at)}</small></div><div class="feedback-thread-meta">${feedbackStatusBadge(thread.status)} ${feedbackPriorityBadge(thread.priority)}</div><p>${escapeHtml((last?.message||thread.last_message||'').slice(0,300))}${(last?.message||thread.last_message||'').length>300?'…':''}</p><div class="notification-actions">${action}</div></div>`;
}
function adminFeedbackThreads(){return Array.isArray(window.FEEDBACK_THREADS)?window.FEEDBACK_THREADS.filter(t=>!t.archived_at):[];}
function renderAdminFeedbackInterface(selectedId=null){
 const root=document.getElementById('adminFeedbackWorkspace'),stats=document.getElementById('adminFeedbackStats');
 if(!root)return;
 const threads=adminFeedbackThreads();
 if(stats)stats.innerHTML=`<div class="feedback-stat-card total"><span class="material-symbols-outlined">forum</span><div><strong>${threads.length}</strong><span>Active employee feedback</span></div></div><div class="feedback-stat-card attention"><span class="material-symbols-outlined">visibility</span><div><strong>${threads.filter(t=>t.status==='New').length}</strong><span>New feedback</span></div></div>`;
 if(!threads.length){root.innerHTML='<div class="admin-feedback-empty"><span class="material-symbols-outlined">forum</span><strong>No employee feedback yet</strong><p>Employee feedback will appear here when submitted.</p></div>';return;}
 const current=threads.find(t=>Number(t.id)===Number(selectedId))||threads[0];
 const cards=threads.map(t=>{
   const last=(t.messages||[]).slice(-1)[0];
   return `<button type="button" class="admin-feedback-item ${Number(t.id)===Number(current.id)?'active':''}" data-admin-feedback-item="${Number(t.id)}" data-admin-feedback-search="${escapeHtml([t.subject,t.owner_name,t.category,last?.message||''].join(' ').toLowerCase())}" onclick="renderAdminFeedbackInterface(${Number(t.id)})">
     <div class="admin-feedback-item-top"><strong>${escapeHtml(t.subject||'Feedback')}</strong>${feedbackStatusBadge(t.status)}</div>
     <div class="admin-feedback-item-meta"><span>${escapeHtml(t.owner_name||'Employee')}</span><span>${escapeHtml(t.category||'General Feedback')}</span>${feedbackPriorityBadge(t.priority)}</div>
     <p>${escapeHtml((last?.message||t.last_message||'').slice(0,120))}${(last?.message||t.last_message||'').length>120?'…':''}</p>
     <small>${renderDate(t.updated_at||t.created_at)}</small>
   </button>`;
 }).join('');
 const messages=(current.messages||[]).map(m=>`<div class="admin-feedback-message ${Number(m.sender_user_id)===Number(current.user_id)?'employee':'admin'}"><div class="admin-feedback-message-head"><strong>${escapeHtml(m.sender_name||'User')}</strong><span>${escapeHtml(m.sender_role||'')}</span><small>${renderDate(m.created_at)}</small></div><p>${escapeHtml(m.message||'')}</p></div>`).join('');
 root.innerHTML=`<div class="admin-feedback-list">
   <div class="admin-feedback-list-head"><div><strong>Employee Feedback</strong><span>${threads.length} active record${threads.length===1?'':'s'}</span></div><span class="material-symbols-outlined">inbox</span></div>
   <div class="admin-feedback-inbox-tools"><div class="feedback-search-wrap"><span class="material-symbols-outlined">search</span><input id="adminFeedbackSearch" type="search" placeholder="Search employee, subject or message..." oninput="filterAdminFeedbackWorkspace()" aria-label="Search feedback"></div></div>
   <div class="admin-feedback-items">${cards}</div>
 </div>
 <div class="admin-feedback-detail">
   <div class="admin-feedback-detail-head"><div class="admin-feedback-detail-title"><div class="feedback-detail-kicker">EMPLOYEE FEEDBACK #${Number(current.id)}</div><h3>${escapeHtml(current.subject||'Feedback')}</h3><div class="admin-feedback-detail-meta"><span><span class="material-symbols-outlined">person</span>${escapeHtml(current.owner_name||'Employee')}</span><span><span class="material-symbols-outlined">category</span>${escapeHtml(current.category||'General Feedback')}</span>${feedbackPriorityBadge(current.priority)}${feedbackStatusBadge(current.status)}</div></div>
   <button type="button" class="gw-btn btn-danger" onclick="deleteFeedbackThread(${Number(current.id)})"><span class="material-symbols-outlined">delete</span>Delete</button></div>
   <div class="admin-feedback-context"><span class="material-symbols-outlined">info</span><span>Admin access is view/delete only. Replies and feedback sending are disabled for administrators.</span></div>
   <div class="admin-feedback-conversation">${messages||'<div class="notification-empty"><strong>No messages</strong></div>'}</div>
 </div>`;
}
function filterAdminFeedbackWorkspace(){
 const search=(document.getElementById('adminFeedbackSearch')?.value||'').trim().toLowerCase();
 document.querySelectorAll('[data-admin-feedback-item]').forEach(card=>{
   const hay=card.getAttribute('data-admin-feedback-search')||'';
   card.style.display=(!search||hay.includes(search))?'':'none';
 });
}
async function showAdminFeedbackModal(){
 if(window.CURRENT_USER?.role!=='Administrator')return;
 document.getElementById('userMenu')?.classList.remove('open');
 const root=document.getElementById('modalRoot'); if(!root)return;
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal admin-feedback-modal"><div class="gw-modal-head"><div><strong>Employee Feedback</strong><small>View and archive/delete employee feedback. No replies are permitted.</small></div><button class="gw-modal-close" onclick="closeModal()">×</button></div><div class="gw-modal-body"><div id="adminFeedbackStats" class="feedback-stats-grid"></div><div id="adminFeedbackWorkspace" class="admin-feedback-workspace"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading employee feedback...</div></div></div></div></div>`;
 try{
   const r=await fetch(`${window.APP_BASE||''}/includes/feedback_threads.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store'});
   const d=await r.json(); if(!r.ok||!d.ok)throw new Error(d.message||'Unable to load employee feedback.');
   window.FEEDBACK_THREADS=Array.isArray(d.threads)?d.threads:[];
   renderAdminFeedbackInterface();
 }catch(e){
   const ws=document.getElementById('adminFeedbackWorkspace');if(ws)ws.innerHTML=`<div class="admin-feedback-empty"><strong>Unable to load employee feedback</strong><p>${escapeHtml(e.message||'Please try again.')}</p></div>`;
 }
}

function renderFeedbackDataTable(){
 const body=document.getElementById('feedbackDataTableBody'); if(!body)return;
 const isAdmin=window.CURRENT_USER?.role==='Administrator';
 const threads=Array.isArray(window.FEEDBACK_THREADS)?window.FEEDBACK_THREADS:[];
 if(!threads.length){body.innerHTML=`<tr><td colspan="${isAdmin?6:5}" class="feedback-table-empty"><span class="material-symbols-outlined">forum</span><strong>${isAdmin?'No employee feedback yet':'No feedback submitted yet'}</strong><span>${isAdmin?'Employee feedback will appear here when submitted.':'Submit feedback to start a conversation with the administrator.'}</span></td></tr>`;return;}
 body.innerHTML=threads.map(t=>{
   const last=Array.isArray(t.messages)&&t.messages.length?t.messages[t.messages.length-1]:null;
   const actions=isAdmin
     ? `<button type="button" class="gw-btn primary" onclick="showFeedbackThread(${Number(t.id)})"><span class="material-symbols-outlined">visibility</span>View</button><button type="button" class="gw-btn btn-danger" onclick="deleteFeedbackThread(${Number(t.id)})"><span class="material-symbols-outlined">delete</span>Delete</button>`
     : `<button type="button" class="gw-btn primary" onclick="showFeedbackThread(${Number(t.id)})"><span class="material-symbols-outlined">visibility</span>View</button><button type="button" class="gw-btn btn-danger" onclick="deleteStaffFeedback(${Number(t.id)})"><span class="material-symbols-outlined">undo</span>Unsend</button>`;
   const ownerCell=isAdmin?`<td><div class="feedback-table-person">${escapeHtml(t.owner_name||'Employee')}</div></td>`:'';
   return `<tr>${ownerCell}<td><div class="feedback-table-subject">${escapeHtml(t.subject||'Feedback')}</div><div class="feedback-detail-kicker">${escapeHtml(t.category||'General Feedback')} · ${feedbackPriorityBadge(t.priority)}</div></td><td><div class="feedback-table-preview">${escapeHtml(last?.message||t.last_message||'No message')}</div><div class="feedback-detail-kicker">${escapeHtml(last?.sender_name||t.last_sender_name||'User')}</div></td><td>${feedbackStatusBadge(t.status)}</td><td class="feedback-table-date">${renderDate(t.updated_at||t.created_at)}</td><td><div class="feedback-table-actions">${actions}</div></td></tr>`;
 }).join('');
}
async function refreshFeedbackDataTable(){
 const body=document.getElementById('feedbackDataTableBody'); if(!body)return;
 try{
   const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
   const r=await fetch(`${window.APP_BASE||''}/includes/feedback_threads.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store',signal:controller.signal});
   clearTimeout(timer);
   const d=await r.json().catch(()=>null);
   if(!r.ok||!d?.ok||!Array.isArray(d.threads)) throw new Error(d?.message||'Unable to load feedback.');
   window.FEEDBACK_THREADS=d.threads;
   renderFeedbackDataTable();
   initTableEnhancements();
   if(document.getElementById('adminFeedbackWorkspace')) renderAdminFeedbackInterface();
 }catch(e){
   console.error('Feedback data load failed',e);
   try{renderFeedbackDataTable();}catch(_){}
   if(body && body.querySelector('.feedback-table-loading')){
     const isAdmin=window.CURRENT_USER?.role==='Administrator';
     body.innerHTML=`<tr><td colspan="${isAdmin?6:5}" class="feedback-table-empty"><span class="material-symbols-outlined">error_outline</span><strong>Unable to load feedback</strong><span>Please refresh the page and try again.</span></td></tr>`;
   }
 }
}
async function deleteStaffFeedback(threadId){
 const id=Number(threadId)||0;
 if(!id||window.CURRENT_USER?.role!=='Staff')return;
 const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===id); if(!t)return;
 if(!confirm(`Unsend “${t.subject||'this feedback'}”? It will be moved to the Feedback Archive before removal.`))return;
 const body=new URLSearchParams({action:'staff_delete',thread_id:String(id),csrf_token:String(window.CSRF_TOKEN||''),return_to:window.location.pathname+window.location.search});
 try{
   const r=await fetch(`${window.APP_BASE||''}/includes/feedback.php`,{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()});
   const d=await r.json().catch(()=>({ok:false,message:'Invalid server response.'}));
   if(!r.ok||!d.ok)throw new Error(d.message||'Unable to delete feedback.');
   window.FEEDBACK_THREADS=(window.FEEDBACK_THREADS||[]).filter(x=>Number(x.id)!==id);
   closeModal(); refreshFeedbackDataTable();
 }catch(e){alert(e.message||'Unable to delete feedback.');}
}

function filterAdminFeedbackWorkspace(){
 const search=(document.getElementById('adminFeedbackSearch')?.value||'').trim().toLowerCase();
 const status=document.getElementById('adminFeedbackFilter')?.value||'all';
 const category=document.getElementById('adminFeedbackCategoryFilter')?.value||'all';
 const priority=document.getElementById('adminFeedbackPriorityFilter')?.value||'all';
 document.querySelectorAll('[data-admin-feedback-item]').forEach(card=>{
   const hay=card.getAttribute('data-admin-feedback-search')||'';
   const cardStatus=card.getAttribute('data-admin-feedback-status')||'';
   const cardCategory=card.getAttribute('data-admin-feedback-category')||'';
   const cardPriority=card.getAttribute('data-admin-feedback-priority')||'';
   card.style.display=((!search||hay.includes(search))&&(status==='all'||cardStatus===status)&&(category==='all'||cardCategory===category)&&(priority==='all'||cardPriority===priority))?'':'';
 });
 const items=[...document.querySelectorAll('[data-admin-feedback-item]')];
 const visible=items.filter(x=>x.style.display!=='none');
 const empty=document.querySelector('.admin-feedback-filter-empty');
 if(empty)empty.remove();
 if(!visible.length&&items.length){
   const holder=document.querySelector('.admin-feedback-items');
   if(holder)holder.insertAdjacentHTML('beforeend','<div class="admin-feedback-filter-empty"><span class="material-symbols-outlined">search_off</span><strong>No matching feedback</strong><p>Try a different search term or filter.</p></div>');
 }
}
async function reloadFeedbackThreads(){
 try{
   const r=await fetch(`${window.APP_BASE||''}/includes/feedback_threads.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store'});
   const d=await r.json().catch(()=>null);
   if(r.ok&&d?.ok&&Array.isArray(d.threads)){window.FEEDBACK_THREADS=d.threads;return true;}
 }catch(_e){}
 return false;
}
function openAdminFeedbackInterface(){showAdminFeedbackModal();}
async function handleNotificationBell(){
 try{
   const r=await fetch(`${window.APP_BASE||''}/includes/feedback_threads.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store'});
   const d=await r.json();
   if(r.ok&&d.ok&&Array.isArray(d.threads))window.FEEDBACK_THREADS=d.threads;
 }catch(e){}
 const isStaff=window.CURRENT_USER?.role==='Staff';
 const notes=isStaff?(window.STAFF_NOTIFICATIONS||[]):(window.ADMIN_NOTIFICATIONS||[]);
 const feedbackNotes=notes.filter(n=>n.type==='feedback'&&Number(n.is_read)===0);
 let target=null;
 if(feedbackNotes.length){
   const n=feedbackNotes.slice().sort((a,b)=>Number(b.id)-Number(a.id))[0];
   const threadId=Number(n.feedback_thread_id)||0;
   target=(window.FEEDBACK_THREADS||[]).find(t=>Number(t.id)===threadId);
   if(!target) target=(window.FEEDBACK_THREADS||[]).find(t=>Number(t.legacy_notification_id)===Number(n.id));
   if(!target && Number(n.reply_to_id)>0) target=(window.FEEDBACK_THREADS||[]).find(t=>Number(t.legacy_notification_id)===Number(n.reply_to_id));
 }
 if(!target && isStaff){
   target=(window.FEEDBACK_THREADS||[]).find(t=>Array.isArray(t.messages)&&t.messages.length&&String(t.messages[t.messages.length-1].sender_role||'').toLowerCase()==='administrator');
 }
 if(target){
   showFeedbackThread(Number(target.id));
   fetch(`${window.APP_BASE||''}/includes/mark_notifications_read.php`,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest','X-CSRF-Token':window.CSRF_TOKEN||''},credentials:'same-origin'}).catch(()=>{});
   return;
 }
 showNotificationModal(false);
}
async function showNotificationModal(fresh=true){
 if(fresh){
   try{
     const r=await fetch(`${window.APP_BASE||''}/includes/feedback_threads.php`,{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest'},cache:'no-store'});
     const d=await r.json();
     if(r.ok&&d.ok&&Array.isArray(d.threads)) window.FEEDBACK_THREADS=d.threads;
   }catch(e){}
 }
 const root=document.getElementById('modalRoot'); if(!root)return;
 const isStaff=window.CURRENT_USER?.role==='Staff'; const isAdmin=window.CURRENT_USER?.role==='Administrator';
 const threads=Array.isArray(window.FEEDBACK_THREADS)?window.FEEDBACK_THREADS:[];
 const notes=isStaff?(window.STAFF_NOTIFICATIONS||[]):(window.ADMIN_NOTIFICATIONS||[]);
 const title=isStaff?'Feedback & Notifications':'Employee Feedback';
 const subtitle=isStaff?'Track your feedback and administrator responses.':'View and manage feedback submitted by employees.';
 const transfer=notes.filter(n=>n.type==='data_transfer');
 // Dedicated feedback threads are the source of truth. Only show legacy
 // notifications that have not yet been migrated into a thread, preventing
 // duplicate cards in the notification bell.
 const feedbackNotes=notes.filter(n=>
   n.type==='feedback' &&
   !(Number(n.feedback_thread_id)||0)
 );
 const activeThreads=threads;
 const counts={all:activeThreads.length,new:activeThreads.filter(t=>t.status==='New').length,review:activeThreads.filter(t=>t.status==='In Review').length,replied:activeThreads.filter(t=>t.status==='Replied').length,resolved:activeThreads.filter(t=>t.status==='Resolved').length};
 const filterHtml=isAdmin?`<div class="feedback-inbox-controls"><input id="feedbackSearch" class="feedback-search" type="search" placeholder="Search employee, subject, category..." oninput="filterFeedbackInbox()"/><select id="feedbackStatusFilter" onchange="filterFeedbackInbox()"><option value="all">All statuses (${counts.all})</option><option value="New">New (${counts.new})</option><option value="In Review">In Review (${counts.review})</option><option value="Replied">Replied (${counts.replied})</option><option value="Resolved">Resolved (${counts.resolved})</option></select></div>`:'';
 const cards=activeThreads.map(t=>feedbackThreadCard(t,isAdmin)).join('');
 const feedbackNotificationCards=feedbackNotes.map(n=>{
   const threadId=Number(n.feedback_thread_id)||0;
   const thread=threadId ? threads.find(t=>Number(t.id)===threadId) : null;
   const latest=thread && Array.isArray(thread.messages) && thread.messages.length ? thread.messages[thread.messages.length-1] : null;
   const isReply=false;
   const unread=Number(n.is_read)===0;
   const viewLabel='View Feedback';
   const viewAction=thread
     ? `showFeedbackThread(${threadId})`
     : `showNotificationDetails(${Number(n.id)})`;
   const deleteAction=isAdmin
     ? `<button type="button" class="gw-btn btn-danger feedback-notification-delete" onclick="event.stopPropagation();deleteFeedbackThread(${threadId})" ${thread?'':'disabled'}><span class="material-symbols-outlined">delete</span>Delete</button>`
     : '';
   return `<div class="notification-card feedback-notification-card ${unread?'unread':''}" data-notification-id="${Number(n.id)}" data-feedback-thread="${threadId}" role="button" tabindex="0" onclick="if(!event.target.closest('button')){${thread?`showFeedbackThread(${threadId})`:`showNotificationDetails(${Number(n.id)})`}}" onkeydown="if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();${thread?`showFeedbackThread(${threadId})`:`showNotificationDetails(${Number(n.id)})`}}">
     <div class="notification-card-head">
       <div class="notification-card-title-row"><span class="feedback-notification-icon ${isReply?'reply':''}"><span class="material-symbols-outlined">feedback</span></span><div><strong>${escapeHtml(n.title||'Feedback')}</strong><span>${escapeHtml(n.sender_name||'Employee')} · ${escapeHtml(n.sender_role||'Staff')}</span></div></div>
       <small>${renderDate(n.created_at)}</small>
     </div>
     <div class="feedback-notification-status">${unread?'<span class="feedback-unread-pill"><span class="feedback-unread-dot"></span>New</span>':''}</div>
     <p>${escapeHtml(n.message||'')}</p>
     ${thread?`<div class="notification-actions"><button type="button" class="gw-btn primary" onclick="showFeedbackThread(${threadId})"><span class="material-symbols-outlined">${'forum'}</span>${viewLabel}</button>${deleteAction}</div>`:''}
   </div>`;
 }).join('');
 const transferCards=transfer.map(n=>`<div class="notification-card ${Number(n.is_read)===0?'unread':''}"><div class="notification-card-head"><div><strong>${escapeHtml(n.title||'Notification')}</strong><span>${escapeHtml(n.sender_name||'System')} · ${escapeHtml(n.sender_role||'System')}</span></div><small>${renderDate(n.created_at)}</small></div><p>${escapeHtml(n.message||'')}</p></div>`).join('');
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal notifications-modal feedback-inbox-modal">
 <div class="gw-modal-head"><div><strong>${title}</strong><small>${subtitle}</small></div><button class="gw-modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
 <div class="gw-modal-body"><div class="feedback-inbox-toolbar"><div><strong>${threads.length}</strong><span>${isAdmin?'employee feedback thread'+(threads.length===1?'':'s'):'active feedback thread'+(threads.length===1?'':'s')}</span></div><div class="feedback-notification-summary"><span><span class="material-symbols-outlined">mark_email_unread</span>${notes.filter(n=>Number(n.is_read)===0).length} new</span><span><span class="material-symbols-outlined">feedback</span>${threads.filter(t=>Array.isArray(t.messages)&&t.messages.length&&String(t.messages[t.messages.length-1].sender_role||'').toLowerCase()==='administrator').length} replied</span></div></div>${filterHtml}
 <div id="feedbackThreadList" class="notification-list">${cards}${feedbackNotificationCards}${transferCards}${(!cards&&!feedbackNotificationCards&&!transferCards)?`<div class="notification-empty"><span class="material-symbols-outlined">feedback</span><strong>${isAdmin?'No employee feedback yet':'No feedback yet'}</strong><p>${escapeHtml(subtitle)}</p></div>`:''}</div><div class="record-actions"><button class="gw-btn primary" onclick="closeModal()">Close</button></div></div></div></div>`;
 if(isAdmin) filterFeedbackInbox();
 refreshFeedbackDataTable();
 fetch(`${window.APP_BASE||''}/includes/mark_notifications_read.php`,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest','X-CSRF-Token':window.CSRF_TOKEN||''},credentials:'same-origin'}).catch(()=>{});
 [...(window.ADMIN_NOTIFICATIONS||[]),...(window.STAFF_NOTIFICATIONS||[])].forEach(n=>n.is_read=1);
 document.querySelectorAll('.notification-badge,.top-notification-badge').forEach(el=>el.remove());
}
function filterFeedbackInbox(){
 const list=document.getElementById('feedbackThreadList'); if(!list)return;
 const search=(document.getElementById('feedbackSearch')?.value||'').trim().toLowerCase();
 const status=document.getElementById('feedbackStatusFilter')?.value||'all';
 document.querySelectorAll('[data-feedback-thread]').forEach(card=>{
   const id=Number(card.getAttribute('data-feedback-thread'));
   const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===id);
   if(!t)return;
   const hay=[t.owner_name,t.subject,t.category,t.priority,t.status,t.last_message].join(' ').toLowerCase();
   card.style.display=((status==='all'||t.status===status) && (!search||hay.includes(search)))?'':'none';
 });
}
async function showFeedbackThread(threadId){
 const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===Number(threadId)); if(!t)return;
 const root=document.getElementById('modalRoot'); if(!root)return;
 const isAdmin=window.CURRENT_USER?.role==='Administrator';
 const msgs=(t.messages||[]).map(m=>`<div class="feedback-bubble ${Number(m.sender_user_id)===Number(t.user_id)?'feedback-bubble-in':'feedback-bubble-out'}"><strong>${escapeHtml(m.sender_name||'User')} · ${escapeHtml(m.sender_role||'')}</strong><small>${renderDate(m.created_at)}</small><p>${escapeHtml(m.message||'')}</p></div>`).join('');
 root.innerHTML=`<div class="gw-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal feedback-modal feedback-thread-detail"><div class="gw-modal-head"><div><strong>${escapeHtml(t.subject||'Feedback')}</strong><small>${escapeHtml(t.owner_name||'Employee')} · ${escapeHtml(t.category||'General Feedback')} · ${feedbackStatusBadge(t.status)} ${feedbackPriorityBadge(t.priority)}</small></div><button class="gw-modal-close" onclick="closeModal()">×</button></div><div class="gw-modal-body"><div class="feedback-chat-scroll feedback-thread-history">${msgs||'<div class="notification-empty"><strong>No messages</strong></div>'}</div><div class="record-actions">${isAdmin?`<button class="gw-btn btn-danger" onclick="deleteFeedbackThread(${Number(t.id)})"><span class="material-symbols-outlined">delete</span>Delete</button>`:`<button class="gw-btn btn-danger" onclick="deleteStaffFeedback(${Number(t.id)})"><span class="material-symbols-outlined">undo</span>Unsend Feedback</button>`}<button class="gw-btn secondary" onclick="closeModal()">Close</button></div></div></div></div>`;
}

async function deleteFeedbackThread(threadId){
 const id=Number(threadId)||0;
 if(!id || window.CURRENT_USER?.role!=='Administrator')return;
 const t=(window.FEEDBACK_THREADS||[]).find(x=>Number(x.id)===id);
 if(!t)return;
 if(!confirm(`Delete “${t.subject||'this feedback'}”? It will be moved to the Feedback Archive before removal.`))return;
 const body=new URLSearchParams({action:'delete_feedback',thread_id:String(id),csrf_token:String(window.CSRF_TOKEN||''),return_to:window.location.pathname+window.location.search});
 try{
   const r=await fetch(`${window.APP_BASE||''}/includes/feedback.php`,{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()});
   const d=await r.json().catch(()=>({ok:false,message:'Invalid server response.'}));
   if(!r.ok||!d.ok)throw new Error(d.message||'Unable to delete feedback.');
   window.FEEDBACK_THREADS=(window.FEEDBACK_THREADS||[]).filter(x=>Number(x.id)!==id);
   window.ADMIN_NOTIFICATIONS=(window.ADMIN_NOTIFICATIONS||[]).filter(n=>Number(n.feedback_thread_id)!==id);
   refreshFeedbackDataTable();
   closeModal();
   showAdminFeedbackModal();
 }catch(e){alert(e.message||'Unable to delete feedback.');}
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


window.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{refreshFeedbackDataTable();},0);});function showArchiveModal(type=''){
  document.getElementById('userMenu')?.classList.remove('open');
  const root=document.getElementById('modalRoot'); if(!root)return;
  const isAdmin=window.CURRENT_USER?.role==='Administrator';
  root.innerHTML=`<div class="gw-modal-backdrop archive-backdrop" onclick="if(event.target===this)closeModal()"><div class="gw-modal archive-modal">
    <div class="gw-modal-head"><div><strong>Archive</strong><small>Deleted data is retained here before permanent deletion.</small></div><button class="gw-modal-close" onclick="closeModal()">×</button></div>
    <div class="archive-toolbar">
      <button type="button" class="gw-btn ${type===''?'primary':'secondary'}" onclick="showArchiveModal('')">All</button>
      <button type="button" class="gw-btn ${type==='feedback'?'primary':'secondary'}" onclick="showArchiveModal('feedback')">Employee Feedback</button>
      <button type="button" class="gw-btn ${type==='file'?'primary':'secondary'}" onclick="showArchiveModal('file')">Files</button>
      ${isAdmin?`<span class="archive-toolbar-spacer"></span><button type="button" class="gw-btn secondary" onclick="backupArchive('')"><span class="material-symbols-outlined">download</span>Backup All</button><button type="button" class="gw-btn secondary" onclick="backupArchive('feedback')"><span class="material-symbols-outlined">save</span>Backup Feedback</button>`:''}
    </div>
    <div class="gw-modal-body"><div id="archiveList" class="data-storage-list"><div class="data-storage-loading"><span class="material-symbols-outlined">progress_activity</span>Loading archive...</div></div></div>
  </div></div>`;
  const url=`${window.APP_BASE||''}/includes/archive.php?action=list${type?'&type='+encodeURIComponent(type):''}`;
  fetch(url,{credentials:'same-origin'}).then(r=>r.json()).then(data=>{
    const box=document.getElementById('archiveList');if(!box)return;
    if(!data.ok||!data.items?.length){box.innerHTML='<div class="notification-empty"><span class="material-symbols-outlined">inventory_2</span><strong>Archive is empty</strong><p>Deleted data will appear here before permanent deletion.</p></div>';return;}
    box.innerHTML=data.items.map(x=>`<div class="data-storage-item archive-item">
      <span class="data-storage-file-icon material-symbols-outlined">${x.item_type==='file'?'description':(x.item_type==='feedback'?'feedback':'dataset')}</span>
      <span class="data-storage-file-main"><strong>${escapeHtml(x.item_name)}</strong><small>${escapeHtml(x.item_type==='feedback'?'Employee Feedback':x.item_type)} · Deleted ${escapeHtml(x.deleted_at||'')}</small></span>
      <div style="display:flex;gap:6px;align-items:center"><button class="gw-btn primary" type="button" onclick="recoverArchive(${Number(x.id)})"><span class="material-symbols-outlined">restore</span>Recover</button>${isAdmin?`<button class="gw-btn btn-danger" type="button" onclick="deleteArchiveItem(${Number(x.id)},${JSON.stringify(String(x.item_name))})"><span class="material-symbols-outlined">delete_forever</span>Delete Forever</button>`:''}</div>
    </div>`).join('');
  }).catch(()=>{const box=document.getElementById('archiveList');if(box)box.innerHTML='<div class="notification-empty"><strong>Unable to load archive.</strong><p>Please try again.</p></div>';});
}
function backupArchive(type=''){
 if(window.CURRENT_USER?.role!=='Administrator')return;
 const url=`${window.APP_BASE||''}/includes/archive.php?action=backup${type?'&type='+encodeURIComponent(type):''}`;
 window.location.href=url;
}


