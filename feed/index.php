<?php
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);
@session_start();

if (!isset($array_url[1]) && !isset($chain)) {
    require_once $_SERVER['DOCUMENT_ROOT'] . '/urls.php';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/params.php';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/header.php';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/menu.php';
    echo '<main class="content">
<h2>Введите логин и выберите блокчейн, чтобы увидеть ленту подписок пользователя</h2>';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/form_with_select.php';
    echo '</main>';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/footer.php';
} else if (!isset($chain)) {
    echo '<h2>Введите логин и выберите блокчейн, чтобы увидеть ленту подписок пользователя</h2>';
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/form_with_select.php';
} else if (isset($array_url[1])) { // проверяем существование элемента
    $array_url[1] = str_replace('@', '', $array_url[1]);

	require_once 'list.php';
}