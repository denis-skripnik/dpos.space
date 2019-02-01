<?php
define('TRX_LIMIT', 20);

@session_start();
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_account_history_chunk.php';

$user = $array_url[1] ?? false;

if (! $user) { // проверяем существование элемента
    return;
}

$chain = $array_url[2];

$result['content'] = '<h2>Переводы пользователю '.$user.'</h2>
<table>
<tr>
<th>Дата и время</th>
<th>От кого</th>
<th>Кому</th>
<th>Сумма</th>
<th>Заметка (memo)</th></tr>';

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

while ($startWith !== -1 && $rowCount !== TRX_LIMIT) {

    $res = getAccountHistoryChunk($user, $chain, $startWith);

    $mass = $res['result'];

    if (! $mass) {
        $result['content'] = '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
        echo json_encode($result);
        return;
    }

    krsort($mass);

    foreach ($mass as $datas) {
        $startWith = $datas[0] - 1;

        $op = $datas[1]['op'];
        $from = $op[1]['from'] ?? "robot";
        $to = $op[1]['to'] ?? "";
        $amount = $op[1]['amount'] ?? "";
        $memo = $op[1]['memo'] ?? "";
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

		$op1 = $op[1];

        if ($from === 'robot') {
            continue;
        }

        $rowCount++;

        $result['content'] .= '<tr>
<td>'.$timestamp.'</td>
		<td><a href="https://dpos.space/profiles/'.$from.'/'.$array_url[2].'" target="_blank">'.$from.'</a></td>
<td><a href="https://dpos.space/profiles/'.$to.'/'.$array_url[2].'" target="_blank">'.$to.'</a></td>
<td>'.$amount.'</td>
<td>'.$memo.'</td>
</tr>';

        if ($rowCount === TRX_LIMIT) {
            break;
        }
    }
}


$result['nextIsExists'] = $startWith !== -1;

if ($result['nextIsExists']) {
    $result['next'] = $startWith;
}

$result['content'] .= '</table><br />';

echo json_encode($result);
