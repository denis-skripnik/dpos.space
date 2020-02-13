<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/params.php';
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
if (!isset($array_url[1])) {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-polls/main.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") == 'create') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-polls/create.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") == 'list') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-polls/list.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") == 'voteing') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-polls/voteing.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") == 'results') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-polls/results.php';
}
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
?>