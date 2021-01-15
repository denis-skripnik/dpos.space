<?php
define('TRX_LIMIT', 10);
global $conf;

require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require 'snippets/get_account_history_chunk.php';
require 'snippets/get_dynamic_global_properties.php';

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

    $res3 = $command3->execute($commandQuery3); 
    $mass3 = $res3['result'];
    $tvfs = (float)$mass3['total_vesting_fund_hive'];
    $tvsh = (float)$mass3['total_vesting_shares'];
    $hive_per_vests = 1000000 * $tvfs / $tvsh;
    
    $result['content'] = '<div id="transfers_content"><h2>HP пользователя '.$user.'</h2>
<table>
<tr>
<th>Дата и время</th>
<th>От кого</th>
<th>Кому</th>
<th>Сумма</th>
<th>Описание</th></tr>';

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

while ($startWith !== -1 && $rowCount !== TRX_LIMIT) {
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

		if ($op[0] == 'transfer_to_vesting' || $op[0] == 'delegate_vesting_shares') {
        $rowCount++;

        $from = isset($op[1]['from']) ? $op[1]['from'] : $op[1]['delegator'];
        $to = isset($op[1]['to']) ? $op[1]['to'] : $op[1]['delegatee'];
        $float_amount = (float)(isset($op[1]['amount']) ? $op[1]['amount'] : (float)$op[1]['vesting_shares'] / 1000000 * $hive_per_vests);
        $amount = round($float_amount, 3).' HIVE';
        $memo = '';
        if ($op[0] == 'transfer_to_vesting') $memo = 'Перевод в HP';
        if ($op[0] == 'delegate_vesting_shares') $memo = 'Делегирование HP';
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
		<td><a href="'.$site_url.'hive/profiles/'.$from.'" target="_blank">'.$from.'</a></td>
<td><a href="'.$site_url.'hive/profiles/'.$to.'" target="_blank">'.$to.'</a></td>
<td>'.$amount.'</td>
<td>'.$memo.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else if ($op[0] == 'withdraw_vesting') {
        $rowCount++;

        $from = $op[1]['account'];
        $float_amount = (float)$op[1]['vesting_shares'] / 1000000 * $hive_per_vests;
        $amount = round($float_amount, 3).' HIVE';
        $memo = 'Запуск вывода из Hive Power.';
        if ($float_amount == 0) $memo = 'Отмена вывода Hive Power';
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
		<td colHPan="2"><a href="'.$site_url.'hive/profiles/'.$from.'" target="_blank">'.$from.'</a></td>
<td>'.$amount.'</td>
<td>'.$memo.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else if ($op[0] == 'return_vesting_delegation') {
        $rowCount++;

        $from = $op[1]['account'];
        $float_amount = (float)$op[1]['vesting_shares'] / 1000000 * $hive_per_vests;
        $amount = round($float_amount, 3).' HIVE';
        $memo = 'Возврат делегирования из HP';
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
		<td colHPan="2"><a href="'.$site_url.'hive/profiles/'.$from.'" target="_blank">'.$from.'</a></td>
<td>'.$amount.'</td>
<td>'.$memo.'</td>
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