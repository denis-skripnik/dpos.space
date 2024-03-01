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
        if (strstr($error['message'], "file_get_contents") === false && strstr($error['message'], "backend.dpos.space") === false && strstr($error['message'], "178.20.43.121") === false && strstr($error['message'], "Request Timeout") === false && strstr($error['message'], "answer code is '530' and response") === false) return;
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
        $request_uri = (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '');
        if (strpos($request_uri, "0function.array-intersect0") !== false) return;
        $message = "Page: https://dpos.space".$request_uri."
        $errors";
        if (strpos($message, "dpos.space/viz/projects") !== false || strpos($request_uri, "/sp") !== false) {
            $message .= "Referer: ".$_SERVER['HTTP_REFERER']."
";
        }
        
        // Отправка письма
        mail('scadens@yandex.ru', $subject, $message, $headers);
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
    if (strstr($message, "file_get_contents") === false || strstr($message, "backend.dpos.space") !== false || strstr($message, "178.20.43.121") !== false || strstr($message, "Request Timeout") === false) {
        $errors .= "
        <h2>$type, подробности: $message</h2>
        <strong>File</strong>: $file:$line</p>
        <p><strong>Context</strong>: $". join(', $', 
            array_keys($context))."</p>";
        }
    // сообщаем, что мы обработали ошибку, и дальнейшая обработка не требуется
    return true;
}

// регистрируем наш обработчик, он будет срабатывать на для всех типов ошибок
set_error_handler('myHandler', E_ALL);
register_shutdown_function('sendErrors');

require_once 'functions.php';
if (isset(pageUrl()[1]) && pageUrl()[1] === 'api' && isset(pageUrl()[2])) {
    if (!isset($_GET)) {
        $api_file = __DIR__.'/blockchains/'.pageUrl()[0].'/apps/api/pages/'.pageUrl()[2].'.php';
    } else {
        $page = explode('?', pageUrl()[2])[0];
        $api_file = __DIR__.'/blockchains/'.pageUrl()[0].'/apps/api/pages/'.$page.'.php';
    }

    if (file_exists($api_file)) {
        require_once($api_file);
    return;
    } else {
        $data = get404Page();
    }
}

$conf = configs("config.json");

function flattenArray($arr) {
    $result = array();
    foreach ($arr as $key => $value) {
        if (is_array($value)) {
            $result = array_merge($result, flattenArray($value));
        } else {
            $result[$key] = trim($value);
        }
    }
    return $result;
}

if (!empty($_POST)) {
    $filtered_post = filter_input_array(INPUT_POST, FILTER_SANITIZE_STRING, FILTER_REQUIRE_ARRAY);
    $_POST = flattenArray($filtered_post);   
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
$data = get404Page();
require_once 'template/main.php';
}
?>