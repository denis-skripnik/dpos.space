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

$result['content'] = '<div id="transfers_content"><h2>Действия пользователя '.$user.' в ДАО</h2>
<table>
<tr>
<th>Дата и время</th>
<th>От кого</th>
<th>Что или кто</th>
<th>Описание</th></tr>';

$rowCount = 0;
$startWith = $_REQUEST['start'] ?? 300000000;
while ($startWith !== -1 && $rowCount !== TRX_LIMIT) {
if ($startWith === 0) break;
    $res = getAccountHistoryChunk($user, $startWith);

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

    		if ($op[0] == 'account_witness_vote') {
        $rowCount++;
        $name = ' за делегата';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $witness = isset($op[1]['witness']) ? $op[1]['witness'] : "";
                $approve = $op[1]['approve'] == true ? 'установлен' : 'снят';
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'serey/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td><a href="'.$site_url.'serey/profiles/'.$witness.'" target="_blank">'.$witness.'</a></td>
<td>'.$name.' '.$approve.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'account_witness_proxy') {
        $rowCount++;
        $name = 'Установка прокси аккаунта голосования за делегатов';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $proxy = isset($op[1]['proxy']) ? $op[1]['proxy'] : "";
                $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'serey/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td><a href="'.$site_url.'serey/profiles/'.$proxy.'" target="_blank">'.$proxy.'</a></td>
<td>'.$name.'</td>        
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
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