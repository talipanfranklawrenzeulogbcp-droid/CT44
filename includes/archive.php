<?php
require_once __DIR__.'/helpers.php';
require_login();
$action=(string)($_POST['action'] ?? $_GET['action'] ?? 'list');
$u=current_user(); $isAdmin=(($u['role']??'')==='Administrator');
if ($_SERVER['REQUEST_METHOD']==='POST') verify_csrf();

if($action==='list'){
    header('Content-Type: application/json; charset=utf-8');
    $type=trim((string)($_GET['type']??''));
    $allowed=['feedback','file','record','']; if(!in_array($type,$allowed,true))$type='';
    $sql="SELECT id,item_type,item_name,source_table,source_id,deleted_at FROM archive_items".($type!==''?" WHERE item_type=?":'')." ORDER BY deleted_at DESC LIMIT 500";
    $q=$type!==''?db()->prepare($sql):db()->query($sql); if($type!=='')$q->execute([$type]); $rows=$q->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['ok'=>true,'items'=>$rows],JSON_UNESCAPED_UNICODE);
    exit;
}

if($action==='backup'){
    if(!$isAdmin){ http_response_code(403); exit('Administrator access required.'); }
    $type=trim((string)($_GET['type']??'all')); $allowed=['feedback','file','record','all']; if(!in_array($type,$allowed,true))$type='all';
    $sql="SELECT * FROM archive_items".($type!=='all'?" WHERE item_type=?":'')." ORDER BY deleted_at DESC,id DESC";
    $q=$type!=='all'?db()->prepare($sql):db()->query($sql); if($type!=='all')$q->execute([$type]);
    $items=$q->fetchAll(PDO::FETCH_ASSOC);
    $backup=['format'=>'CT4 Archive Backup','version'=>1,'created_at'=>date('c'),'category'=>$type,'items'=>$items];
    header('Content-Type: application/json; charset=utf-8'); header('Content-Disposition: attachment; filename="ct4-archive-backup-'.date('Ymd-His').'.json"');
    echo json_encode($backup,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit;
}

if($_SERVER['REQUEST_METHOD']==='POST' && $action==='recover'){
    $id=(int)($_POST['id']??0);
    $st=db()->prepare('SELECT * FROM archive_items WHERE id=?');
    $st->execute([$id]);
    $a=$st->fetch(PDO::FETCH_ASSOC);
    if(!$a){
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'error'=>'Archived item not found.']);
        exit;
    }
    try{
        if($a['item_type']==='feedback'){
            $p=json_decode((string)$a['payload'],true)?:[]; $thread=$p['thread']??null; $messages=$p['messages']??[]; $notifications=$p['notifications']??[];
            if(!$thread) throw new RuntimeException('Feedback archive payload is invalid.');
            $pdo=db(); $pdo->beginTransaction();
            unset($thread['id']); $thread['legacy_notification_id']=null;
            $cols=array_keys($thread); $marks=implode(',',array_fill(0,count($cols),'?')); $pdo->prepare('INSERT INTO feedback_threads (`'.implode('`,`',$cols).'`) VALUES ('.$marks.')')->execute(array_values($thread));
            $newId=(int)$pdo->lastInsertId(); $restoredNotificationId=null;
            foreach($messages as $m){unset($m['id']);$m['thread_id']=$newId;$cols=array_keys($m);$marks=implode(',',array_fill(0,count($cols),'?'));$pdo->prepare('INSERT INTO feedback_messages (`'.implode('`,`',$cols).'`) VALUES ('.$marks.')')->execute(array_values($m));}
            foreach($notifications as $n){unset($n['id']);$n['feedback_thread_id']=$newId;$cols=array_keys($n);$marks=implode(',',array_fill(0,count($cols),'?'));try{$pdo->prepare('INSERT INTO admin_notifications (`'.implode('`,`',$cols).'`) VALUES ('.$marks.')')->execute(array_values($n));$restoredNotificationId=(int)$pdo->lastInsertId();}catch(Throwable $ignore){}}
            if($restoredNotificationId){$pdo->prepare('UPDATE feedback_threads SET legacy_notification_id=? WHERE id=?')->execute([$restoredNotificationId,$newId]);}
            $pdo->commit();
        } elseif($a['item_type']==='file'){
            $p=json_decode((string)$a['payload'],true)?:[];
            $userId=(int)(current_user()['id'] ?? $a['deleted_by'] ?? 0);
            if(($a['source_table']??'')==='employee_documents'){
                $p['file_data']=(string)($a['file_data'] ?? '');
                $p['file_type']=(string)($a['file_type'] ?: ($p['file_type'] ?? 'application/octet-stream'));
                $p['file_size']=(int)strlen($p['file_data']);
                $p['uploaded_by']=$userId ?: ($p['uploaded_by'] ?? null);
                $cols=array_keys($p);$marks=implode(',',array_fill(0,count($cols),'?'));
                db()->prepare('INSERT INTO employee_documents (`'.implode('`,`',$cols).'`) VALUES ('.$marks.')')->execute(array_values($p));
            } else {
                $svc=service('storage');
                $svc->save((string)$a['item_name'],(string)($a['file_type'] ?: 'application/octet-stream'),(string)($p['source_branch'] ?? 'Archived Recovery'),$userId,(string)($a['file_data'] ?? ''));
            }
        } else {
            $allowed=[
                'safety_incidents',
                'compliance_obligations',
                'compliance_audits',
                'health_records',
                'assets',
                'asset_issuances',
                'issuance_records',
                'maintenance_records',
                'security_events'
            ];
            $table = (string)$a['source_table'];
            if($table === 'issuance_records') $table = 'asset_issuances';
            if(!in_array($table,$allowed,true)) throw new RuntimeException('This record type cannot be recovered automatically.');
            $row=json_decode((string)$a['payload'],true);
            if(!is_array($row)) throw new RuntimeException('Archived record data is invalid.');
            unset($row['id']);
            $cols=array_keys($row);
            $marks=implode(',',array_fill(0,count($cols),'?'));
            $sql='INSERT INTO `'.$table.'` (`'.implode('`,`',$cols).'`) VALUES ('.$marks.')';
            db()->prepare($sql)->execute(array_values($row));
        }
        db()->prepare('DELETE FROM archive_items WHERE id=?')->execute([$id]);
        audit('Archive','Recover',(string)$a['item_name']);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>true]);
        exit;
    }catch(Throwable $e){
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
        exit;
    }
}

if($_SERVER['REQUEST_METHOD']==='POST' && ($action==='delete' || $action==='purge')){
    require_admin();
    $id=(int)($_POST['id']??0);
    $st=db()->prepare('SELECT item_name FROM archive_items WHERE id=?');
    $st->execute([$id]);
    $name=$st->fetchColumn() ?: ('Item #'.$id);
    db()->prepare('DELETE FROM archive_items WHERE id=?')->execute([$id]);
    audit('Archive','Permanent Delete',(string)$name);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok'=>true]);
    exit;
}

http_response_code(400);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok'=>false,'error'=>'Invalid request.']);
