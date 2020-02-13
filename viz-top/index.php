<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/params.php';
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
if (!isset($array_url[1])) {
    require_once $_SERVER['DOCUMENT_ROOT'].'/viz-top/main.php';
} else if ((strtoupper($array_url[1]) ?? strtoupper($array_url[1]) ?? "") == 'VIZ') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/viz-top/viz.php';
} else if ((strtoupper($array_url[1]) ?? strtoupper($array_url[1]) ?? "") == 'SHARES') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/viz-top/shares.php';
}
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
?>