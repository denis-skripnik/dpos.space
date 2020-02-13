<?php
define('B_REWARDS_LIMIT', 5);

session_start();
require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/get_account_history_chunk.php';
require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/get_dynamic_global_properties.php';

$res3 = $command3->execute($commandQuery3);

$mass3 = $res3['result'];

// Расчет steem_per_vests
if ($chain != 'viz') {
    $tvfs = (float)$mass3['total_vesting_fund_steem'];
} else {
    $tvfs = (float)$mass3['total_vesting_fund'];
}
$tvsh = (float)$mass3['total_vesting_shares'];

$user = $array_url[1] ?? false;

if (! $user) { // проверяем существование элемента
    return;
}

$chain = $array_url[2];
if ($chain != 'viz') {
$result['content'] = "<h2>Последние бенефециарские награды пользователя $user (Сначала идут новые)</h2>
<p align='center'><strong>бенефициатом является текущий пользователь.</strong></p>
<table><tr>
<th>Дата и время получения</th>
<th>Автор</th>
<th>Ссылка на пост</th>
<th>Бенефициарская награда (в $amount2)</th></tr>";
} else {
    $result['content'] = "<h2>Последние бенефециарские награды пользователя $user (Сначала идут новые)</h2>
    <p align='center'><strong>бенефициатом является текущий пользователь.</strong></p>
    <table><tr>
    <th>Дата и время получения</th>
    <th>Инициатор</th>
    <th>Получатель награды</th>
    <th>Бенефактор</th>
    <th>Заметка (memo)</th>
    <th>Бенефициарская награда (в $amount2)</th>
    <th>Номер Custom операции (custom_sequence)</th></tr>";
}

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

while ($startWith !== -1 && $rowCount !== B_REWARDS_LIMIT) {

    $res = getAccountHistoryChunk($user, $chain, $startWith);

    $mass = $res['result'];

    if (! $mass) {
        $result['content'] = '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
        die (json_encode($result));
    }

    $summ_b_SP = 0;
    krsort($mass);
    foreach ($mass as $datas) {
        $startWith = $datas[0] - 1;

        $op = $datas[1]['op'];

        if ($op[0] == 'comment_benefactor_reward' && $op[1]['benefactor'] == $user) {
            $rowCount++;

            $b_author = ($op[1]['author'] ?? "");
            $b_permlink = ($op[1]['permlink'] ?? "");
            $b_reward = (float)($op[1]['reward'] ?? "");
            $steem_per_vests = 1000000 * $tvfs / $tvsh;
            $b_SP = $b_reward / 1000000 * $steem_per_vests;
            $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
			$result['content'] .= '<tr><td>'.$timestamp.'</td>
            <td><a href="https://dpos.space/profiles/'.$b_author.'/'.$array_url[2].'" target="_blank">'.$b_author.'</a></td>
<td><a href="https://'.$client.'/@'.$b_author.'/'.$b_permlink.'" target="_blank">'.$b_permlink.'</a>
<td>' . round($b_SP, 3) . '</td>
</tr>';
$summ_b_SP += $b_SP;
            
if ($rowCount === B_REWARDS_LIMIT) {
                break;
            }
        }
        else if ($op[0] == 'benefactor_award' && $op[1]['benefactor'] == $user) {
            $rowCount++;

            $receiver = ($op[1]['receiver'] ?? "");
            $benefactor = ($op[1]['benefactor'] ?? "");
            $memo = ($op[1]['memo'] ?? "");
            $b_initiator = ($op[1]['initiator'] ?? "");
            $b_custom_sequence = (float)($op[1]['custom_sequence'] ?? "");
            $b_shares = (float)($op[1]['shares'] ?? "");

            $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
			$result['content'] .= "<tr><td>$timestamp</td>
<td><a href='https://dpos.space/profiles/$b_initiator/viz' target='_blank'>".$b_initiator."</a></td>
            <td><a href='https://dpos.space/profiles/$receiver/$array_url[2]' target='_blank'>$receiver</a></td>
            <td><a href='https://dpos.space/profiles/$benefactor/$array_url[2]' target='_blank'>$benefactor</a></td>
            <td>$memo</td>
            <td>$b_shares</td>
            <td>$b_custom_sequence</td>
</tr>";
$summ_b_SP += $b_shares;
            
if ($rowCount === B_REWARDS_LIMIT) {
                break;
            }
        }
    }

}

$result['nextIsExists'] = $startWith !== -1;

if ($result['nextIsExists']) {
    $result['next'] = $startWith;
}
if ($chain != 'viz') {
$result['content'] .= '<tr><td>Все даты пяти элементов</td>
<td>Все авторы данной страницы</td>
<td>Все ссылки на посты, что видны здесь</td>
<td>'.round($summ_b_SP, 3).'</td></tr>
</table><br />';
} else {
    $result['content'] .= '<tr><td>Все даты пяти элементов</td>
<td>Все получатели</td>
    <td>Все заметки (memo)</td>
    <td>'.round($summ_b_SP, 3).'</td>
    <td>Все custom_sequence</td></tr>
    </table><br />';
}
echo json_encode($result);
