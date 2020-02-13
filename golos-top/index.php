<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/params.php';
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
if (!isset($array_url[1])) {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-top/main.php';
} else if ((strtoupper($array_url[1]) ?? strtoupper($array_url[1]) ?? "") == 'GBG') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-top/gbg.php';
} else if ((strtoupper($array_url[1]) ?? strtoupper($array_url[1]) ?? "") == 'GOLOS') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-top/golos.php';
} else if ((strtoupper($array_url[1]) ?? strtoupper($array_url[1]) ?? "") == 'GP') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-top/gp.php';
}
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
?>