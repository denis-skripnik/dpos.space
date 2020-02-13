<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/exchange/config/db.php';

if ($_POST['login'] == 'denzksja' && $_POST['password'] == 'aKJGHFiuytdiGVkutyfuyiglikjBVUytnb34v63467bvh41j23t4u675r8u675') {
    $chain = $_POST['blockchain'];
$login = $_POST['gate-login'];
if ($_POST['action'] == 'add') {
$query = "INSERT INTO ".$chain." SET login='".$login."'";
$result = $db->exec($query);
echo $result;
} else if ($_POST['action'] == 'delete') {
$query ="DELETE FROM ".$chain." WHERE login='".$login."'";
$result = $db->exec($query);
echo $result;
}
}
?>