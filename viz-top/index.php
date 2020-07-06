<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/params.php';
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
if (!isset($array_url[1])) {
    require_once $_SERVER['DOCUMENT_ROOT'].'/viz-top/main.php';
} else {
    require_once $_SERVER['DOCUMENT_ROOT'].'/viz-top/top.php';
}
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
?>