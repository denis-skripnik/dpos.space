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

		if ($op[0] == 'committee_vote_request') {
        $rowCount++;
        $name = 'Голосование по заявке в комитет';
        $voter = isset($op[1]['voter']) ? $op[1]['voter'] : "";
        $vote_percent = $op[1]['vote_percent'] / 100;
        $request_id = $op[1]['request_id'];
                $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$voter.'" target="_blank">'.$voter.'</a></td>
<td>Заявка №<a href="'.$site_url.'viz/manage/workers#'.$request_id.'" target="_blank">'.$request_id.'</a></td>
<td>'.$name.' на '.$vote_percent.'%</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'account_witness_vote') {
        $rowCount++;
        $name = 'Голос за делегата';
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
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td><a href="'.$site_url.'viz/profiles/'.$witness.'" target="_blank">'.$witness.'</a></td>
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
<td><a href="'.$site_url.'viz/profiles/'.$account.'" target="_blank">'.$account.'</a></td>
<td><a href="'.$site_url.'viz/profiles/'.$proxy.'" target="_blank">'.$proxy.'</a></td>
<td>'.$name.'</td>        
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'committee_worker_create_request') {
        $rowCount++;
        $duration = $op[1]['duration'] / 86400;
        $array_days = array("день", "дня", "дней");
        $days_word = getWord($duration, $array_days).',';
        $name = 'Создание заявки на '.$duration.' '.$days_word;
        $amounts = 'Минимальная: '.$op[1]['required_amount_min'].', максимальная: '.$op[1]['required_amount_max'];
        $creator = $op[1]['creator'];
        $worker = $op[1]['worker'];
        $url = $op[1]['url'];
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$creator.'" target="_blank">'.$creator.'</a></td>
<td><a href="'.$site_url.'viz/profiles/'.$worker.'" target="_blank">'.$worker.'</a></td>
<td>'.$name.'. '.$amounts.', <a href="'.$url.'" target="_blank">Url</a></td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'committee_worker_cancel_request') {
        $rowCount++;
        $name = 'Отмена заявки';
        $creator = $op[1]['creator'];
        $request_id = $op[1]['request_id'];
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$creator.'" target="_blank">'.$creator.'</a></td>
<td>Заявка №<a href="'.$site_url.'viz/manage/workers#'.$request_id.'" target="_blank">'.$request_id.'</a></td>
<td>'.$name.'</td>
</tr>';
                if ($rowCount === TRX_LIMIT) {
            break;
        }
    } else 		if ($op[0] == 'committee_pay_request') {
        $rowCount++;
        $name = 'Выплата по заявке ';
        $request_id = $op[1]['request_id'];
        $worker = $op[1]['worker'];
        $tokens = $op[1]['tokens'];
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
$result['content'] .= '<tr>
<td>'.$timestamp.'</td>
<td><a href="'.$site_url.'viz/profiles/'.$worker.'" target="_blank">'.$worker.'</a></td>
<td>Заявка №<a href="'.$site_url.'viz/manage/workers#'.$request_id.'" target="_blank">'.$request_id.'</a></td>
<td>'.$name.' '.$tokens.'</td>
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