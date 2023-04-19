<?php
  if (session_status() == PHP_SESSION_NONE) session_start();
ini_set('session.gc_maxlifetime', 12000000960);
ini_set('session.cookie_lifetime', 12000000960);
define('NOTLOAD', 1); // для защиты от прямого запуска php-файлов 
$errors = '';
function sendErrors() {
    global $errors;
    $error = error_get_last();
    if ($error['type'] === E_ERROR || $error['type'] === E_PARSE) {
        $errors .= "
<h2>Fatal Error: ".$error['message']."</h2>
        <strong>File</strong>: ".$error['file'].":".$error['line']."</p>";
    }    
    
    if (isset($errors) && $errors !== '') {
            // установка заголовка Content-type для HTML-письма
        $headers  = 'MIME-Version: 1.0' . "\r\n";
        $headers .= 'Content-type: text/html; charset=UTF-8' . "\r\n";
        
        // Дополнительные заголовки
        $headers .= 'From: webmaster@dpos.space' . "\r\n" .
        'X-Mailer: PHP/' . phpversion();
        
        // Тема письма
        $subject = 'Ошибки на странице сайта dpos.space';
        
        // Текст сообщения
        $message = "Page: https://dpos.space/".(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '')."
        $errors";
        
        // Отправка письма
        mail('webmaster@dpos.space', $subject, $message, $headers);
        }
    }

function myHandler($level, $message, $file, $line, $context) {
    global $errors;
    // в зависимости от типа ошибки формируем заголовок сообщения
    switch ($level) {
        case E_WARNING:
            $type = 'Warning';
            break;
        case E_NOTICE:
            $type = 'Notice';
            break;
        default:
        $type = $level;
    break;
    }
    // выводим текст ошибки
    
    $errors .= "
<h2>$type: $message</h2>
<strong>File</strong>: $file:$line</p>
<p><strong>Context</strong>: $". join(', $', 
    array_keys($context))."</p>";
    // сообщаем, что мы обработали ошибку, и дальнейшая обработка не требуется
    return true;
}

// регистрируем наш обработчик, он будет срабатывать на для всех типов ошибок
set_error_handler('myHandler', E_ALL);
register_shutdown_function('sendErrors');

require_once 'functions.php';
if (isset(pageUrl()[1]) && pageUrl()[1] === 'api' && isset(pageUrl()[2])) {
    if (!isset($_GET)) {
    require_once(__DIR__.'/blockchains/'.pageUrl()[0].'/apps/api/pages/'.pageUrl()[2].'.php');
} else {
    $page = explode('?', pageUrl()[2])[0];
    require_once(__DIR__.'/blockchains/'.pageUrl()[0].'/apps/api/pages/'.$page.'.php');
}
  return;
}

$conf = configs("config.json");
if (!empty($_POST)) {
$_POST = array_map('trim', $_POST);
    $post_queries = trim(implode("/", $_POST));
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
$data = get404Page();
}
?>