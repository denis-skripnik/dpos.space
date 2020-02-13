<?php
use GrapheneNodeClient\Tools\Reputation;

require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_account.php';
require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_dynamic_global_properties.php';
if ($chain != 'viz' && $chain != 'WLS') {
    require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_chain_properties.php';
    require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_ticker.php';
require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_follow_count.php';
}
require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/get_config.php';
if ($chain == 'WLS' or $chain == 'steem') {
require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/getRewardFund.php';
}

if( isset($array_url[1]) ){ // проверяем существование элемента

 $res = $command->execute($commandQuery); 
 $mass = $res['result'];

 if($mass == true){
 
 $res3 = $command3->execute($commandQuery3); 

 $mass3 = $res3['result'];
 if ($chain != 'viz' && $chain != 'WLS') {
 $ticker_res = $ticker_command->execute($ticker_commandQuery); 
 $ticker_mass = $ticker_res['result'];
 $ticker_price = $ticker_mass['latest'];
 $followcount_res = $followcount_command->execute($followcount_commandQuery); 
 $followcount_mass = $followcount_res['result'];
 }  
 $config_res = $config_command->execute($config_commandQuery); 

 $config_mass = $config_res['result'];

  if ($chain == 'WLS' or $chain == 'steem') {
$RewardFund_res = $RewardFund_command->execute($RewardFund_commandQuery);
 $RewardFund_mass = $RewardFund_res['result'];
 }
 
if ($chain == 'golos') {
    $chain_res = $chain_command->execute($chain_commandQuery); 

    $chain_mass = $chain_res['result'];
}
 
  // Расчет steem_per_vests
if ($chain != 'viz') {
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
} else {
    $tvfs = (float)$mass3['total_vesting_fund'];
}
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация VESTS в STEEM POWER
$sp = (float)$mass[0]['vesting_shares'] / 1000000 * $steem_per_vests;
if ($chain != 'WLS') {
$delegated_sp = (float)$mass[0]['received_vesting_shares'] / 1000000 * $steem_per_vests;
$un_delegating_sp = (float)$mass[0]['delegated_vesting_shares'] / 1000000 * $steem_per_vests;
$delegating_sp = round($un_delegating_sp, 3);
}
$vesting_withdraw_rate = (float)$mass[0]['vesting_withdraw_rate'] / 1000000 * $steem_per_vests;

date_default_timezone_set('UTC');
$server_time = time();

echo '<h2>Информация об аккаунте '.$array_url[1].'</h2>';
foreach ($mass as $datas) {
if ($chain != 'viz') {
    $reputation = $datas['reputation'];
if ($reputation == 0) {
$rep2 = 'нет';
} else {
 $rep2 = Reputation::calculate($reputation);
}
 $rep = round($rep2, 3);
}
 $name = $datas['name'];
if ($chain == 'viz') {
 $custom_sequence = $datas['custom_sequence'];
$custom_sequence_block_num = $datas['custom_sequence_block_num'];
}
$json_metadata = json_decode($datas['json_metadata'], true);
if (isset($json_metadata['profile']['name'])) {
$profile_name = $json_metadata['profile']['name'];
} else {
$profile_name = $name;
}
$profile_about = ($json_metadata['profile']['about'] ?? "");
$profile_location = ($json_metadata['profile']['location'] ?? "");
$profile_image = ($json_metadata['profile']['profile_image'] ?? "");
$profile_website = ($json_metadata['profile']['website'] ?? "");
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$last_account_update1 = $datas['last_account_update'];
$last_account_update2 = strtotime($last_account_update1);
$month1 = date('m', $last_account_update2);
$last_account_update = date('d', $last_account_update2).' '.$month[$month1].' '.date('Y г. H:i:s', $last_account_update2);


$created1 = $datas['created'];
 $created2 = strtotime($created1);
$month2 = date('m', $created2);
$created = date('d', $created2).' '.$month[$month2].' '.date('Y г. H:i:s', $created2);

 $recovery_account = $datas['recovery_account'];
if ($chain != 'viz') {
    $post_count = $datas['post_count'];
} else {
    $post_count = $datas['content_count'];
}
 $last_vote_time = $datas['last_vote_time'];
$last_vote_time2 = strtotime($last_vote_time);
$month3 = date('m', $last_vote_time2);
$last_vote_time1 = date('d', $last_vote_time2).' '.$month[$month3].' '.date('Y г. H:i:s', $last_vote_time2);

 $chain_balance = $datas['balance'];
if ($chain != 'WLS' && $chain != 'viz') {
 $sbd_balance = $datas['sbd_balance'];
 $savings_balance = $datas['savings_balance'];
$savings_sbd_balance = $datas['savings_sbd_balance'];
$savings_withdraw_requests = $datas['savings_withdraw_requests'];
}
$reward_vesting_steem = (float)($datas['reward_vesting_steem'] ?? "");
$reward_sbd_balance = (float)($datas['reward_sbd_balance'] ?? "");
$reward_steem_balance = (float)($datas['reward_steem_balance'] ?? "");
$last_post1 = $datas['last_post'];
$last_post2 = strtotime($last_post1);
$month4 = date('m', $last_post2);
$last_post = date('d', $last_post2).' '.$month[$month4].' '.date('Y г. H:i:s', $last_post2);
if ($chain == 'golos') {
$post_full_date = $server_time - strtotime($datas['last_post']);
}
$next_vesting_withdrawal1 = $datas['next_vesting_withdrawal'];
$next_vesting_withdrawal2 = strtotime($next_vesting_withdrawal1);
$month6 = date('m', $next_vesting_withdrawal2);
$next_vesting_withdrawal = date('d', $next_vesting_withdrawal2).' '.$month[$month6].' '.date('Y г. H:i:s', $next_vesting_withdrawal2);


$current_time = strtotime($mass3['time']) * 1000;
$last_vote_seconds = strtotime($last_vote_time) * 1000;
if ($chain == 'golos') {
$fastpower = 10000/$config_mass['STEEMIT_VOTE_REGENERATION_SECONDS'];
} else if ($chain == 'WLS') {
    $fastpower = 10000/$config_mass['WLS_VOTE_REGENERATION_SECONDS'];
} else if ($chain == 'steem') {
$fastpower = 10000/$config_mass['STEEM_VOTING_MANA_REGENERATION_SECONDS'];
} else if ($chain == 'viz') {
    $fastpower = 10000/$config_mass['CHAIN_ENERGY_REGENERATION_SECONDS'];
    }
$fast_power = round($fastpower, 5);
if ($chain != 'viz') {
$volume_not = ($datas['voting_power']+(($current_time-$last_vote_seconds)/1000)*$fast_power)/100; //расчет текущей Voting Power
} else {
    $volume_not = ($datas['energy']+(($current_time-$last_vote_seconds)/1000)*$fast_power)/100; //расчет текущей Voting Power
}
$volume = round($volume_not, 2); // Округление до двух знаков после запятой
 
if ($volume>=100) {
$charge = min($volume, 100);
}
else {
	$charge=$volume;
}
}
if ($chain != 'viz') {
$volume_estimate =($datas['voting_power']+(($current_time-$last_vote_seconds)/1000)*$fast_power);//расчет текущей Voting Power
} else {
    $volume_estimate =($datas['energy']+(($current_time-$last_vote_seconds)/1000)*$fast_power);//расчет текущей Voting Power
}
$estimate = (10000-$volume_estimate)/$fast_power;//время в секундах до полной регенерации Voting Power
$estimate_time = mktime(null, null, $estimate);//cоздание метки времени timestamp

$ostalos_time = $server_time+$estimate;
$month7 = date('m', $ostalos_time);
if ($volume>=100) {
$power_minus = 'Сейчас';
}
else {
$power_minus_chas = date('H', $ostalos_time);
    $power_minus = date('d', $ostalos_time).' '.$month[$month7].' '.date('Y г. ', $ostalos_time).$power_minus_chas.date(':i:s по Гринвичу', $ostalos_time);
}

if ($volume>=100) {
$power_chas = '0';
$power_minute = '0';
$power_second = '0';
$array_chas = array("час", "часа", "часов");
$n_chas = $power_chas;
$chas_word = getWord($n_chas, $array_chas);

$array_minutes = array("минута", "минуты", "минут");
$n_minute = $power_minute;
$minute_word = getWord($n_minute, $array_minutes);

$array_seconds = array("секунда", "секунды", "секунд");
$n_second = $power_second;
$second_word = getWord($n_second, $array_seconds);
}
else {
if ($fast_power == '0.11574') {
$power_chas = date("G", $estimate_time);
$power_minute = date("i", $estimate_time);
$power_second = date("s", $estimate_time);
$array_chas = array("час", "часа", "часов");
$n_chas = $power_chas;
$chas_word = getWord($n_chas, $array_chas);

$array_minutes = array("минута", "минуты", "минут");
$n_minute = $power_minute;
$minute_word = getWord($n_minute, $array_minutes);

$array_seconds = array("секунда", "секунды", "секунд");
$n_second = $power_second;
$second_word = getWord($n_second, $array_seconds);
} else if ($fast_power == '0.02315') {
$sub_time = $ostalos_time - time();
$sub_time = abs($sub_time);
$days_time = (int)($sub_time / (24*60*60));
$hours_time = (int)(($sub_time - $days_time * 24 * 60 * 60) / (60*60));
$min_time = (int)(($sub_time - $days_time * 24 * 60 *60 - $hours_time * 60 * 60) / 60);
$sec_time = (int)$sub_time - $days_time * 24 * 60 *60 - $hours_time * 60 * 60 - $min_time * 60;
$power_days = $days_time;
$power_chas = $hours_time;
$power_minute = $min_time;
$power_second = $sec_time;
$array_days = array("день", "дня", "дней");
$n_days = $power_days;
$days_word = getWord($n_days, $array_days).',';
$array_chas = array("час", "часа", "часов");
$n_chas = $power_chas;
$chas_word = getWord($n_chas, $array_chas);

$array_minutes = array("минута", "минуты", "минут");
$n_minute = $power_minute;
$minute_word = getWord($n_minute, $array_minutes);

$array_seconds = array("секунда", "секунды", "секунд");
$n_second = $power_second;
$second_word = getWord($n_second, $array_seconds);
}
}
if ($chain != 'WLS') {
$minus_shares = (float)$mass[0]['received_vesting_shares'] - (float)$mass[0]['delegated_vesting_shares'];
$all_shares = $minus_shares + (float)$mass[0]['vesting_shares'];
}
if ($chain == 'WLS') {
$recent = $RewardFund_mass['recent_claims'];
$rewa = $RewardFund_mass['reward_balance'];
$primerr = $sp / $recent;
$brimerr = ($primerr * $rewa) * 100000;
$wqaaa = ($brimerr /100) * ($charge);
$dasdas = round($wqaaa, 3)/5;
$fixx = round($brimerr, 3)/5;
} else if ($chain == 'golos') {
    $total_vesting_fund_steem = (float)$mass3["total_vesting_fund_steem"];
    $total_vesting_shares = (float)$mass3["total_vesting_shares"];
    $total_reward_fund_steem = (float)$mass3["total_reward_fund_steem"];
	$total_reward_shares2 = (int)$mass3["total_reward_shares2"];
    $golos_per_vests = $total_vesting_fund_steem / $total_vesting_shares;

$NOW = strptime("%Y-%m-%dT%H:%M:%S", $mass3["time"]);
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
if ($chain == 'golos' or $chain == 'viz') {
$max_vote_denom = $chain_mass["vote_regeneration_per_day"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
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
$value_gbg = round($value_golos * $ticker_price, 3);
$dasdas_golos = $value_golos;
$dasdas_gbg = $value_gbg;
$fixx_golos = round($account["fixx_rshares"] * $total_reward_fund_steem / $total_reward_shares2, 3);
$fixx_gbg = round($fixx_golos * $ticker_price, 3);
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
$dasdas_golos = round($steem_r * $steem_m * 100 * $steem_i, 3);
$dasdas_gbg = round($steem_r * $steem_m * 100 * $steem_i * $ticker_price, 3);
$fixx_golos = round($steem_r * $fixx_steem_m * 100 * $steem_i, 3);
$fixx_gbg = round($steem_r * $fixx_steem_m * 100 * $steem_i * $ticker_price, 3);
}

$all_shares = ($sp ?? $sp ?? "")-($delegating_sp ?? $delegating_sp ?? "")+($delegated_sp ?? $delegated_sp ?? "");

if ($datas['proxied_vsf_votes'][0] != 0) {
$proxied_vsf_votes = $datas['proxied_vsf_votes'][0]/1000000;
$proxied_gpsf_votes = round($proxied_vsf_votes*$tvfs/$tvsh, 3);
$proxy_shares = round($proxied_gpsf_votes, 3);
}

echo "<table><tr>
<th>Название</th>
<th>Значение</th>
</tr>
<tr>
<td>Актуальная батарейка</td>
<td>$charge%</td>
</tr>
<tr><td>До 100% батарейки осталось</td>";
if ($fast_power == '0.11574') {
echo "<td>$n_chas $chas_word, $n_minute $minute_word, $n_second $second_word</td>";
} else if ($fast_power == '0.02315') {
echo "<td>".($n_days ?? $n_days ?? "")." ".($days_word ?? $days_word ?? "")." $n_chas $chas_word, $n_minute $minute_word, $n_second $second_word</td>";
}
echo "</tr>
<tr><td>100% батарейка будет</td>
<td>$power_minus</td></tr>
<tr><td>Личная $amount2</td>
<td>".round($sp, 3)."</td>
</tr>";
if ($chain == 'golos') {
$vesting_reward = (round($sp, 3) / 10000) * 7;
echo '<tr><td>Примерная сумма награды с личной СГ (за сутки)</td>
<td>'.round($vesting_reward, 3).'</td></tr>';
}
if ($chain != 'WLS') {
echo "<tr><td>Получено в пользование $amount2</td>
<td>".round($delegated_sp, 3)."</td>
</tr>";
}
if ($vesting_withdraw_rate > 0) {
echo "<tr><td>Сумма вывода из СГ</td>
<td>".round($vesting_withdraw_rate, 3)."</td>
</tr>
<tr><td>Следующий вывод $amount2</td>
<td>$next_vesting_withdrawal</td></tr>";
}
if ($chain != 'WLS') {
if ($delegating_sp > 0) {
echo "<tr><td>Делегировано $amount2 другим аккаунтам</td>
<td>$delegating_sp</td></tr>";
}
if ($datas['proxied_vsf_votes'][0] != 0) {
    echo "<tr><td>Прокси $amount2</td>
    <td>$proxy_shares</td></tr>";
}
    echo "<tr><td>Итоговое количество $amount2, влияющее на силу апвота</td>
    <td>".round($all_shares, 3)."</td></tr>";
    }
if ($chain == 'WLS') {
echo "<tr><td>Прогнозируемая стоимость апвота при текущей батарейке (При 100%)</td>
<td>$dasdas ($fixx)</td></tr>";
} else if ($chain == 'golos' or $chain == 'steem') {
if ($dasdas_gbg == 0) {
    echo "<tr><td>Прогнозируемая стоимость апвота при текущей батарейке (При 100%)</td>
<td>$dasdas_golos $amount1 ($fixx_golos $amount1)</td></tr>";
} else {
    echo "<tr><td>Прогнозируемая стоимость апвота при текущей батарейке (При 100%), $amount3 по курсу продажи $amount1</td>
<td>$dasdas_golos $amount1, $dasdas_gbg $amount3 ($fixx_golos $amount1, $fixx_gbg $amount3)</td></tr>";
}
} else if ($chain == 'viz') {
    echo "<tr><td>Стоимость награды при затрате 20% энергии (при 100%)</td>
    <td>$payout20 ($payout100)</td></tr>";
}
$full_sp = $tvsh / 1000000 * $steem_per_vests;
if ($chain != 'WLS') {
$account_shares_progress = ($all_shares/$full_sp)*100;
} else {
    $account_shares_progress = ($all_shares/$full_sp)*100;
}

if ($account_shares_progress < 0.0001) {
echo "<tr><td> Доля аккаунта от общей $amount2</td>
<td>< 0.00001% из ".round($full_sp, 3)." общей $amount2</td></tr>";
} else {
echo "<tr><td> Доля аккаунта от общей $amount2</td>
<td>".round($account_shares_progress, 5)."% из ".round($full_sp, 3)." общей $amount2</td></tr>";
 }
echo "<tr><td>Баланс $amount1</td>
<td>$chain_balance</td>
</tr>";
if ($chain != 'WLS' && $chain != 'viz') {
echo "<tr><td>Баланс в $amount3</td>
<td>$sbd_balance</td>
</tr>
<tr><td>В сейфе $amount1</td>
<td>$savings_balance</td>
</tr>
<tr><td>$amount3 в сейфе</td>
<td>$savings_sbd_balance</td>
</tr>
<tr><td>Вывод токенов из сейфа</td>
<td>$savings_withdraw_requests</td></tr>";
}
if ($chain == 'WLS'or $chain == 'steem') {
echo "<tr><td>Ожидающая получения награда (перейдите в <a href='https://".$client."/@".$array_url[1]."/transfers' target='blank'>кошелёк</a> и нажмите на кнопку 'Получить вознаграждение')</td>
<td>";
if (isset($reward_vesting_steem) and $reward_vesting_steem > 0) {
echo "$reward_vesting_steem $amount2";
} else if (isset($reward_sbd_balance) and $reward_sbd_balance > 0) {
echo "$reward_sbd_balance $amount3";
} else if (isset($reward_steem_balance) and $reward_steem_balance > 0) {
echo "$reward_steem_balance $amount1";
} else {
echo 'Текущих вознаграждений, требующих получения, нет.';
}
echo "</td>
</tr>";
} else { }
if ($chain != 'viz') {
echo "<tr><td>Репутация</td>
<td>$rep</td>
</tr>";
}
echo "<tr>
<td>Логин</td>
<td><a href='https://".$client."/@$name' target='_blank'>$name</a></td>
</tr>";
if ($chain == 'viz') {
echo "<tr>
<td>Номер последней Custom операции (custom_sequence)</td>
<td>$custom_sequence</td>
</tr>
<tr>
<td>Номер последнего блока, содержащего custom операцию</td>
<td><a href='https://viz.world/tools/blocks/$custom_sequence_block_num/' target='_blank'>$custom_sequence_block_num</a></td>
</tr>";
 }
echo "<tr>
<td>Отображаемое в профиле имя</td>
<td>$profile_name</td>
</tr>
<tr>
<td>Описание аккаунта/блога</td>
<td>".($profile_about ?? $profile_about ?? "")."</td>
</tr>
<tr>
<td>Местоположение</td>
<td>".($profile_location ?? $profile_location ?? "")."</td>
</tr>
<tr>";
if ( isset($profile_image) ) {
echo "<td>Изображение профиля</td>
<td><img src='$profile_image' width='130px' height='auto' alt='Изображение профиля' /></td>
</tr>";
}
if ($chain != 'viz') {
echo "<tr><td>Количество подписчиков</td>
<td>".($followcount_mass['follower_count'] ?? $followcount_mass['follower_count'] ?? "")."</td></tr>
<tr><td>Подписался на блогов</td>
<td>".($followcount_mass['following_count'] ?? $followcount_mass['following_count'] ?? "")."</td></tr>";
}
echo "<tr>
<td>Сайт</td>";
if (isset($profile_website)) {
echo "<td><a href='$profile_website' target='_blank'>$profile_website</a></td>";
} else {
echo "<td></td>";
}

echo "</tr>
<tr>
<td>Создан</td>
<td>$created</td>
</tr>
<tr>
<td>Последнее обновление аккаунта</td>
<td>$last_account_update</td>
</tr>
<tr>
<td>Аккаунт-регистратор (С его помощью можно восстановить ваш аккаунт, он вас зарегистрировал в блокчейне)</td>
<td>$recovery_account</td>
</tr>
<tr>
<td>Количество опубликованных постов</td>
<td>$post_count</td>
</tr>
<tr>
<td>Время последнего голоса (Апвота или флага)</td>
<td>$last_vote_time1</td>
</tr>
<tr>
<td>Последний пост</td>
<td>$last_post</td>
</tr>";
if ($array_url[2] == 'golos') {
    echo "<tr><td>Количество постов, которое можно опубликовать без штрафа</td>";
    if ($post_full_date > 86400) {
    echo "<td>4</td>";
    } else {
    $delta_time = $post_full_date;
    $minutes_per_day = 24 * 60 * 60;
    $New_post_bandwidth = (($minutes_per_day - $delta_time) / $minutes_per_day * $datas['post_bandwidth']) + 10000;
    if ($New_post_bandwidth <=20000) {
        $shtraf_time = $minutes_per_day - ((0 + 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
        echo "<td>3. 4 станет через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    } else if ($New_post_bandwidth > 20000 and $New_post_bandwidth <=30000) {
        $shtraf_time = $minutes_per_day - ((20000 - 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
        echo "<td>2. 3 станет через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    } else if ($New_post_bandwidth > 30000 and $New_post_bandwidth <=40000) {
        $shtraf_time = $minutes_per_day - ((30000 - 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
        echo "<td>1. 2 станет через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    } else if ($New_post_bandwidth > 40000) {
    $shtraf_time = $minutes_per_day - ((40000 - 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
    echo "<td>0. Опубликовать пост без штрафа возможно через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    }
    
    }
    echo "</tr>";
}
        echo "</table>";
    } else {
    echo '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$array_url[1].'</p>';
     }
    }
    ?>