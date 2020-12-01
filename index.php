<?php
 if (session_status() == PHP_SESSION_NONE) session_start();
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);

function myHandler($level, $message, $file, $line, $context) {
    // в зависимости от типа ошибки формируем заголовок сообщения
    switch ($level) {
        case E_WARNING:
            $type = 'Warning';
            break;
        case E_NOTICE:
            $type = 'Notice';
            break;
        default;
            // это не E_WARNING и не E_NOTICE
            // значит мы прекращаем обработку ошибки
            // далее обработка ложится на сам PHP
            return false;
    }
    // выводим текст ошибки
    echo "<h1>Ошибка</h1>
<p>Если она уже долго, просьба написать в Telegram чат <a href='https://t.me/dpos_space' target='_blank'>@dpos_space</a> адрес страницы и подробности ошибки. Благодарю.</p>
<h2>$type: $message</h2>";
    echo "<p><strong>File</strong>: $file:$line</p>";
    echo "<p><strong>Context</strong>: $". join(', $', 
    array_keys($context))."</p>";
    // сообщаем, что мы обработали ошибку, и дальнейшая обработка не требуется
    return true;
}

// регистрируем наш обработчик, он будет срабатывать на для всех типов ошибок
set_error_handler('myHandler', E_ALL);

define('NOTLOAD', 1); // для защиты от прямого запуска php-файлов 

require_once 'functions.php';
$conf = configs("config.json");
if (!empty($_POST)) {
$post_queries = implode("/", $_POST);
    header("Location: " .$conf['siteUrl'] . $post_queries);
}
$data = generatePage();

if (isset($data) && $data != '' && count($data) > 0) {
    if (isset(pageUrl()[0]) && !isset(pageUrl()[1])) to_menu(pageUrl()[0], pageUrl()[0], $data['in_menu']);
if (isset(pageUrl()[1]) && !isset(pageUrl()[2])) to_menu(pageUrl()[0], pageUrl()[1], $data['in_menu'], $data['category']);
    $data['menu'] = generateMenu();
    $data['breadCrumbs'] = generateBreadCrumbs();
    require_once 'template/main.php';
} else {
    header("HTTP/1.0 404 Not Found");
    $data = [];
    $data['menu'] = generateMenu();
    require_once 'template/404.php';
}
?>