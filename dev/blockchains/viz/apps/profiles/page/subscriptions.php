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

$result['content'] = '<div id="transfers_content"><h2>Действия с подписками пользователя '.$user.'</h2>
<table>
<tr>
<th>Дата и время</th>
<th>От кого</th>
<th>Кому</th>
<th>Действие</th>
</tr>';

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

		if ($op[0] == 'set_paid_subscription') {
            $rowCount++;
        $name = 'Создание платной подписки';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
$url = $op[1]['url'];
$levels = $op[1]['levels'];
$amount = (float)$op[1]['amount'].' VIZ';
$period = $op[1]['period'];
$array_days = array("день", "дня", "дней");
$days_word = getWord($period, $array_days).',';
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td colspan="2"><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.', уровней: '.$levels.', цена за уровень: '.$amount.' на '.$period.' '.$days_word.', <a href="'.$url.'" target="_blank">Url</a></td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'paid_subscription_action') {
        $rowCount++;
        $name = 'Создание соглашения о платной подписке';
        $subscriber = isset($op[1]['subscriber']) ? $op[1]['subscriber'] : "";
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $level = $op[1]['level'];
        $amount = (float)$op[1]['amount'].' VIZ';
        $summary_amount = (float)$op[1]['summary_amount'].' VIZ';
        $period = $op[1]['period'];
$array_days = array("день", "дня", "дней");
$days_word = getWord($period, $array_days).',';
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$subscriber.'" target="_blank">'.$subscriber.'</a></td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.' на '.$period.' '.$days_word.', уровень: '.$level.', цена за уровень: '.$amount.', Итоговая цена: '.$summary_amount.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'cancel_paid_subscription') {
        $rowCount++;
        $name = 'Прекращение периодических платежей';
        $subscriber = isset($op[1]['subscriber']) ? $op[1]['subscriber'] : "";
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$subscriber.'" target="_blank">'.$subscriber.'</a></td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'paid_subscribe') {
        $rowCount++;
        $name = 'Подписание условий соглашения по платной подписке';
        $subscriber = isset($op[1]['subscriber']) ? $op[1]['subscriber'] : "";
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $level = $op[1]['level'];
        $amount = (float)$op[1]['amount'] * $level.' VIZ';
        $auto_renewal = $op[1]['auto_renewal'] == true ? 'да' : 'нет';
        $period = $op[1]['period'];
$array_days = array("день", "дня", "дней");
$days_word = getWord($period, $array_days).',';
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td>'.$name.', стоимость: '.$amount.', уровень: '.$level.', срок действия: '.$period.' '.$days_word.', автопродление: '.$auto_renewal.'</td>
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
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

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
        $name = 'Продажа аккаунта';
        $account = isset($op[1]['account']) ? $op[1]['account'] : "";
        $price = (float)$op[1]['price'].' VIZ';
        $buyer = $op[1]['buyer'];
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

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