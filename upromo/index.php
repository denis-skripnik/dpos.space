<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/params.php';
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
if (!isset($array_url[1])) {
    require_once $_SERVER['DOCUMENT_ROOT'].'/upromo/posts.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") == 'promo-codes') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/upromo/promoCodes.php';
   }
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
?>