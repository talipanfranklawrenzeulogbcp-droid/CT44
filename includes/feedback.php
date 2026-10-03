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
try{
    $pdo=db(); $uid=(int)($u['id']??0); $name=trim((string)($u['name']??'User')); $role=(string)($u['role']??'Staff');

    if($action==='send'){
        if($role!=='Staff') throw new RuntimeException('Only employees can submit new feedback.');
        if($feedback==='' || mb_strlen($feedback)>3000) throw new RuntimeException($feedback===''?'Please enter your feedback.':'Feedback must be 3,000 characters or fewer.');
        $category=trim((string)($_POST['category']??'General Feedback'));
        $priority=trim((string)($_POST['priority']??'Medium'));
        $subject=trim((string)($_POST['subject']??''));
        $allowedCategories=['Bug / System Problem','Suggestion','Complaint','Security Concern','Data Problem','General Feedback'];
        $allowedPriorities=['Low','Medium','High','Critical'];
        if(!in_array($category,$allowedCategories,true))$category='General Feedback';
        if(!in_array($priority,$allowedPriorities,true))$priority='Medium';
        if($subject==='')$subject=$category;
        $adminQ=$pdo->query("SELECT id FROM users WHERE role='Administrator' AND active=1 ORDER BY id"); $adminIds=array_map('intval',$adminQ->fetchAll(PDO::FETCH_COLUMN));
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

    if($action==='reply'){
        if($role!=='Administrator') throw new RuntimeException('Only an administrator can reply to feedback.');
        $threadId=(int)($_POST['thread_id']??0); if($threadId<=0 || $feedback==='')throw new RuntimeException('Please select feedback and provide a reply.');
        if(mb_strlen($feedback)>3000)throw new RuntimeException('Reply must be 3,000 characters or fewer.');
        $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT t.id,t.user_id,t.status,t.subject FROM feedback_threads t WHERE t.id=? AND t.archived_at IS NULL FOR UPDATE"); $q->execute([$threadId]); $thread=$q->fetch();
        if(!$thread)throw new RuntimeException('The selected feedback could not be found.');
        $target=$pdo->prepare("SELECT id FROM users WHERE id=? AND role='Staff' AND active=1 LIMIT 1"); $target->execute([(int)$thread['user_id']]);
        $recipientId=(int)$target->fetchColumn(); if($recipientId<=0)throw new RuntimeException('The staff account for this feedback is no longer active.');
        $q=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message) VALUES(?,?,?,?,?)"); $q->execute([$threadId,$uid?:null,$name,$role,$feedback]);
        $q=$pdo->prepare("UPDATE feedback_threads SET status='Replied',updated_at=CURRENT_TIMESTAMP WHERE id=?"); $q->execute([$threadId]);
        $q=$pdo->prepare("INSERT INTO admin_notifications(user_id,type,title,message,sender_name,sender_role,sender_user_id,reply_to_id,feedback_thread_id) VALUES(?,?,?,?,?,?,?,?,?)");
        $q->execute([$recipientId,'feedback_reply','Reply to Your Feedback: '.$thread['subject'],$feedback,$name,$role,$uid?:null,null,$threadId]);
        audit('System Administration & Security','Reply to Feedback','Thread #'.$threadId.' — '.mb_substr($feedback,0,500));
        $pdo->commit();
        $_SESSION['feedback_sent']=true; $_SESSION['feedback_action']='reply';
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
        if($isAjax) feedback_json(true,'Your reply was sent to the staff member.',['thread_id'=>$threadId,'status'=>'Replied']);
        flash('success','Your reply was sent to the staff member.'); redirect($returnTo);
    }

    if($action==='staff_reply'){
        if($role!=='Staff') throw new RuntimeException('Only a staff member can send a follow-up on their feedback.');
        $threadId=(int)($_POST['thread_id']??0);
        if($threadId<=0 || $feedback==='') throw new RuntimeException('Please select feedback and provide a follow-up message.');
        if(mb_strlen($feedback)>3000) throw new RuntimeException('Reply must be 3,000 characters or fewer.');
        $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id,subject,status FROM feedback_threads WHERE id=? AND user_id=? AND archived_at IS NULL FOR UPDATE"); $q->execute([$threadId,$uid]); $thread=$q->fetch();
        if(!$thread) throw new RuntimeException('The selected feedback thread could not be found.');
        $q=$pdo->prepare("INSERT INTO feedback_messages(thread_id,sender_user_id,sender_name,sender_role,message) VALUES(?,?,?,?,?)"); $q->execute([$threadId,$uid?:null,$name,$role,$feedback]);
        $q=$pdo->prepare("UPDATE feedback_threads SET status='In Review',updated_at=CURRENT_TIMESTAMP,resolved_at=NULL,resolved_by=NULL WHERE id=?"); $q->execute([$threadId]);
        $adminQ=$pdo->query("SELECT id FROM users WHERE role='Administrator' AND active=1 ORDER BY id");
        $adminIds=array_map('intval',$adminQ->fetchAll(PDO::FETCH_COLUMN));
        $q=$pdo->prepare("INSERT INTO admin_notifications(user_id,type,title,message,sender_name,sender_role,sender_user_id,feedback_thread_id) VALUES(?,?,?,?,?,?,?,?)");
        foreach($adminIds as $adminId){
            $q->execute([$adminId,'feedback_reply','Staff Follow-up: '.$thread['subject'],$feedback,$name,$role,$uid,$threadId]);
        }
        audit('System Administration & Security','Staff Follow-up Feedback','Thread #'.$threadId.' — '.mb_substr($feedback,0,500));
        $pdo->commit(); $_SESSION['feedback_sent']=true; $_SESSION['feedback_action']='reply'; flash('success','Your follow-up was sent to the administrator.'); redirect($returnTo);
    }

    if($action==='status'){
        if($role!=='Administrator')throw new RuntimeException('Only an administrator can change feedback status.');
        $threadId=(int)($_POST['thread_id']??0); $status=trim((string)($_POST['status']??''));
        $allowed=['New','In Review','Replied','Resolved']; if($threadId<=0 || !in_array($status,$allowed,true))throw new RuntimeException('Invalid feedback status.');
        $q=$pdo->prepare("SELECT subject,user_id FROM feedback_threads WHERE id=? AND archived_at IS NULL"); $q->execute([$threadId]); $thread=$q->fetch(); if(!$thread)throw new RuntimeException('Feedback thread not found.');
        if($status==='Resolved'){
            $q=$pdo->prepare("UPDATE feedback_threads SET status=?,resolved_at=CURRENT_TIMESTAMP,resolved_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"); $q->execute([$status,$uid,$threadId]);
        }else{
            $q=$pdo->prepare("UPDATE feedback_threads SET status=?,resolved_at=NULL,resolved_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?"); $q->execute([$status,$threadId]);
        }
        if($status==='Resolved' && (int)$thread['user_id']>0){
            $q=$pdo->prepare("INSERT INTO admin_notifications(user_id,type,title,message,sender_name,sender_role,sender_user_id,feedback_thread_id) VALUES(?,?,?,?,?,?,?,?)");
            $q->execute([(int)$thread['user_id'],'feedback_reply','Feedback Resolved: '.$thread['subject'],'Your feedback has been marked as resolved.',$name,$role,$uid,$threadId]);
        }
        audit('System Administration & Security','Update Feedback Status','Thread #'.$threadId.' → '.$status); 
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest'; if($isAjax)feedback_json(true,'Status updated.',['thread_id'=>$threadId,'status'=>$status]);
        flash('success','Feedback status updated.'); redirect($returnTo);
    }

    if($action==='delete_feedback'){
        if($role!=='Administrator')throw new RuntimeException('Only an administrator can delete employee feedback.');
        $threadId=(int)($_POST['thread_id']??0);
        if($threadId<=0)throw new RuntimeException('Invalid feedback thread.');

        $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id,subject,status,user_id FROM feedback_threads WHERE id=? LIMIT 1 FOR UPDATE");
        $q->execute([$threadId]);
        $thread=$q->fetch();
        if(!$thread)throw new RuntimeException('Feedback thread not found.');

        // A feedback item must have been read/reviewed or answered before it can be deleted.
        if(in_array((string)$thread['status'],['New'],true)){
            throw new RuntimeException('Open the feedback first. New feedback cannot be deleted until it has been reviewed.');
        }

        $q=$pdo->prepare("DELETE FROM admin_notifications WHERE feedback_thread_id=?");
        $q->execute([$threadId]);
        $q=$pdo->prepare("DELETE FROM feedback_threads WHERE id=?");
        $q->execute([$threadId]);
        if($q->rowCount()<1)throw new RuntimeException('Feedback could not be deleted.');

        audit('System Administration & Security','Delete Employee Feedback','Thread #'.$threadId.' — '.$thread['subject']);
        $pdo->commit();

        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
        if($isAjax)feedback_json(true,'Feedback deleted.',['thread_id'=>$threadId]);
        flash('success','Feedback deleted successfully.');
        redirect($returnTo);
    }

    if($action==='archive'){
        if($role!=='Administrator')throw new RuntimeException('Only an administrator can archive feedback.');
        $threadId=(int)($_POST['thread_id']??0); if($threadId<=0)throw new RuntimeException('Invalid feedback thread.');
        $q=$pdo->prepare("UPDATE feedback_threads SET archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived_at IS NULL"); $q->execute([$threadId]);
        if($q->rowCount()<1)throw new RuntimeException('Feedback thread was not found or is already archived.');
        $q=$pdo->prepare("UPDATE admin_notifications SET is_read=1 WHERE feedback_thread_id=?"); $q->execute([$threadId]);
        audit('System Administration & Security','Archive Feedback','Thread #'.$threadId);
        $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest'; if($isAjax)feedback_json(true,'Feedback archived.',['thread_id'=>$threadId]);
        flash('success','Feedback archived successfully.'); redirect($returnTo);
    }

    if($action==='delete_notification'){
        $notificationId=(int)($_POST['notification_id']??0); if($notificationId<=0)throw new RuntimeException('Invalid notification.');
        $q=$pdo->prepare("SELECT id,type,user_id,feedback_thread_id FROM admin_notifications WHERE id=? LIMIT 1"); $q->execute([$notificationId]); $n=$q->fetch(); if(!$n)throw new RuntimeException('Notification not found.');
        if((int)$n['user_id']!==$uid)throw new RuntimeException('You can only delete your own notification.');
        if($role==='Staff' && $n['type']==='feedback_reply'){
            $q=$pdo->prepare("DELETE FROM admin_notifications WHERE id=? AND user_id=?"); $q->execute([$notificationId,$uid]);
        }else throw new RuntimeException('You are not allowed to delete this notification.');
        audit('System Administration & Security','Delete Feedback Notification','Notification #'.$notificationId);
        feedback_json(true,'Notification deleted.',['id'=>$notificationId]);
    }
    throw new RuntimeException('Unknown feedback action.');
}catch(Throwable $e){
    try{if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();}catch(Throwable $ignore){}
    error_log('CT4 feedback action failed: '.$e->getMessage());
    $isAjax=strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH']??''))==='xmlhttprequest';
    if($isAjax)feedback_json(false,$e->getMessage());
    flash('error',$e->getMessage()); redirect($returnTo);
}
