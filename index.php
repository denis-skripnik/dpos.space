<?php
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);
@session_start();

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

require_once 'urls.php';
require_once 'params.php';
require_once 'helpers.php';

 $main_filename = $_SERVER['DOCUMENT_ROOT']."/users";
$main_fp = fopen($main_filename.".log", "a");

if (($array_url[0] ?? $array_url[0] ?? "") != 'favicon.ico') {
// записываем в файл текст
fwrite($main_fp, date("d.m.Y H:i:s").":"."\r\n"."Сервис: ".($array_url[0] ?? $array_url[0] ?? "главная")."; Логин: ".($_SESSION['user_name'] ?? $_SESSION['user_name'] ?? "Нет пользователя")."; Блокчейн: ".($_SESSION['chain_name'] ?? $_SESSION['chain_name'] ?? "нет блокчейна")."\r\n"."\r\n");
}

fclose($main_fp);

noCache();

 require_once 'template/header.php';
require_once 'template/menu.php';
 require_once 'template/content.php';
require_once 'template/footer.php';
