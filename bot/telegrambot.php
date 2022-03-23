<?php
$admin_id = 364096327;
$api_key = '1680686586:AAEiytPYsYEhYzB_Wi8S9DNRVZBPW2gFVyk';

function botControl($text) {
    $interface = file_get_contents('interface.json');
$i = json_decode($interface, true); 
if ($text && $i[$text]) {
    $msg = $i[$text]['text'];
    $arInfo["inline_keyboard"] = $i[$text]['buttons'];
// $arInfo["keyboard"][0][0]["text"] = "Кнопка";    
return ['msg' => $msg, 'buttons' => $arInfo];
} else {
    $msg = 'Сообщение отправлено.';
    $arInfo["inline_keyboard"] = [[['callback_data' => "/start", 'text' => "Главная"]]];
return ['msg' => $msg, 'buttons' => $arInfo, 'for_admin' => true];
}
}

$body = file_get_contents('php://input'); 
$arr = json_decode($body, true); 
 
include_once ('telegramgclass.php');   

$tg = new tg($api_key);
$chat_id = $arr['message']['chat']['id'];
if (!isset($arr['callback_query'])) {
    $text = (isset($arr['message']['text']) ? $arr['message']['text'] : '');
    $data = botControl($text);
if ($data['for_admin'] && $data['for_admin'] == true && $admin_id !== $chat_id) {
    $tg->forward($admin_id, $chat_id, $arr['message']['message_id']);            
} else if ($admin_id === $chat_id && $arr['message']['reply_to_message']) {
        $tg->send($arr['message']['reply_to_message']['forward_from']['id'], $text, $arr['message']['reply_to_message']['message_id']-1, $data['buttons']);
    }
$tg->send($chat_id, $data['msg'], 0, $data['buttons']);
} else if (isset($arr['callback_query']) && $arr['callback_query']['data']) {
    $data = botControl($arr['callback_query']['data']);
    $tg->edit($arr['callback_query']['message']['chat']['id'], $arr['callback_query']['message']['message_id'], $data['msg'], $data['buttons']);
    }
?>