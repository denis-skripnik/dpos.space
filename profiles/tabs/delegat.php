<?php
define('DELEGAT_LIMIT', 10);

@session_start();

require_once $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/get_delegate.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/get_account_history_chunk.php';

$user = $array_url[1] ?? false;

if (! $user) {
    die();
}

$chain = $array_url[2];

$result['content'] = '';

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

$res = $command->execute($commandQuery);

$mass = $res['result'];

if (! $mass) {
    $result['content'] = '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: ' . $user . '</p>';
    die(json_encode($result));
}

$witness_votes = $mass[0]['witness_votes'];
if (isset($witness_votes)) { // проверяем существование элемента
    $witness_count = count($mass[0]['witness_votes']);
    $result['content'] .= "<h2>Список делегатов, за которых проголосовал пользователь. Всего: $witness_count</h2>";
    if ($witness_count > 0) {
        $result['content'] .= "<ul>";
        foreach ($mass as $datas) {
            $witness_votes_count = count($datas['witness_votes']);
            for ($witness_votes_num = 0; $witness_votes_num <= $witness_votes_count-1; $witness_votes_num++) {
                $witness_vote = ($datas['witness_votes'][$witness_votes_num] ?? "");
                $result['content'] .= "<li><a href='https://dpos.space/profiles/$witness_vote/" . $chain . "' title='Клик по ссылке переведёт на страницу пользователя на dpos.space/profiles' target='_blank'>$witness_vote</a></li>";
            }
        }
        $result['content'] .= "</ul>";
    } else {
        $result['content'] .= "<p align='center'>$user ни за одного делегата не проголосовал.</p>";
    }
} else {
    $result['content'] .= '<p align="center"><strong>Этот пользователь не проголосовал ни за одного делегата.</strong></p>';
}


$result['content'] .= "<br /><h2>История установки и снятия голосов с делегатов пользователем $user</h2>";
$result['content'] .= '<table id="delegat-ol">
<tr>
<th>Дата и время</th>
<th>Действие</th>
</tr>';
$no_delegate_votes = '';

while ($startWith !== -1 && $rowCount !== DELEGAT_LIMIT) {
    $history_result = getAccountHistoryChunk($user, $chain, $startWith);
    $history_mass = $history_result['result'];
    krsort($history_mass);

    foreach ($history_mass as $history_datas) {
        $startWith = $history_datas[0] - 1;

        $op = $history_datas[1]['op'];
                    $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $history_datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);

		if ($op[0] == 'account_witness_vote') {
            $rowCount++;
            if ($op[1]['approve'] == true) {
                $true_vote = 'проголосовал за';
            } else if ($op[1]['approve'] == false) {
                $true_vote = 'снял голос с';
            }
            $vote_account = $op[1]['account'];
            $witness_account = ($op[1]['witness'] ?? "");
            $result['content'] .= "<tr>
<td>$timestamp</td>
<td><a href='https://dpos.space/profiles/$vote_account/$array_url[2]' target='_blank'>$vote_account</a> $true_vote делегата <a href='https://dpos.space/profiles/$witness_account/$array_url[2]' target='_blank'>$witness_account</a></td>
</tr>";
            $no_delegate_votes .= $op[1]['account'];

            if ($rowCount === DELEGAT_LIMIT) {
                break;
            }
        }
    }
}




$result['content'] .= '</table><br />';
if ($no_delegate_votes == '') {
    $result['content'] .= "<p>Не найдено.</p>";
}

$result['nextIsExists'] = $startWith !== -1;

if ($result['nextIsExists']) {
    $result['next'] = $startWith;
}

echo json_encode($result);
