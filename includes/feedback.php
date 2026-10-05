<?php
declare(strict_types=1);
require_once __DIR__.'/helpers.php';
require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') redirect('/dashboard.php');
verify_csrf();
$u=current_user();
$action=(string)($_POST['action']??'send');
$feedback=trim((string)($_POST['feedback']??''));
$returnTo=trim((string)($_POST['return_to']??''));
if($returnTo==='' || !str_starts_with($returnTo,'/') || str_starts_with($returnTo,'//')) $returnTo='/dashboard.php';
function feedback_json(bool $ok,string $message='',array $extra=[]): never {
    header('Content-Type: application/json; charset=utf-8'); echo json_encode(array_merge(['ok'=>$ok],$message!==''?['message'=>$message]:[],$extra)); exit;
}
function materialize_legacy_feedback(PDO $pdo,int $legacyId): int {
    if($legacyId<=0) throw new RuntimeException('Invalid legacy feedback record.');
    $q=$pdo->prepare("SELECT id,user_id,sender_user_id,title,message,sender_name,sender_role,created_at FROM admin_notifications WHERE id=? AND type='feedback' LIMIT 1 FOR UPDATE");
    $q->execute([$legacyId]); $legacy=$q->fetch();
    if(!$legacy) throw new RuntimeException('The selected employee feedback could not be found.');
    $q=$pdo->prepare("SELECT id FROM feedback_threads WHERE legacy_notification_id=? LIMIT 1 FOR UPDATE");
    $q->execute([$legacyId]); $existing=$q->fetchColumn();
    if($existing)return (int)$existing;
    $legacyUser=(int)($legacy['sender_user_id']??0); // user_id is the admin recipient; sender_user_id is the employee owner.
    if($legacyUser<=0 && trim((string)$legacy['sender_name'])!==''){
        $find=$pdo->prepare("SELECT id FROM users WHERE name=? AND role='Staff' AND active=1 ORDER BY id LIMIT 2");
        $find->execute([trim((string)$legacy['sender_name'])]); $matches=$find->fetchAll(PDO::FETCH_COLUMN);
        if(count($matches)===1)$legacyUser=(int)$matches[0];
    }
    $ins=$pdo->prepare("INSERT INTO feedback_threads(user_id,subject,category,priority,status,legacy_notification_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)");
    $ins->execute([$legacyUser?:null,trim((string)$legacy['title'])?:'General Feedback','General Feedback','Medium','New',$legacyId,$legacy['created_at'],$legacy['created_at']]);
    $threadId=(int)$pdo->lastInsertId();
    $msg=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message,created_at) VALUES(?,?,?,?,?,?)");
    $msg->execute([$threadId,$legacyUser?:null,$legacy['sender_name'],$legacy['sender_role'],$legacy['message'],$legacy['created_at']]);
    try{
        $link=$pdo->prepare("UPDATE admin_notifications SET feedback_thread_id=? WHERE id=?");
        $link->execute([$threadId,$legacyId]);
    }catch(Throwable $ignore){}
    return $threadId;
}

function archive_feedback_thread(PDO $pdo,int $threadId,?array $user,string $reason='Feedback Deleted'): int {
    $q=$pdo->prepare("SELECT * FROM feedback_threads WHERE id=? LIMIT 1 FOR UPDATE");
    $q->execute([$threadId]); $thread=$q->fetch(PDO::FETCH_ASSOC);
    if(!$thread) throw new RuntimeException('The selected feedback no longer exists.');
    $m=$pdo->prepare("SELECT * FROM feedback_messages WHERE thread_id=? ORDER BY id ASC"); $m->execute([$threadId]);
    $messages=$m->fetchAll(PDO::FETCH_ASSOC);
    $n=$pdo->prepare("SELECT * FROM admin_notifications WHERE feedback_thread_id=? OR (type='feedback' AND id=?) ORDER BY id ASC");
    $legacyId=(int)($thread['legacy_notification_id']??0); $n->execute([$threadId,$legacyId]); $notifications=$n->fetchAll(PDO::FETCH_ASSOC);
    $payload=json_encode(['version'=>1,'reason'=>$reason,'thread'=>$thread,'messages'=>$messages,'notifications'=>$notifications],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $name=trim((string)($thread['subject']??'')) ?: 'Employee Feedback #'.$threadId;
    $ins=$pdo->prepare("INSERT INTO archive_items(item_type,source_table,source_id,item_name,payload,deleted_by) VALUES('feedback','feedback_threads',?,?,?,?)");
    $ins->execute([$threadId,$name,$payload,(int)($user['id']??0) ?: null]);
    $archiveId=(int)$pdo->lastInsertId();
    $pdo->prepare("DELETE FROM admin_notifications WHERE feedback_thread_id=? OR (type='feedback' AND id=? AND ? > 0)")->execute([$threadId,$legacyId,$legacyId]);
    $pdo->prepare("DELETE FROM feedback_threads WHERE id=?")->execute([$threadId]);
    return $archiveId;
}

try{
    $pdo=db(); $uid=(int)($u['id']??0); $name=trim((string)($u['name']??'User')); $role=(string)($u['role']??'Staff');

    if($action==='send'){
        if($role!=='Staff') throw new RuntimeException('Only Staff accounts can submit feedback.');
        if($feedback==='' || mb_strlen($feedback)>3000) throw new RuntimeException($feedback===''?'Please enter your feedback.':'Feedback must be 3,000 characters or fewer.');
        $category=trim((string)($_POST['category']??'General Feedback'));
        $priority=trim((string)($_POST['priority']??'Medium'));
        $subject=trim((string)($_POST['subject']??''));
        $allowedCategories=['Bug / System Problem','Suggestion','Complaint','Security Concern','Data Problem','General Feedback'];
        $allowedPriorities=['Low','Medium','High','Critical'];
        if(!in_array($category,$allowedCategories,true))$category='General Feedback';
        if(!in_array($priority,$allowedPriorities,true))$priority='Medium';
        if($subject==='')$subject=$category;
        $adminQ=$pdo->query("SELECT id FROM users WHERE role='Administrator' AND active=1 ORDER BY id"); $adminIds=array_values(array_filter(array_map('intval',$adminQ->fetchAll(PDO::FETCH_COLUMN)), static fn($id)=>(int)$id!==$uid));
        $pdo->beginTransaction();
        $q=$pdo->prepare("INSERT INTO feedback_threads(user_id,subject,category,priority,status) VALUES(?,?,?,?,?)");
        $q->execute([$uid?:null,$subject,$category,$priority,'New']); $threadId=(int)$pdo->lastInsertId();
        $q=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message) VALUES(?,?,?,?,?)");
        $q->execute([$threadId,$uid?:null,$name,$role,$feedback]);
        $q=$pdo->prepare("INSERT INTO admin_notifications(user_id,type,title,message,sender_name,sender_role,sender_user_id,feedback_thread_id) VALUES(?,?,?,?,?,?,?,?)");
        $noticeId=null;
        foreach($adminIds as $adminId){
            $q->execute([$adminId,'feedback','New Employee Feedback: '.$subject,$feedback,$name,$role,$uid?:null,$threadId]);
            if($noticeId===null) $noticeId=(int)$pdo->lastInsertId();
        }
        $q=$pdo->prepare("UPDATE feedback_threads SET legacy_notification_id=? WHERE id=?"); $q->execute([$noticeId,$threadId]);
        audit('System Administration & Security','Submit Feedback',$subject.' — '.$name.' ('.$role.')');
        $pdo->commit();
        $_SESSION['feedback_sent']=true; $_SESSION['feedback_action']='send'; flash('success','Your feedback was sent to the administrator.'); redirect($returnTo);
    }

    if($action==='unsend'){
        if($role!=='Staff') throw new RuntimeException('Only Staff accounts can unsend feedback.');
        $threadId=(int)($_POST['thread_id']??0);
        if($threadId===0) throw new RuntimeException('Invalid feedback record.');
        $pdo->beginTransaction();
        if($threadId<0){
            $legacyId=abs($threadId);
            $q=$pdo->prepare("SELECT feedback_thread_id,sender_user_id FROM admin_notifications WHERE id=? AND type='feedback' LIMIT 1 FOR UPDATE");
            $q->execute([$legacyId]); $legacy=$q->fetch();
            if(!$legacy) throw new RuntimeException('The selected feedback no longer exists.');
            if((int)($legacy['sender_user_id']??0)!==$uid) throw new RuntimeException('You can only unsend your own feedback.');
            $real=(int)($legacy['feedback_thread_id']??0);
            if($real>0) archive_feedback_thread($pdo,$real,$u,'Staff Unsend');
            else {
                $q=$pdo->prepare("SELECT * FROM admin_notifications WHERE id=? LIMIT 1 FOR UPDATE"); $q->execute([$legacyId]); $row=$q->fetch();
                $payload=json_encode(['version'=>1,'reason'=>'Staff Unsend','legacy_notification'=>$row],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
                $ins=$pdo->prepare("INSERT INTO archive_items(item_type,source_table,source_id,item_name,payload,deleted_by) VALUES('feedback','admin_notifications',?,?,?,?)");
                $ins->execute([$legacyId,'Employee Feedback #'.$legacyId,$payload,$uid]);
                $pdo->prepare("DELETE FROM admin_notifications WHERE id=?")->execute([$legacyId]);
            }
        }else{
            $q=$pdo->prepare("SELECT id,subject,user_id FROM feedback_threads WHERE id=? AND user_id=? AND archived_at IS NULL LIMIT 1 FOR UPDATE");
            $q->execute([$threadId,$uid]); $thread=$q->fetch();
            if(!$thread) throw new RuntimeException('The selected feedback does not belong to your account or no longer exists.');
            archive_feedback_thread($pdo,$threadId,$u,'Staff Unsend');
            audit('System Administration & Security','Unsend Feedback','Thread #'.$threadId.' — '.$thread['subject'].' (moved to Archive)');
        }
        $pdo->commit();
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
        if($isAjax) feedback_json(true,'Feedback unsent.',['thread_id'=>$threadId]);
        flash('success','Feedback unsent successfully.'); redirect($returnTo);
    }
    if($action==='admin_delete'){
        if($role!=='Administrator') throw new RuntimeException('Only Administrator accounts can delete employee feedback.');
        $threadId=(int)($_POST['thread_id']??0); if($threadId===0) throw new RuntimeException('Invalid feedback record.');
        $pdo->beginTransaction();
        if($threadId<0){
            $legacyId=abs($threadId); $q=$pdo->prepare("SELECT * FROM admin_notifications WHERE id=? AND type='feedback' LIMIT 1 FOR UPDATE"); $q->execute([$legacyId]); $legacy=$q->fetch();
            if(!$legacy) throw new RuntimeException('The selected employee feedback no longer exists.');
            $payload=json_encode(['version'=>1,'reason'=>'Administrator Delete','legacy_notification'=>$legacy],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            $ins=$pdo->prepare("INSERT INTO archive_items(item_type,source_table,source_id,item_name,payload,deleted_by) VALUES('feedback','admin_notifications',?,?,?,?)");
            $ins->execute([$legacyId,'Employee Feedback #'.$legacyId,$payload,$uid]);
            $pdo->prepare("DELETE FROM admin_notifications WHERE id=?")->execute([$legacyId]);
            audit('System Administration & Security','Delete Employee Feedback','Legacy feedback #'.$legacyId.' (moved to Archive)');
        }else{
            $q=$pdo->prepare("SELECT id,subject FROM feedback_threads WHERE id=? AND archived_at IS NULL LIMIT 1 FOR UPDATE"); $q->execute([$threadId]); $thread=$q->fetch();
            if(!$thread) throw new RuntimeException('The selected feedback no longer exists.');
            archive_feedback_thread($pdo,$threadId,$u,'Administrator Delete');
            audit('System Administration & Security','Delete Employee Feedback','Thread #'.$threadId.' — '.$thread['subject'].' (moved to Archive)');
        }
        $pdo->commit();
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
        if($isAjax) feedback_json(true,'Employee feedback moved to Archive.',['thread_id'=>$threadId]);
        flash('success','Employee feedback moved to Archive.'); redirect($returnTo);
    }

    throw new RuntimeException('This feedback action is not available.');
}catch(Throwable $e){
    try{if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();}catch(Throwable $ignore){}
    error_log('CT4 feedback action failed: '.$e->getMessage());
    $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
    if($isAjax)feedback_json(false,$e->getMessage());
    flash('error',$e->getMessage()); redirect($returnTo);
}
