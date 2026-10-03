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
function sync_legacy_feedback_threads(): void {
    // Materialize old notification-only feedback into the conversation tables.
    // This routine deliberately works even when an older deployment has not yet
    // received the optional notification columns.
    try {
        $pdo=db();
        $legacy=$pdo->query("SELECT id,sender_name,sender_role,title,message,created_at,type,reply_to_id FROM admin_notifications WHERE type IN ('feedback','feedback_reply') ORDER BY id ASC")->fetchAll();
        if(!$legacy)return;

        $findByLegacy=$pdo->prepare("SELECT id FROM feedback_threads WHERE legacy_notification_id=? LIMIT 1");
        $findByMessage=$pdo->prepare("SELECT t.id FROM feedback_threads t JOIN feedback_messages m ON m.thread_id=t.id WHERE m.sender_role='Staff' AND m.sender_name=? AND m.message=? AND m.created_at=? ORDER BY t.id ASC LIMIT 1");
        $findUser=$pdo->prepare("SELECT id FROM users WHERE name=? AND role='Staff' AND active=1 ORDER BY id LIMIT 2");
        $insertThread=$pdo->prepare("INSERT INTO feedback_threads(user_id,subject,category,priority,status,legacy_notification_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)");
        $insertMessage=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message,created_at) VALUES(?,?,?,?,?,?)");
        $findMessage=$pdo->prepare("SELECT id FROM feedback_messages WHERE thread_id=? AND message=? AND created_at=? LIMIT 1");

        $hasThreadLink=db_column_exists($pdo,'admin_notifications','feedback_thread_id');
        $hasSenderId=db_column_exists($pdo,'admin_notifications','sender_user_id');
        foreach($legacy as $row){
            $notificationId=(int)$row['id'];
            $threadId=0;
            if($hasThreadLink){
                $q=$pdo->prepare("SELECT feedback_thread_id FROM admin_notifications WHERE id=? LIMIT 1");
                $q->execute([$notificationId]);
                $threadId=(int)($q->fetchColumn()?:0);
            }
            if(!$threadId){$findByLegacy->execute([$notificationId]);$threadId=(int)($findByLegacy->fetchColumn()?:0);}
            if(!$threadId && ($row['type']??'')==='feedback'){
                // Multiple administrators receive copies of the same notification.
                // Match the employee message so those copies become one thread.
                $findByMessage->execute([trim((string)$row['sender_name']),(string)$row['message'],$row['created_at']]);
                $threadId=(int)($findByMessage->fetchColumn()?:0);
            }
            if(!$threadId && ($row['type']??'')==='feedback'){
                $legacyUser=null;
                if($hasSenderId){
                    $q=$pdo->prepare("SELECT sender_user_id FROM admin_notifications WHERE id=? LIMIT 1");
                    $q->execute([$notificationId]); $legacyUser=(int)($q->fetchColumn()?:0) ?: null;
                }
                if(!$legacyUser && trim((string)$row['sender_name'])!==''){
                    $findUser->execute([trim((string)$row['sender_name'])]);
                    $matches=$findUser->fetchAll(PDO::FETCH_COLUMN);
                    if(count($matches)===1)$legacyUser=(int)$matches[0];
                }
                $insertThread->execute([$legacyUser,trim((string)$row['title'])?:'General Feedback','General Feedback','Medium','New',$notificationId,$row['created_at'],$row['created_at']]);
                $threadId=(int)$pdo->lastInsertId();
                $insertMessage->execute([$threadId,$legacyUser,$row['sender_name'],$row['sender_role']?:'Staff',$row['message'],$row['created_at']]);
            }
            if(!$threadId && ($row['type']??'')==='feedback_reply' && (int)($row['reply_to_id']??0)>0){
                $findByLegacy->execute([(int)$row['reply_to_id']]);
                $threadId=(int)($findByLegacy->fetchColumn()?:0);
            }
            if(!$threadId)continue;
            if($hasThreadLink){
                $link=$pdo->prepare("UPDATE admin_notifications SET feedback_thread_id=? WHERE id=? AND (feedback_thread_id IS NULL OR feedback_thread_id=0)");
                $link->execute([$threadId,$notificationId]);
            }
            if(($row['type']??'')==='feedback_reply'){
                $findMessage->execute([$threadId,$row['message'],$row['created_at']]);
                if(!$findMessage->fetchColumn()){
                    $senderId=null;
                    if($hasSenderId){$q=$pdo->prepare("SELECT sender_user_id FROM admin_notifications WHERE id=? LIMIT 1");$q->execute([$notificationId]);$senderId=(int)($q->fetchColumn()?:0)?:null;}
                    $insertMessage->execute([$threadId,$senderId,$row['sender_name'],$row['sender_role']?:'Administrator',$row['message'],$row['created_at']]);
                }
                $pdo->prepare("UPDATE feedback_threads SET status='Replied',updated_at=? WHERE id=?")->execute([$row['created_at'],$threadId]);
            }
        }
    } catch(Throwable $ignore) {
        // Do not break the dashboard. db.php retries schema provisioning on the
        // next request and this sync will then run again.
    }
}
function feedback_threads_for_user(bool $admin=false): array {
    $u=current_user();
    if (!$u) return [];
    if ($admin && ($u['role'] ?? '') !== 'Administrator') return [];
    if (!$admin && ($u['role'] ?? '') !== 'Staff') return [];

    // Primary source: the conversation tables. These contain the complete
    // thread/message history used by Reply, Delete, status changes, etc.
    try {
        sync_legacy_feedback_threads();
        $sql = "SELECT t.id,t.user_id,t.subject,t.category,t.priority,t.status,t.created_at,t.updated_at,t.resolved_at,
                       COALESCE(u.name,
                           (SELECT m0.sender_name FROM feedback_messages m0 WHERE m0.thread_id=t.id AND m0.sender_role='Staff' ORDER BY m0.id ASC LIMIT 1),
                           'Staff') AS owner_name,
                       (SELECT COUNT(*) FROM feedback_messages m WHERE m.thread_id=t.id) AS message_count,
                       (SELECT m.message FROM feedback_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                       (SELECT m.sender_name FROM feedback_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_sender_name,
                       (SELECT m.sender_role FROM feedback_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_sender_role,
                       (SELECT m.sender_user_id FROM feedback_messages m WHERE m.thread_id=t.id AND m.sender_role='Staff' ORDER BY m.id ASC LIMIT 1) AS owner_message_user_id
                FROM feedback_threads t
                LEFT JOIN users u ON u.id=t.user_id
                WHERE t.archived_at IS NULL
                " . ($admin ? "" : "AND t.user_id=?") . "
                ORDER BY t.updated_at DESC,t.id DESC LIMIT 100";
        $q=db()->prepare($sql);
        $q->execute($admin ? [] : [(int)$u['id']]);
        $threads=$q->fetchAll();
        foreach($threads as &$t){
            $mq=db()->prepare("SELECT id,thread_id,sender_user_id,sender_name,sender_role,message,created_at FROM feedback_messages WHERE thread_id=? ORDER BY id ASC");
            $mq->execute([(int)$t['id']]);
            $t['messages']=$mq->fetchAll();
        }
        unset($t);
        return $threads;
    } catch(Throwable $primaryError) {
        // Fall through to the legacy notification reader below. Older live
        // databases can have admin_notifications without the newer additive
        // columns, and those feedback records must still be visible.
    }

    if (!$admin) return [];

    // Legacy fallback: read the original employee feedback notification using
    // only columns that existed in the original schema. Do NOT reference
    // sender_user_id/feedback_thread_id here because those columns may not yet
    // exist on an older deployment.
    try {
        $pdo=db();
        $q=$pdo->query("SELECT id,user_id,type,title,message,sender_name,sender_role,is_read,created_at,reply_to_id
                        FROM admin_notifications
                        WHERE type IN ('feedback','feedback_reply')
                        ORDER BY created_at DESC,id DESC LIMIT 100");
        $rows=$q->fetchAll();
        $base=[]; $replies=[];
        foreach($rows as $row){
            if(($row['type']??'')==='feedback') $base[(int)$row['id']]=$row;
            else $replies[]=$row;
        }
        $out=[];
        foreach($base as $row){
            $messages=[[ 
                'id'=>0, 'thread_id'=>(int)$row['id'], 'sender_user_id'=>null,
                'sender_name'=>$row['sender_name'] ?: 'Employee',
                'sender_role'=>$row['sender_role'] ?: 'Staff',
                'message'=>$row['message'] ?: '', 'created_at'=>$row['created_at']
            ]];
            $lastUpdated=$row['created_at'];
            foreach($replies as $reply){
                if((int)($reply['reply_to_id']??0)!==(int)$row['id']) continue;
                $messages[]=[
                    'id'=>(int)$reply['id'], 'thread_id'=>(int)$row['id'], 'sender_user_id'=>null,
                    'sender_name'=>$reply['sender_name'] ?: 'Administrator',
                    'sender_role'=>$reply['sender_role'] ?: 'Administrator',
                    'message'=>$reply['message'] ?: '', 'created_at'=>$reply['created_at']
                ];
                $lastUpdated=$reply['created_at'];
            }
            $status=count($messages)>1 ? 'Replied' : 'New';
            $out[]=[
                'id'=>(int)$row['id'], 'user_id'=>(int)($row['user_id']??0),
                'subject'=>trim((string)($row['title']??'')) ?: 'General Feedback',
                'category'=>'General Feedback', 'priority'=>'Medium', 'status'=>$status,
                'created_at'=>$row['created_at'], 'updated_at'=>$lastUpdated,
                'resolved_at'=>null, 'owner_name'=>$row['sender_name'] ?: 'Employee',
                'message_count'=>count($messages), 'last_message'=>$messages[count($messages)-1]['message'],
                'last_sender_name'=>$messages[count($messages)-1]['sender_name'],
                'last_sender_role'=>$messages[count($messages)-1]['sender_role'],
                'owner_message_user_id'=>null, 'messages'=>$messages,
                'legacy_only'=>true
            ];
        }
        return $out;
    } catch(Throwable $legacyError) {
        return [];
    }
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
