<?php
define('CURATOR_REWARDS_LIMIT', 20);

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

if (!$user) { // проверяем существование элемента
    return;
}

$result = [];

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

while ($startWith !== -1 && $rowCount !== CURATOR_REWARDS_LIMIT) {
    $res = getAccountHistoryChunk($user, $chain, $startWith);

    $mass = $res['result'];

    if (!$mass) {
        $result['content'] = '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: ' . $user . '</p>';
        echo json_encode($result);
        return;
    }

    krsort($mass);

    if ($chain == 'WLS') {
        $result['content'] = '<h2>Кураторские награды в '.$amount2.' пользователю ' . $user . '</h2>
        <table id="rewards-ol">
        <tr><th>Дата и время получения вознаграждения</th>
        <th>Сумма</th>
        <th>Ссылка на пост/комментарий</th></tr>';
        $summ_reward_gp = 0;
		foreach ($mass as $datas) {
            if ($rowCount === CURATOR_REWARDS_LIMIT) {
                break;
            }
            $startWith = $datas[0] - 1;

            $op = $datas[1]['op'];
            $reward_steem = (float)($op[1]['steem_payout'] ?? "");
            $reward_sbd = (float)($op[1]['sbd_payout'] ?? "");
            $reward_vests = (float)($op[1]['vesting_payout'] ?? "");
            $reward_gests = (float)($op[1]['reward'] ?? "");
            $steem_per_vests = 1000000 * $tvfs / $tvsh;
            $reward_SP = $reward_vests / 1000000 * $steem_per_vests;
            $reward_gp = $reward_gests / 1000000 * $steem_per_vests;
            $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
            $timestamp1 = $datas[1]['timestamp'];
            $timestamp2 = strtotime($timestamp1);
            $month2 = date('m', $timestamp2);
            $timestamp = date('j', $timestamp2) . ' ' . $month[$month2] . ' ' . date('Y г. H:i:s', $timestamp2);
            $op1 = $op[1];
            if ($op[0] == 'curation_reward') {
                $rowCount++;
                $lastSelectedIndex = $datas[0];
                $result['content'] .= '<tr><td>' . $timestamp . '</td>
<td>' . round($reward_gp, 3) . ' ' . $amount2 . '</td>
<td><a href="https://' . $client . '/@' . $op[1]['comment_author'] . '/' . $op[1]['comment_permlink'] . '" target="_blank">https://' . $client . '/@' . $op[1]['comment_author'] . '/' . $op[1]['comment_permlink'] . '</a></td></tr>';
$summ_reward_gp += $reward_gp;
            }
        }
       } else {
        $result['content'] = '<h2>Кураторские награды в '.$amount2.' пользователю ' . $user . '</h2>
        <table id="rewards-ol">
        <tr><th>Дата и время получения вознаграждения</th>
        <th>Сумма</th>
        <th>Ссылка на пост/комментарий</th></tr>';
        $summ_reward_gp = 0;
		foreach ($mass as $datas) {
            if ($rowCount === CURATOR_REWARDS_LIMIT) {
                break;
            }
            $startWith = $datas[0] - 1;

            $op = $datas[1]['op'] ?? "";
            $reward_steem = (float)($op[1]['steem_payout'] ?? "");
            $reward_sbd = (float)($op[1]['sbd_payout'] ?? "");
            $reward_vests = (float)($op[1]['vesting_payout'] ?? "");
            $reward_gests = (float)($op[1]['reward'] ?? "");
            $steem_per_vests = 1000000 * $tvfs / $tvsh;
            $reward_sp = $reward_vests / 1000000 * $steem_per_vests ?? "";
            $reward_gp = $reward_gests / 1000000 * $steem_per_vests ?? "";
            $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
            $timestamp1 = $datas[1]['timestamp'];
            $timestamp2 = strtotime($timestamp1);
            $month2 = date('m', $timestamp2);
            $timestamp = date('j', $timestamp2) . ' ' . $month[$month2] . ' ' . date('Y г. H:i:s', $timestamp2);
            $op1 = $op[1];
            if ($op[0] == 'curation_reward') {
                $rowCount++;
                $lastSelectedIndex = $datas[0];
                $result['content'] .= '<tr><td>' . $timestamp . '</td>
<td>' . round($reward_gp, 3) . ' ' . $amount2 . '</td>
<td><a href="https://' . $client . '/@' . $op[1]['comment_author'] . '/' . $op[1]['comment_permlink'] . '" target="_blank">https://' . $client . '/@' . $op[1]['comment_author'] . '/' . $op[1]['comment_permlink'] . '</a></td></tr>';
$summ_reward_gp += $reward_gp;
            }
        }
    }
}
$sum_reward_gp = round($summ_reward_gp, 3);

$result['content'] .= "<tr><td>Сумма всех 20 кураторских наград</td>
<td>$sum_reward_gp $amount2</td>
<td></td></tr></table>";

$result['nextIsExists'] = $startWith !== -1;

if ($result['nextIsExists']) {
    $result['next'] = $startWith;
}

echo json_encode($result);
