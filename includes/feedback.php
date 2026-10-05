<?php
declare(strict_types=1);
require_once __DIR__.'/helpers.php';
require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') redirect('/dashboard.php');
verify_csrf();

$u=current_user();
$action=(string)($_POST['action']??'send');
$returnTo=trim((string)($_POST['return_to']??''));
if($returnTo==='' || !str_starts_with($returnTo,'/') || str_starts_with($returnTo,'//')) $returnTo='/dashboard.php';

function feedback_json(bool $ok,string $message='',array $extra=[]): never {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['ok'=>$ok],$message!==''?['message'=>$message]:[],$extra),JSON_UNESCAPED_SLASHES);
    exit;
}
function materialize_legacy_feedback(PDO $pdo,int $legacyId): int {
    if($legacyId<=0) throw new RuntimeException('Invalid feedback record.');
    $q=$pdo->prepare("SELECT id,user_id,sender_user_id,title,message,sender_name,sender_role,created_at
                      FROM admin_notifications WHERE id=? AND type='feedback' LIMIT 1 FOR UPDATE");
    $q->execute([$legacyId]); $n=$q->fetch();
    if(!$n) throw new RuntimeException('The selected employee feedback could not be found.');
    $q=$pdo->prepare("SELECT id FROM feedback_threads WHERE legacy_notification_id=? LIMIT 1 FOR UPDATE");
    $q->execute([$legacyId]); $existing=$q->fetchColumn();
    if($existing) return (int)$existing;
    $owner=(int)($n['sender_user_id']??0);
    $ins=$pdo->prepare("INSERT INTO feedback_threads(user_id,subject,category,priority,status,legacy_notification_id,created_at,updated_at)
                        VALUES(?,?,?,?,?,?,?,?)");
    $ins->execute([$owner?:null,trim((string)$n['title'])?:'General Feedback','General Feedback','Medium','New',$legacyId,$n['created_at'],$n['created_at']]);
    $tid=(int)$pdo->lastInsertId();
    $msg=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message,created_at)
                        VALUES(?,?,?,?,?,?)");
    $msg->execute([$tid,$owner?:null,$n['sender_name'],$n['sender_role'],$n['message'],$n['created_at']]);
    try{$pdo->prepare("UPDATE admin_notifications SET feedback_thread_id=? WHERE id=?")->execute([$tid,$legacyId]);}catch(Throwable $ignore){}
    return $tid;
}
function archive_feedback_thread(PDO $pdo,int $threadId,int $deletedBy,string $label='Employee Feedback'): int {
    $q=$pdo->prepare("SELECT * FROM feedback_threads WHERE id=? LIMIT 1 FOR UPDATE");
    $q->execute([$threadId]); $thread=$q->fetch(PDO::FETCH_ASSOC);
    if(!$thread) throw new RuntimeException('Feedback thread not found.');
    $q=$pdo->prepare("SELECT * FROM feedback_messages WHERE thread_id=? ORDER BY id ASC");
    $q->execute([$threadId]); $messages=$q->fetchAll(PDO::FETCH_ASSOC);
    $q=$pdo->prepare("SELECT * FROM admin_notifications WHERE feedback_thread_id=? OR id=? OR reply_to_id=? ORDER BY id ASC");
    $legacy=(int)($thread['legacy_notification_id']??0);
    $q->execute([$threadId,$legacy,$legacy]); $notifications=$q->fetchAll(PDO::FETCH_ASSOC);
    $payload=json_encode([
        'version'=>1,
        'category'=>'feedback',
        'thread'=>$thread,
        'messages'=>$messages,
        'notifications'=>$notifications
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if($payload===false) throw new RuntimeException('Unable to prepare feedback archive data.');
    $name=trim((string)($thread['subject']??'')) ?: 'Employee Feedback';
    $st=$pdo->prepare("INSERT INTO archive_items(item_type,source_table,source_id,item_name,payload,deleted_by)
                       VALUES('feedback','feedback_threads',?,?,?,?)");
    $st->execute([$threadId,$name,$payload,$deletedBy?:null]);
    $archiveId=(int)$pdo->lastInsertId();

    // Delete notifications first, then the thread (messages cascade).
    $pdo->prepare("DELETE FROM admin_notifications WHERE feedback_thread_id=? OR id=? OR reply_to_id=?")
        ->execute([$threadId,$legacy,$legacy]);
    $pdo->prepare("DELETE FROM feedback_threads WHERE id=?")->execute([$threadId]);
    if($pdo->rowCount()<1) throw new RuntimeException('Feedback could not be removed.');
    return $archiveId;
}
try{
    $pdo=db();
    $uid=(int)($u['id']??0);
    $name=trim((string)($u['name']??'User'));
    $role=(string)($u['role']??'Staff');

    if($action==='send'){
        if($role!=='Staff') throw new RuntimeException('Only employees can submit feedback.');
        $feedback=trim((string)($_POST['feedback']??''));
        if($feedback==='' || mb_strlen($feedback)>3000) throw new RuntimeException($feedback===''?'Please enter your feedback.':'Feedback must be 3,000 characters or fewer.');
        $category=trim((string)($_POST['category']??'General Feedback'));
        $priority=trim((string)($_POST['priority']??'Medium'));
        $subject=trim((string)($_POST['subject']??''));
        $categories=['Bug / System Problem','Suggestion','Complaint','Security Concern','Data Problem','General Feedback'];
        $priorities=['Low','Medium','High','Critical'];
        if(!in_array($category,$categories,true))$category='General Feedback';
        if(!in_array($priority,$priorities,true))$priority='Medium';
        if($subject==='')$subject=$category;

        $pdo->beginTransaction();
        $q=$pdo->prepare("INSERT INTO feedback_threads(user_id,subject,category,priority,status) VALUES(?,?,?,?,?)");
        $q->execute([$uid,$subject,$category,$priority,'New']);
        $tid=(int)$pdo->lastInsertId();
        $q=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message) VALUES(?,?,?,?,?)");
        $q->execute([$tid,$uid,$name,$role,$feedback]);

        $admins=$pdo->query("SELECT id FROM users WHERE role='Administrator' AND active=1 ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
        $q=$pdo->prepare("INSERT INTO admin_notifications(user_id,type,title,message,sender_name,sender_role,sender_user_id,feedback_thread_id)
                          VALUES(?,?,?,?,?,?,?,?)");
        $firstNotice=null;
        foreach($admins as $adminId){
            $q->execute([(int)$adminId,'feedback','New Employee Feedback: '.$subject,$feedback,$name,$role,$uid,$tid]);
            if($firstNotice===null)$firstNotice=(int)$pdo->lastInsertId();
        }
        if($firstNotice) $pdo->prepare("UPDATE feedback_threads SET legacy_notification_id=? WHERE id=?")->execute([$firstNotice,$tid]);
        audit('System Administration & Security','Submit Feedback',$subject.' — '.$name);
        $pdo->commit();
        $_SESSION['feedback_sent']=true; $_SESSION['feedback_action']='send';
        flash('success','Your feedback was sent to the administrator.');
        redirect($returnTo);
    }

    // Reply/follow-up is intentionally disabled. Historical reply records remain
    // in the database for audit/archive purposes, but no new replies can be sent.
    if($action==='reply' || $action==='staff_reply' || $action==='status' || $action==='archive'){
        throw new RuntimeException('Feedback replies and status changes are disabled. Feedback can only be sent or unsent/deleted.');
    }

    if($action==='staff_delete' || $action==='unsend'){
        if($role!=='Staff') throw new RuntimeException('Only an employee can unsend their own feedback.');
        $threadId=(int)($_POST['thread_id']??0);
        if($threadId<0){$threadId=materialize_legacy_feedback($pdo,abs($threadId));}
        if($threadId<=0) throw new RuntimeException('Invalid feedback thread.');
        $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id,subject,user_id FROM feedback_threads
                          WHERE id=? AND user_id=? AND archived_at IS NULL LIMIT 1 FOR UPDATE");
        $q->execute([$threadId,$uid]); $thread=$q->fetch();
        if(!$thread) throw new RuntimeException('The selected feedback does not belong to your account or no longer exists.');
        $archiveId=archive_feedback_thread($pdo,$threadId,$uid,'Employee Feedback');
        audit('System Administration & Security','Unsend Feedback','Thread #'.$threadId.' archived as #'.$archiveId);
        $pdo->commit();
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
        if($isAjax)feedback_json(true,'Feedback unsent and moved to the archive.',['thread_id'=>$threadId,'archive_id'=>$archiveId]);
        flash('success','Feedback unsent and moved to the archive.');
        redirect($returnTo);
    }

    if($action==='delete_feedback'){
        if($role!=='Administrator') throw new RuntimeException('Only an administrator can delete employee feedback.');
        $threadId=(int)($_POST['thread_id']??0);
        if($threadId<0)$threadId=materialize_legacy_feedback($pdo,abs($threadId));
        if($threadId<=0) throw new RuntimeException('Invalid feedback thread.');
        $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id,subject FROM feedback_threads WHERE id=? AND archived_at IS NULL LIMIT 1 FOR UPDATE");
        $q->execute([$threadId]); $thread=$q->fetch();
        if(!$thread) throw new RuntimeException('Feedback thread not found.');
        $archiveId=archive_feedback_thread($pdo,$threadId,$uid,'Employee Feedback');
        audit('System Administration & Security','Delete Employee Feedback','Thread #'.$threadId.' archived as #'.$archiveId);
        $pdo->commit();
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
        if($isAjax)feedback_json(true,'Feedback deleted and moved to the archive.',['thread_id'=>$threadId,'archive_id'=>$archiveId]);
        flash('success','Feedback deleted and moved to the archive.');
        redirect($returnTo);
    }

    throw new RuntimeException('Unknown feedback action.');
}catch(Throwable $e){
    try{if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();}catch(Throwable $ignore){}
    error_log('CT4 feedback action failed: '.$e->getMessage());
    $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
    if($isAjax)feedback_json(false,$e->getMessage());
    flash('error',$e->getMessage()); redirect($returnTo);
}
