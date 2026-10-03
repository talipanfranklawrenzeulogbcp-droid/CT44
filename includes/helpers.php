<?php
require_once __DIR__.'/db.php';
require_once __DIR__.'/auth.php';
function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function flash(string $type, string $message): void { $_SESSION['flash']=['type'=>$type,'message'=>$message]; }
function show_flash(): void { if (!empty($_SESSION['flash'])) { $f=$_SESSION['flash']; unset($_SESSION['flash']); echo '<div class="notice '.e($f['type']).'">'.e($f['message']).'</div>'; } }
function audit(string $module,string $action,string $details=''): void { try { $u=current_user(); $stmt=db()->prepare('INSERT INTO audit_logs(user_id,module,action,details) VALUES(?,?,?,?)'); $stmt->execute([$u['id']??null,$module,$action,$details]); } catch(Throwable $e) {} }
function base_url(): string { return app_base_path(); }
function url(string $path): string { return app_url($path); }
function redirect(string $path): never { header('Location: '.url($path)); exit; }
function feedback_threads_for_user(bool $admin=false): array {
    try {
        $u=current_user(); if (!$u) return [];
        if ($admin && ($u['role'] ?? '') !== 'Administrator') return [];
        if (!$admin && ($u['role'] ?? '') !== 'Staff') return [];
        $sql = "SELECT t.id,t.user_id,t.subject,t.category,t.priority,t.status,t.created_at,t.updated_at,t.resolved_at,
                       u.name AS owner_name,
                       (SELECT COUNT(*) FROM feedback_messages m WHERE m.thread_id=t.id) AS message_count,
                       (SELECT m.message FROM feedback_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                       (SELECT m.sender_name FROM feedback_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_sender_name,
                       (SELECT m.sender_role FROM feedback_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_sender_role
                FROM feedback_threads t
                LEFT JOIN users u ON u.id=t.user_id
                WHERE t.archived_at IS NULL AND t.user_id IS NOT NULL
                " . ($admin ? "" : "AND t.user_id=?") . "
                ORDER BY t.updated_at DESC,t.id DESC LIMIT 100";
        $q=db()->prepare($sql); $q->execute($admin ? [] : [(int)$u['id']]);
        $threads=$q->fetchAll();
        foreach($threads as &$t){
            $mq=db()->prepare("SELECT id,thread_id,sender_user_id,sender_name,sender_role,message,created_at FROM feedback_messages WHERE thread_id=? ORDER BY id ASC");
            $mq->execute([(int)$t['id']]); $t['messages']=$mq->fetchAll();
        }
        unset($t); return $threads;
    } catch(Throwable $e){ return []; }
}
function admin_feedback_notifications(): array {
    // Keep data-transfer notifications in the legacy notification stream; feedback
    // is now represented by dedicated threads and messages.
    try {
        $u=current_user(); if(!$u || ($u['role']??'')!=='Administrator') return [];
        $q=db()->prepare("SELECT n.id,n.type,n.sender_name,n.sender_role,n.sender_user_id,n.title,n.message,n.is_read,n.created_at,n.reply_to_id,n.feedback_thread_id
                          FROM admin_notifications n
                          WHERE (n.user_id=? OR n.user_id IS NULL) AND n.type IN ('feedback','feedback_reply','data_transfer')
                          ORDER BY n.created_at DESC,n.id DESC LIMIT 100");
        $q->execute([(int)$u['id']]); return $q->fetchAll();
    }catch(Throwable $e){return [];}
}
function unread_notification_count(): int {
    try{
        $u=current_user(); if(!$u)return 0;
        if(($u['role']??'')==='Administrator'){
            $q=db()->prepare("SELECT COUNT(*) FROM admin_notifications WHERE is_read=0 AND (user_id=? OR user_id IS NULL) AND type IN ('feedback','feedback_reply','data_transfer')");
        }else{
            $q=db()->prepare("SELECT COUNT(*) FROM admin_notifications WHERE is_read=0 AND (user_id=? OR user_id IS NULL) AND type IN ('data_transfer','feedback_reply')");
        }
        $q->execute([(int)$u['id']]); return (int)$q->fetchColumn();
    }catch(Throwable $e){return 0;}
}
function staff_transfer_notifications(): array {
    try{
        $u=current_user(); if(!$u || ($u['role']??'')!=='Staff')return [];
        $q=db()->prepare("SELECT n.id,n.type,n.sender_name,n.sender_role,n.sender_user_id,n.title,n.message,n.is_read,n.created_at,n.reply_to_id,n.feedback_thread_id
                          FROM admin_notifications n
                          WHERE (n.user_id=? OR n.user_id IS NULL) AND n.type IN ('data_transfer','feedback_reply')
                          ORDER BY n.created_at DESC,n.id DESC LIMIT 100");
        $q->execute([(int)$u['id']]); return $q->fetchAll();
    }catch(Throwable $e){return [];}
}
function page_header(string $title,string $section=''): void {
$u=current_user();
$adminNotifications = (($u['role'] ?? '') === 'Administrator') ? admin_feedback_notifications() : [];
$staffNotifications = (($u['role'] ?? '') === 'Staff') ? staff_transfer_notifications() : [];
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=e($title)?> — Great Solomon Manpower Services Inc.</title><link rel="stylesheet" href="<?=e(url('/style.css'))?>"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Public+Sans:wght@400;500;600;700&family=Material+Symbols+Outlined:FILL@0..1&display=swap" rel="stylesheet"></head><body><div id="sidebar-backdrop"></div><aside id="sidebar" class="gw-sidebar"><div class="gw-brand"><div class="brand-logo-white sidebar-logo-wrap"><img src="<?=e(url('/assets/logo2.svg'))?>" alt="Great Solomon Manpower Services Inc. logo" class="brand-logo-image"></div><div class="gw-brand-copy"><div class="gw-brand-title">Great Solomon Manpower Services Inc.</div><div class="gw-brand-subtitle">Governance &amp; Safety</div></div></div><div class="gw-sidebar-section">CORE TRANSACTION 4</div><div style="margin:0 20px 12px;height:1px;background:rgba(255,255,255,.12)"></div><nav class="gw-nav"><a class="module-link" href="<?=e(url('/dashboard.php'))?>"><button class="<?= $section==='dashboard'?'active':'' ?>"><span class="material-symbols-outlined">dashboard</span><span>Reports, Analysis &amp; Dashboard</span></button></a><a class="module-link" href="<?=e(url('/ai_assistant.php'))?>"><button class="<?= $section==='ai'?'active':'' ?>"><span class="material-symbols-outlined">auto_awesome</span><span>AI System Assistant</span><span class="nav-number">AI</span></button></a><a class="module-link" href="<?=e(url('/modules/health_safety/index.php'))?>"><button class="<?= $section==='health'?'active':'' ?>"><span class="material-symbols-outlined">health_and_safety</span><span>Health, Safety &amp; Welfare</span><span class="nav-number">1</span></button></a><a class="module-link" href="<?=e(url('/modules/legal_compliance/index.php'))?>"><button class="<?= $section==='legal'?'active':'' ?>"><span class="material-symbols-outlined">gavel</span><span>Legal &amp; Compliance</span><span class="nav-number">2</span></button></a><?php if (($u['role'] ?? '') === 'Administrator'): ?><a class="module-link" href="<?=e(url('/modules/system_admin_security/index.php'))?>"><button class="<?= $section==='security'?'active':'' ?>"><span class="material-symbols-outlined">admin_panel_settings</span><span>System Administration &amp; Security</span><span class="nav-number">3</span></button></a><?php endif; ?><a class="module-link" href="<?=e(url('/modules/asset_equipment/index.php'))?>"><button class="<?= $section==='assets'?'active':'' ?>"><span class="material-symbols-outlined">inventory_2</span><span>Asset &amp; Equipment Issuance</span><span class="nav-number">4</span></button></a></nav><div class="gw-sidebar-footer"><div class="gw-status-dot"></div><div><strong>Welcome back, <?=e($u['name']??'User')?></strong><span><?=e($u['role']??'Staff')?></span></div></div></aside><div class="gw-shell"><header class="gw-topbar"><div class="gw-topbar-left"><button id="sidebarToggle" class="icon-btn" title="Toggle sidebar"><span class="material-symbols-outlined">menu_open</span></button><div class="gw-topbar-title"><span class="eyebrow">SERVICE MANAGEMENT &amp; ENTERPRISE RESOURCE SYSTEM</span><strong><?=e($title)?></strong></div></div><div class="gw-user user-menu-wrap">
<?php $topNotificationCount=unread_notification_count(); ?>
<button type="button" class="gw-notification-trigger" onclick="showNotificationModal()" aria-label="Open notifications" title="Notifications">
<span class="material-symbols-outlined">notifications</span><?php if($topNotificationCount>0): ?><span class="top-notification-badge"><?=e($topNotificationCount>99?'99+':$topNotificationCount)?></span><?php endif; ?>
</button>
<button type="button" class="gw-user-button" onclick="toggleUserMenu()" aria-expanded="false">
<div class="gw-avatar"><?=e(strtoupper(substr((string)($u['name']??'AU'),0,2)))?></div>
<div class="gw-user-copy"><strong><?=e($u['name']??'Admin User')?></strong><span><?=e($u['role']??'Administrator')?></span></div>
<span class="material-symbols-outlined user-chevron">expand_more</span>
</button>
<div id="userMenu" class="user-dropdown">
<button type="button" onclick="showDataStorageModal()"><span class="material-symbols-outlined">folder_data</span>Data Storage</button><button type="button" onclick="showArchiveModal()"><span class="material-symbols-outlined">archive</span>Archive</button>
<?php if (($u['role'] ?? '') === 'Staff'): ?><button type="button" onclick="showFeedbackModal()"><span class="material-symbols-outlined">feedback</span>Feedback</button><?php endif; ?>
<button type="button" onclick="showTermsModal()"><span class="material-symbols-outlined">gavel</span>Terms and Conditions</button>
<button type="button" onclick="showLogoutModal()"><span class="material-symbols-outlined">logout</span>Logout</button>
</div>
</div></header><main class="gw-main"><div class="page-shell">
<?php }
function page_footer(): void { $u=current_user() ?: []; $feedbackSent=!empty($_SESSION['feedback_sent']); unset($_SESSION['feedback_sent']); $path=(string)($_SERVER['SCRIPT_NAME']??''); $showModuleTop=str_contains($path,'/modules/health_safety/') || str_contains($path,'/modules/legal_compliance/') || str_contains($path,'/modules/system_admin_security/') || str_contains($path,'/modules/asset_equipment/'); echo '</div></main></div>'.($showModuleTop ? '<button id="moduleTopButton" class="module-top-button" type="button" aria-label="Go to top" title="Go to top"><span class="material-symbols-outlined">arrow_upward</span></button>' : '').'<div id="modalRoot"></div><script>window.APP_BASE='.json_encode(base_url()).';window.CSRF_TOKEN='.json_encode(csrf_token()).';window.CURRENT_USER='.json_encode(["id"=>(int)($u["id"]??0),"name"=>(string)($u["name"]??"User"),"role"=>(string)($u["role"]??"Staff")],JSON_UNESCAPED_SLASHES).';window.ADMIN_NOTIFICATIONS='.json_encode((($u["role"]??"") === "Administrator") ? admin_feedback_notifications() : [],JSON_UNESCAPED_SLASHES).';window.STAFF_NOTIFICATIONS='.json_encode((($u["role"]??"") === "Staff") ? staff_transfer_notifications() : [],JSON_UNESCAPED_SLASHES).';window.FEEDBACK_THREADS='.json_encode((($u["role"]??"") === "Administrator") ? feedback_threads_for_user(true) : feedback_threads_for_user(false),JSON_UNESCAPED_SLASHES).';window.FEEDBACK_SENT='.json_encode($feedbackSent).';window.CURRENT_PATH='.json_encode($_SERVER['REQUEST_URI']??'').';</script><script src="'.e(url('/app.js')).'"></script></body></html>'; }
function module_card(string $href,string $icon,string $title,string $desc): void { echo '<a class="module-link" href="'.e($href).'"><div class="gw-sub-card"><div class="mini-icon"><span class="material-symbols-outlined">'.e($icon).'</span></div><strong>'.e($title).'</strong><span>'.e($desc).'</span><span class="arrow"><span class="material-symbols-outlined">arrow_forward</span></span></div></a>'; }
