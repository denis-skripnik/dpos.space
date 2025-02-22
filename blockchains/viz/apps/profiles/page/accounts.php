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

while ($rowCount !== TRX_LIMIT && $retry_counter < 4) {

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
        if ($rowCount === TRX_LIMIT) {
            break;
        }

        $op = $datas[1]['op'];
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$timestamp = '<a href="'.$site_url.'viz/explorer/tx/'.$datas[1]['trx_id'].'" target="_blank">'.$timestamp.'</a>';
        
		if ($op[0] == 'account_create') {
            $rowCount++;
            $startWith = $datas[0] - 1;

            $name = 'Создание аккаунта';
        $account = isset($op[1]['new_account_name']) ? $op[1]['new_account_name'] : "";
$amount = $op[1]['delegation'] !== '0.000000 SHARES' ? (float)$op[1]['delegation'].' VIZ делегированием соц. капитала' : (float)$op[1]['fee'].' VIZ';

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.' на '.$amount.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else if ($op[0] == 'invite_registration') {
            $rowCount++;
        $name = 'Создание аккаунта через инвайт';
        $account = isset($op[1]['new_account_name']) ? $op[1]['new_account_name'] : "";
$invite_secret = $op[1]['invite_secret'];

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.', код: '.$invite_secret.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'account_update') {
        $rowCount++;
        $name = 'Обновление доступов аккаунта';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'account_metadata') {
        $rowCount++;
        $name = 'Обновление публичного профиля';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'set_subaccount_price') {
        $rowCount++;
        $name = 'Установка цены продажи субаккаунта';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $price = (float)$op[1]['subaccount_offer_price'].' VIZ';
        $subaccount_on_sale = $op[1]['subaccount_on_sale'] == true ? 'продаются' : 'Не продаются';

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.' за '.$price.', статус: '.$subaccount_on_sale.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'set_account_price') {
        $rowCount++;
        $name = 'Установка цены продажи аккаунта';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $price = (float)$op[1]['account_offer_price'].' VIZ';
        $account_on_sale = $op[1]['account_on_sale'] == true ? 'продаются' : 'Не продаются';

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.' за '.$price.', статус: '.$account_on_sale.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'account_sale') {
        $rowCount++;
        $name = 'Продажа аккаунта пользователю';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $price = (float)$op[1]['price'].' VIZ';
        $buyer = $op[1]['buyer'];

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.' <a href="'.$site_url.'viz/profiles/'.$buyer.'" target="_blank">'.$buyer.'</a> за '.$price.'</td>
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