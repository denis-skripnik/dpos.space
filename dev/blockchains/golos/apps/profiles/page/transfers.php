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

$result['content'] = '<div id="transfers_content"><h2>Переводы пользователю '.$user.'</h2>
<table>
<tr>
<th>Дата и время</th>
<th>От кого</th>
<th>Кому</th>
<th>Сумма</th>
<th>Заметка (memo)</th></tr>';

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

    $res = getAccountHistoryChunk($user, $startWith, ['select_ops' => ['transfer', 'transfer_to_vesting','claim','transfer_from_tip','transfer_to_tip','invite','invite_claim']]);

    $mass = $res['result'];

    if (! $mass) {
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

		$op1 = $op[1];

		if ($op[0] == 'transfer' || $op[0] == 'transfer_to_vesting' || $op[0] == 'claim' || $op[0] == 'transfer_to_tip' || $op[0] == 'transfer_from_tip') {
        $rowCount++;

        $from = $op[1]['from'] ?? "robot";
        $to = $op[1]['to'] ?? "";
        $amount = $op[1]['amount'] ?? "";
        $memo = $op[1]['memo'] ?? "";
if ($op[0] == 'transfer_to_vesting') $memo = 'Перевод в СГ';
if ($op[0] == 'claim') $memo = 'Получение своих начислений на СГ.';
if ($op[0] == 'transfer_from_tip') $memo = 'Перевод из TIP баланса.'.($op[1]['memo'] !== '' ? ' Заметка: '.$op[1]['memo'] : '');
if ($op[0] == 'transfer_to_tip') $memo = 'Перевод в TIP баланс.'.($op[1]['memo'] !== '' ? ' Заметка: '.$op[1]['memo'] : '');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
		<td><a href="'.$site_url.'golos/profiles/'.$from.'" target="_blank">'.$from.'</a></td>
<td><a href="'.$site_url.'golos/profiles/'.$to.'" target="_blank">'.$to.'</a></td>
<td>'.$amount.'</td>
<td>'.$memo.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else if ($op[0] == 'invite') {
        $rowCount++;

$creator = $op[1]['creator'];
        $balance = $op[1]['balance'] ?? "";
        $invite_key = $op[1]['invite_key'];
        $memo = 'Создание инвайта. Код: '.$invite_secret;
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
        <td><a href="'.$site_url.'golos/profiles/'.$creator.'" target="_blank">'.$creator.'</a></td>
<td></td>
<td>'.$balance.'</td>
<td>'.$memo.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else if ($op[0] == 'invite_claim') {
            $rowCount++;
    
$initiator = $op[1]['initiator'];
            $receiver = $op[1]['receiver'] ?? "";
            $invite_secret = $op[1]['invite_secret'];
            $memo = 'Получение инвайта на баланс. Код инвайта: '.$invite_secret;
            $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
            $timestamp1 = $datas[1]['timestamp'];
     $timestamp2 = strtotime($timestamp1);
    $month2 = date('m', $timestamp2);
    $timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
    
    $result['content'] .= '<tr>
    <td>'.$timestamp.'</td>
            <td><a href="'.$site_url.'golos/profiles/'.$initiator.'" target="_blank">'.$initiator.'</a></td>
    <td><a href="'.$site_url.'golos/profiles/'.$receiver.'" target="_blank">'.$receiver.'</a></td>
    <td></td>
    <td>'.$memo.'</td>
    </tr>';
                    if ($rowCount === TRX_LIMIT) {
                break;
            }
    }
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