<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/Get_Followers.php';

use GrapheneNodeClient\Tools\Reputation;

$res4 = $command4->execute($commandQuery4);

$mass4 = $res4['result'];

// ответ для браузера
$result = [];

// если мы брали на одного подписчика больше - нужно его убрать
if (count($mass4) > FOLLOWERS_LIMIT) {
    $result['nextIsExists'] = true;
    $next = array_pop($mass4);
    $result['next'] = $next['follower'];
} else {
    $result['nextIsExists'] = false;
}
$result['content'] = '';

$podpischiki = '';
foreach ($mass4 as $k4 => $datas4) {
    $podpischiki .= $k4 . "=" . $datas4['follower'] . "&";
}
parse_str($podpischiki, $data[0]);

require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/Followers_accounts.php';
if ($chain != 'viz' && $chain != 'WLS') {
require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/get_feed_history.php';
}
if ($chain == 'WLS' or $chain == 'steem') {
    require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/getRewardFund.php';
}

if ($chain != 'viz' && $chain != 'WLS') {
    $feed_res = $feed_command->execute($feed_commandQuery);
    $feed_mass = $feed_res['result'];
}

if ($chain == 'WLS' or $chain == 'steem') {
    $RewardFund_res = $RewardFund_command->execute($RewardFund_commandQuery);
    $RewardFund_mass = $RewardFund_res['result'];
}

if (isset($array_url[1])) { // проверяем существование элемента

    $res = $command->execute($commandQuery);

    $mass = $res['result'];

    if ($mass == true) {


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

        $steem_per_vests = 1000000 * $tvfs / $tvsh;

        $result['content'] .= '<h2>Подписчики пользователя ' . $array_url[1] . '</h2>';
        $result['content'] .= "<table><tr>
<th>Имя</th>
<th>Аватар</th>
<th>Последнее обновление</th>
<th>Количество апвотов</th>
<th>Время последнего голоса</th>";
if ($chain != 'viz') {
$result['content'] .= "<th>Репутация</th>";
}
$result['content'] .= "<th>Актуальная батарейка</th>
<th>Сила голоса ($amount2)</th>
<th>Полученно в пользование $amount2</th>";
        $dng = $mass[0]['delegated_vesting_shares'] / 1000000 * $steem_per_vests;
            $result['content'] .= "<th>$amount2, делегированная другому аккаунту</th>";
        $result['content'] .= "<th>Баланс $amount1</th>";
        if ($chain != 'viz' && $chain != 'WLS') {
            $result['content'] .= "<th>Баланс в $amount3</th>";
        }
if ($chain != 'viz') {
    $result['content'] .= "<th>Стоимость апвота</th></tr>";
} else {
    $result['content'] .= "<th>Награда даст при 20% энергии (При 100%)</th></tr>";
}
        foreach ($mass as $datas) {
// Конвертация VESTS в STEEM POWER
            $sp = $datas['vesting_shares'] / 1000000 * $steem_per_vests;
            $delegated_sp = $datas['received_vesting_shares'] / 1000000 * $steem_per_vests;
            $un_delegating_sp = $datas['delegated_vesting_shares'] / 1000000 * $steem_per_vests;
            $delegating_sp = round($un_delegating_sp, 3);

            $server_time = time();

if ($chain != 'viz') {
            $reputation = $datas['reputation'];
            if ($reputation == 0) {
                $rep2 = 'нет';
            } else {
                $rep2 = Reputation::calculate($reputation);
            }
            $rep = round($rep2, 2);
        }
            $name = $datas['name'];
            $json_metadata = json_decode($datas['json_metadata'], true);
            if (isset($json_metadata['profile']['name'])) {
                $profile_name = $json_metadata['profile']['name'];
            } else {
                $profile_name = $name;
            }
            $profile_image = ($json_metadata['profile']['profile_image'] ?? "");
            $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
            $last_account_update1 = $datas['last_account_update'];
            $last_account_update2 = strtotime($last_account_update1);
            $month1 = date('m', $last_account_update2);
            $last_account_update = date('d', $last_account_update2) . ' ' . $month[$month1] . ' ' . date('Y г. H:i:s', $last_account_update2);

            if ($chain != 'viz') {
            $post_count = $datas['post_count'];
            } else {
                $post_count = $datas['content_count'];
            }
            $last_vote_time = $datas['last_vote_time'];
            $last_vote_time2 = strtotime($last_vote_time);
            $month3 = date('m', $last_vote_time2);
            $last_vote_time1 = date('d', $last_vote_time2) . ' ' . $month[$month3] . ' ' . date('Y г. H:i:s', $last_vote_time2);
            $chain_balance = $datas['balance'];
            if ($chain != 'viz' && $chain != 'WLS') {
            $sbd_balance = $datas['sbd_balance'];
            $savings_balance = $datas['savings_balance'];
            $savings_sbd_balance = $datas['savings_sbd_balance'];
            $savings_withdraw_requests = $datas['savings_withdraw_requests'];
            $reward_sbd_balance = (float)($datas['reward_sbd_balance'] ?? "");
            $reward_vesting_steem = (float)($datas['reward_vesting_steem'] ?? "");
        }
            $last_post1 = $datas['last_post'];
            $last_post2 = strtotime($last_post1);
            $month4 = date('m', $last_post2);
            $last_post = date('d', $last_post2) . ' ' . $month[$month4] . ' ' . date('Y г. H:i:s', $last_post2);

            $next_vesting_withdrawal1 = $datas['next_vesting_withdrawal'];
            $next_vesting_withdrawal2 = strtotime($next_vesting_withdrawal1);
            $month6 = date('m', $next_vesting_withdrawal2);
            $next_vesting_withdrawal = date('d', $next_vesting_withdrawal2) . ' ' . $month[$month6] . ' ' . date('Y г. H:i:s', $next_vesting_withdrawal2);


            $current_time = strtotime($mass3['time']) * 1000;
            $last_vote_seconds = strtotime($last_vote_time) * 1000;

if ($chain != 'viz') {
    $volume_not = ($datas['voting_power'] + (($current_time - $last_vote_seconds) / 1000) * 0.11574) / 100; //расчет текущей Voting Power
} else {
    $volume_not = ($datas['energy'] + (($current_time - $last_vote_seconds) / 1000) * 0.11574) / 100; //расчет текущей Voting Power
}
            $volume = round($volume_not, 2); // Округление до двух знаков после запятой

            if ($volume >= 100) {
                $charge = min($volume, 100);
            } else {
                $charge = $volume;
            }

            $minus_shares = $datas['received_vesting_shares'] - $datas['delegated_vesting_shares'];
            $all_shares = $minus_shares + $datas['vesting_shares'];
if ($chain == 'WLS') {
$recent = $RewardFund_mass['recent_claims'];
$rewa = $RewardFund_mass['reward_balance'];
$primerr = $all_shares / $recent;
$brimerr = ($primerr * $rewa) * 100000;
$wqaaa = ($brimerr /100) * ($charge);
$dasdas = round($wqaaa, 3);
$fixx = round($brimerr, 3);
} else if ($chain == 'golos') {
$base = (float)$feed_mass["current_median_history"]["base"];
    $quote = (float)$feed_mass["current_median_history"]["quote"];
   $median_price = round($base/$quote, 3);
    $total_vesting_fund_steem = (float)$mass3["total_vesting_fund_steem"];
    $total_vesting_shares = (float)$mass3["total_vesting_shares"];
    $total_reward_fund_steem = (float)$mass3["total_reward_fund_steem"];
	$total_reward_shares2 = (int)$mass3["total_reward_shares2"];
    $golos_per_vests = $total_vesting_fund_steem / $total_vesting_shares;

$NOW = strptime("%Y-%m-%dT%H:%M:%S", $mass3["time"]);
   $account["GOLOS"] = (float)$datas["balance"];
    $account["GBG"] = $datas["sbd_balance"];
$VP = (float)$volume*100;
$account["last_vote_time"] = strptime("%Y-%m-%dT%H:%M:%S", $last_vote_time);
$age = ($NOW - $account["last_vote_time"]) / 1;
$actualVP = $VP + (10000 * $age / 432000);
if ($actualVP > 10000) {
    $account["voting_power"] = 10000;
} else {
    $account["voting_power"] = round($actualVP);
}
$account["golos_power"] = round($all_shares * $golos_per_vests, 3);
$vesting_shares = (int)1e6 * $account["golos_power"] / $golos_per_vests;

if ($chain == 'golos') {
$max_vote_denom = $mass3["vote_regeneration_per_day"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
} else {
$max_vote_denom = $mass3["vote_power_reserve_rate"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
}
$used_power = (int)($account["voting_power"] + $max_vote_denom - 1) / $max_vote_denom;
$fixx_used_power = (int)(10000 + $max_vote_denom - 1) / $max_vote_denom;
$rshares = (($vesting_shares * $used_power) / 10000);
$account["rshares"] = round($rshares);
$fixxrshares = (($vesting_shares * $fixx_used_power) / 10000);
$account["fixx_rshares"] = round($fixxrshares);
$value_golos = round($account["rshares"] * $total_reward_fund_steem / $total_reward_shares2, 3);
$value_gbg = round($value_golos * $median_price, 3);

$dasdas_golos = $value_golos;
$dasdas_gbg = $value_gbg;
$fixx_golos = round($account["fixx_rshares"] * $total_reward_fund_steem / $total_reward_shares2, 3);
$fixx_gbg = round($fixx_golos * $median_price, 3);
} else if ($chain == 'viz') {
    $total_vesting_fund = (float)$mass3["total_vesting_fund"];
    $total_vesting_shares = (float)$mass3["total_vesting_shares"];
      $total_reward_fund = (float)$mass3["total_reward_fund"];
    $total_reward_shares = (int)$mass3["total_reward_shares"];
    $shares = $sp;
    
    $payout20 = $shares * 20 /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
    $payout20 = (int)$payout20 / 1000000;

    $payout100 = $shares * 100 /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
    $payout100 = (int)$payout100 / 1000000;
} else if ($chain == 'steem') {
$steem_a = $tvfs / $tvsh;
$steem_n = 100; // vote_vait;
$steem_r = $sp / $steem_a;
$steem_m2 = 100 * $charge * (100 * $steem_n) / 10000;
$steem_m = ($steem_m2 + 49) / 50;
$fixx_steem_m2 = 100 * 100 * (100 * $steem_n) / 10000;
$fixx_steem_m = ($fixx_steem_m2 + 49) / 50;
$rewa = $RewardFund_mass['reward_balance'];
$recent = $RewardFund_mass['recent_claims'];
$steem_i = $rewa / $recent;
$base = (float)$feed_mass["current_median_history"]["base"];
    $quote = (float)$feed_mass["current_median_history"]["quote"];
$median_price = round($base/$quote, 2);
$dasdas_golos = round($steem_r * $steem_m * 100 * $steem_i, 3);
$dasdas_gbg = round($steem_r * $steem_m * 100 * $steem_i * $median_price, 3);
$fixx_golos = round($steem_r * $fixx_steem_m * 100 * $steem_i, 3);
$fixx_gbg = round($steem_r * $fixx_steem_m * 100 * $steem_i * $median_price, 3);
}

            $result['content'] .= "<tr><td><a href='https://$client/@$name' target='_blank'>$name на $client</a>, <a href='https://dpos.space/profiles/$name/$array_url[2]' target='_blank'>$name в этом сервисе</a></td>
<td><img src='$profile_image' width='130px' height='auto' alt='Аватар' /></td>
<td>$last_account_update</td>
<td>$post_count</td>
<td>$last_vote_time1</td>";
if ($chain != 'viz') {
$result['content'] .= "<td>$rep</td>";
}
$result['content'] .= "<td>$charge%</td>
<td>" . round($sp, 3) . "</td>
<td>" . round($delegated_sp, 3) . "</td>";
            if ($delegating_sp > 0) {
                $result['content'] .= "<td>$delegating_sp</td>";
            } else {
                $result['content'] .= "<td>0</td>";
            }
            $result['content'] .= "<td>$chain_balance</td>";
if ($chain != 'viz' && $chain != 'WLS') {
            $result['content'] .= "<td>$sbd_balance</td>";
}
            if ($chain == 'WLS') {
                $result['content'] .= "<td>$dasdas ($fixx)</td></tr>";
            } else if ($chain == 'golos' or $chain == 'steem') {
                $result['content'] .= "<td>$dasdas_golos $amount1, $dasdas_gbg $amount3 ($fixx_golos $amount1, $fixx_gbg $amount3)</td></tr>";
            } else if ($chain == 'viz') {
                $result['content'] .= "<td>$payout20 ($payout100)</td></tr>";
            }
            $result['content'] .= "</tr>";
        }
    }
    $result['content'] .= "</table>";
} else {
    $result['content'] .= '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: ' . $array_url[1] . '</p>';
}

echo json_encode($result);
