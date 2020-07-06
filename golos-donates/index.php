<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/params.php';
 require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
if (!isset($array_url[1])) {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-donates/donators.php';
    } else if (($array_url[1] ?? $array_url[1] ?? "") == 'comments') {
        require_once $_SERVER['DOCUMENT_ROOT'].'/golos-donates/comments.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") == 'posts') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-donates/posts.php';
} else if (($array_url[1] ?? $array_url[1] ?? "") !== 'posts' && ($array_url[1] ?? $array_url[1] ?? "") !== 'comments') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-donates/donators.php';
} else if (isset($array_url[2]) && ($array_url[1] ?? $array_url[1] ?? "") === 'comments') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-donates/comments.php';
} else if (isset($array_url[2]) && ($array_url[1] ?? $array_url[1] ?? "") === 'comments') {
    require_once $_SERVER['DOCUMENT_ROOT'].'/golos-donates/posts.php';
}
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
?>