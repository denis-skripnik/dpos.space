<?php
define('TRX_LIMIT', 10);
global $conf;

require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require 'snippets/get_account_history_chunk.php';

if (!isset($user) && isset($_REQUEST['options']['user'])) { // проверяем существование элемента
    $user = $_REQUEST['options']['user'];
    } else if (!isset($user) && !isset($_REQUEST['options']['user'])) {
    return;
    }
    
    $site_url = '';
    if (isset($_REQUEST['options']['siteUrl'])) {
        $site_url = $_REQUEST['options']['siteUrl'];
    } else if (isset($conf['siteUrl'])) {
        $site_url = $conf['siteUrl'];
    }

    $result = [];
$result['content'] = '<div id="transfers_content"><h2>Действия с аккаунтами пользователя '.$user.'</h2>
<table>
<tr>
<th>Дата и время</th>
<th>Аккаунт</th>
<th>Действие</th>
</tr>';

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? -1;
$retry_counter = 0;
while ($rowCount !== TRX_LIMIT && $retry_counter < 3) {
    
    $res = getAccountHistoryChunk($user, $startWith, ['select_ops' => ["account_create", "account_create_with_invite", "account_update", "account_metadata"]]);

    $mass = $res['result'];

    if (!$mass) {
        $result['content'] = '<p>Результатов нет. Возможно все подходящие операции в истории далеко или такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
        if (isset($_REQUEST['options']) || isset($_GET['options'])) {
            echo json_encode($result);
        return;
        } else {
        return $result['content'];
        }
    }

    krsort($mass);

    foreach ($mass as $datas) {
        $startWith = $datas[0] - 1;
        $op = $datas[1]['op'];

		if ($op[0] == 'account_create') {
            $rowCount++;
        $name = 'Создание аккаунта';
        $account = isset($op[1]['new_account_name']) ? $op[1]['new_account_name'] : "";
        $amount = isset($op[1]['delegation']) && $op[1]['delegation'] !== '0.000000 VESTS' ? (float)$op[1]['delegation'].' STEEM делегированием SP' : (float)$op[1]['fee'].' STEEM';
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'steem/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.' на '.$amount.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else if ($op[0] == 'account_create_with_invite') {
        $rowCount++;
    $name = 'Создание аккаунта через инвайт';
    $account = isset($op[1]['new_account_name']) ? $op[1]['new_account_name'] : "";
$invite_secret = $op[1]['invite_secret'];
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
    $timestamp1 = $datas[1]['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'steem/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.', код: '.$invite_secret.'</td>
</tr>';
            if ($rowCount === TRX_LIMIT) {
        break;
    }
    } else 		if ($op[0] == 'account_update') {
        $rowCount++;
        $name = 'Обновление доступов аккаунта';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'steem/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'account_metadata') {
        $rowCount++;
        $name = 'Обновление публичного профиля';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'steem/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    }
    }
    $retry_counter++;
    if ($startWith === -1) break;
}
$result['content'] .= '</table><br />';

$result['nextIsExists'] = $startWith !== '';
if ($result['nextIsExists']) {
    $result['next'] = $startWith;
}
$result['content'] .= '</div>';

if (isset($_REQUEST['options']) || isset($_GET['options'])) {
    echo json_encode($result);
} else {
return $result['content'];
}