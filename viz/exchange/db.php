<?php
require_once('config/db.php');

$query1 = "CREATE TABLE IF NOT EXISTS viz";
$result1 = $db->exec($query1);
$query2 = "CREATE TABLE IF NOT EXISTS golos";
$result2 = $db->exec($query2);
$query3 = "CREATE TABLE IF NOT EXISTS steem";
$result3 = $db->exec($query3);
$query4 = "CREATE TABLE IF NOT EXISTS whaleshares";
$result4 = $db->exec($query4);
?>