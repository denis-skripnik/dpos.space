<?php
function fullRemove_ff($path,$t="1") {
    $rtrn="1";
    if (file_exists($path) && is_dir($path)) {
        $dirHandle = opendir($path);
        while (false !== ($file = readdir($dirHandle))) {
            if ($file!='.' && $file!='..') {
                $tmpPath=$path.'/'.$file;
                chmod($tmpPath, 0777);
                if (is_dir($tmpPath)) {
                    fullRemove_ff($tmpPath);
                } else {
                    if (file_exists($tmpPath)) {
                        unlink($tmpPath);
                    }
                }
            }
        }
        closedir($dirHandle);
        if ($t=="1") {
            if (file_exists($path)) {
                rmdir($path);
            }
        }
    } else {
        $rtrn="0";
    }
    return $rtrn;
}

fullRemove_ff($_SERVER['DOCUMENT_ROOT']."/backup/users/".$_POST['WLS_login']."/".$chain.'/',1);
?>