<?php
global $conf;
use GrapheneNodeClient\Tools\Reputation;

require 'snippets/get_account.php';
require 'snippets/get_account_balances.php';
require 'snippets/get_dynamic_global_properties.php';
require 'snippets/get_chain_properties.php';
require 'snippets/get_config.php';
require 'snippets/get_ticker.php';
require 'snippets/get_follow_count.php';


$content = '';
$res = $command->execute($commandQuery); 
$mass = $res['result'];
if( isset(pageUrl()[2]) && isset($mass) && count($mass) > 0){ // проверяем существование элемента

 if($mass == true){
 
 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];
 $ticker_res = $ticker_command->execute($ticker_commandQuery); 
 $ticker_mass = $ticker_res['result'];
 $ticker_price = $ticker_mass['latest1'];
 
 $followcount_res = $followcount_command->execute($followcount_commandQuery); 
 $followcount_mass = $followcount_res['result'];
 $config_res = $config_command->execute($config_commandQuery); 
 $config_mass = $config_res['result'];
 $chain_res = $chain_command->execute($chain_commandQuery); 

 $chain_mass = $chain_res['result'];

  // Расчет steem_per_vests
    $tvfs = (float)$mass3['total_vesting_fund_steem'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация VESTS в STEEM POWER
$sp = (float)$mass[0]['vesting_shares'] / 1000000 * $steem_per_vests;
$delegated_sp = (float)$mass[0]['received_vesting_shares'] / 1000000 * $steem_per_vests;
$un_delegating_sp = (float)$mass[0]['delegated_vesting_shares'] / 1000000 * $steem_per_vests;
$delegating_sp = round($un_delegating_sp, 3);
$vesting_withdraw_rate = (float)$mass[0]['vesting_withdraw_rate'] / 1000000 * $steem_per_vests;
$minus_shares = (float)$delegated_sp - (float)$delegating_sp;
$all_shares = $minus_shares + (float)$sp;


date_default_timezone_set('UTC');
$server_time = time();

$uia = balances($user);

$content .=  '<h2><a name="contents">Оглавление</a></h2>
<nav><ul><li><a href="#data1">Экономика</a></li>
<li><a href="#data12">UIA активы</a></li>
<li><a href="#data2">Профиль</a></li>
<li><a href="#data3">Статистика</a></li></ul></nav>
<h2><a name="data1">Экономика</a></h2>';
$datas = $mass[0];
 $name = $datas['name'];
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
$socials = '';
if (isset($json_metadata['profile']['vk']) && $json_metadata['profile']['vk'] != '') $socials .= '<a href="https://vk.com/'.$json_metadata['profile']['vk'].'" target="_blank">Вконтакте</a> ';
    if (isset($json_metadata['profile']['facebook']) && $json_metadata['profile']['facebook'] != '') $socials .= '<a href="https://www.facebook.com/'.$json_metadata['profile']['facebook'].'" target="_blank">Facebook</a> ';
        if (isset($json_metadata['profile']['instagram']) && $json_metadata['profile']['instagram'] != '') $socials .= '<a href="https://www.instagram.com/'.$json_metadata['profile']['instagram'].'" target="_blank">Instagram</a> ';
            if (isset($json_metadata['profile']['twitter']) && $json_metadata['profile']['twitter'] != '') $socials .= '<a href="https://twitter.com/'.$json_metadata['profile']['twitter'].'" target="_blank">Twitter</a> ';
                if (isset($json_metadata['profile']['telegram']) && $json_metadata['profile']['telegram'] != '') $socials .= '<a href="https://t.me/'.$json_metadata['profile']['telegram'].'" target="_blank">Telegram</a> ';
                    if (isset($json_metadata['profile']['skype']) && $json_metadata['profile']['skype'] != '') $socials .= '<a href="skype://'.$json_metadata['profile']['skype'].'" target="_blank">Skype</a> ';
                        if (isset($json_metadata['profile']['whatsapp']) && $json_metadata['profile']['whatsapp'] != '') $socials .= '<a href="whatsapp://'.$json_metadata['profile']['whatsapp'].'" target="_blank">Whatsapp</a> ';
                            if (isset($json_metadata['profile']['viber']) && $json_metadata['profile']['viber'] != '') $socials .= '<a href="viber://'.$json_metadata['profile']['viber'].'" target="_blank">Viber</a>';
                        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$last_account_update1 = $datas['last_account_update'];
$last_account_update2 = strtotime($last_account_update1);
$month1 = date('m', $last_account_update2);
$last_account_update = date('d', $last_account_update2).' '.$month[$month1].' '.date('Y г. H:i:s', $last_account_update2);


$created1 = $datas['created'];
 $created2 = strtotime($created1);
$month2 = date('m', $created2);
$created = date('d', $created2).' '.$month[$month2].' '.date('Y г. H:i:s', $created2);
$follower_count = isset($followcount_mass['follower_count']) ? $followcount_mass['follower_count'] : "";
$following_count = isset($followcount_mass['following_count']) ? $followcount_mass['following_count'] : "";
$reputation = $datas['reputation'];
if ($reputation == 0) {
$rep2 = 'нет';
} else {
 $rep2 = Reputation::calculate($reputation);
}
 $rep = round($rep2, 3);

 $recovery_account = $datas['recovery_account'];
 $last_vote_time = $datas['last_vote_time'];
$last_vote_time2 = strtotime($last_vote_time);
$month3 = date('m', $last_vote_time2);
$last_vote_time1 = date('d', $last_vote_time2).' '.$month[$month3].' '.date('Y г. H:i:s', $last_vote_time2);
$post_count = $datas['post_count'];
$last_post1 = $datas['last_post'];
$last_post2 = strtotime($last_post1);
$month4 = date('m', $last_post2);
$last_post = date('d', $last_post2).' '.$month[$month4].' '.date('Y г. H:i:s', $last_post2);
$post_full_date = $server_time - strtotime($datas['last_post']);

 $chain_balance = $datas['balance'];
$sbd_balance = $datas['sbd_balance'];
$savings_balance = $datas['savings_balance'];
$savings_sbd_balance = $datas['savings_sbd_balance']; 
$savings_withdraw_requests = $datas['savings_withdraw_requests'] === 0 ? 'да' : 'нет';
$next_vesting_withdrawal1 = $datas['next_vesting_withdrawal'];
$next_vesting_withdrawal2 = strtotime($next_vesting_withdrawal1);
$month6 = date('m', $next_vesting_withdrawal2);
$next_vesting_withdrawal = date('d', $next_vesting_withdrawal2).' '.$month[$month6].' '.date('Y г. H:i:s', $next_vesting_withdrawal2);
$accumulative_balance = $datas['accumulative_balance'];
$tip_balance = $datas['tip_balance'];

$current_time = strtotime($mass3['time']) * 1000;
$last_vote_seconds = strtotime($last_vote_time) * 1000;
$fastpower = 10000/$config_mass['STEEMIT_VOTE_REGENERATION_SECONDS'];
    $fast_power = round($fastpower, 5);
$volume_not = ($datas['voting_power']+(($current_time-$last_vote_seconds)/1000)*$fast_power)/100; //расчет текущей Voting Power
$volume = round($volume_not, 2); // Округление до двух знаков после запятой
 
if ($volume>=100) {
$charge = min($volume, 100);
}
else {
	$charge=$volume;
}
}
$volume_estimate =($datas['voting_power']+(($current_time-$last_vote_seconds)/1000)*$fast_power);//расчет текущей Voting Power
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
$account["golos_power"] = $all_shares;
$vesting_shares = (int)1e6 * $account["golos_power"] / $golos_per_vests;
$max_vote_denom = $chain_mass["vote_regeneration_per_day"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
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

if ($datas['proxied_vsf_votes'][0] != 0) {
$proxied_vsf_votes = $datas['proxied_vsf_votes'][0]/1000000;
$proxied_gpsf_votes = round($proxied_vsf_votes*$tvfs/$tvsh, 3);
$proxy_shares = round($proxied_gpsf_votes, 3);
}

$content .=  "<table><tr>
<th>Название</th>
<th>Значение</th>
</tr>
<tr>
<td>🔋 Актуальная батарейка</td>
<td>$charge%</td>
</tr>";
if ($fast_power == '0.11574') {
    $do100 = "$n_chas $chas_word, $n_minute $minute_word, $n_second $second_word";
    } else if ($fast_power == '0.02315') {
    $do100 = ($n_days ?? $n_days ?? "")." ".($days_word ?? $days_word ?? "")." $n_chas $chas_word, $n_minute $minute_word, $n_second $second_word";
    }
$content .=  "<tr><td>100% батарейка</td>
<td>Будет $power_minus (осталось $do100)</td></tr>
<tr><td>Личная СГ</td>
<td>".round($sp, 3)." GOLOS</td>
</tr>";
if ($delegated_sp > 0) {
$content .= '<tr><td>Получено в пользование Силы Голоса</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/delegations.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=received">'.round($delegated_sp, 3).'</a> GOLOS</td>
</tr>';
}
if ($vesting_withdraw_rate > 0) {
$content .=  "<tr><td>Сумма вывода из Силы Голоса</td>
<td>".round($vesting_withdraw_rate, 3)." GOLOS</td>
</tr>
<tr><td>Следующий вывод</td>
<td>$next_vesting_withdrawal</td></tr>";
}
if ($delegating_sp > 0) {
$content .=  '<tr><td>Делегировано СГ другим аккаунтам</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/delegations.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=delegated">'.round($delegating_sp, 3).'</a> GOLOS</td></tr>';
}
if ($datas['proxied_vsf_votes'][0] != 0) {
    $content .=  "<tr><td>Прокси СГ для голосования за делегатов</td>
    <td>$proxy_shares Ƶ</td></tr>";
}
    $content .=  "<tr><td>Итоговое количество СГ, влияющее на силу апвоута</td>
    <td>".round($all_shares, 3)." GOLOS</td></tr>";
    if ($dasdas_gbg == 0) {
        $content .= "<tr><td>Прогнозируемая стоимость апвоута при текущей батарейке (При 100%)</td>
    <td>$dasdas_golos GOLOS ($fixx_golos GOLOS)</td></tr>";
    } else {
        $content .= "<tr><td>Прогнозируемая стоимость апвоута при текущей батарейке (При 100%), GBG по курсу продажи GOLOS</td>
    <td>$dasdas_golos GOLOS, $dasdas_gbg GBG ($fixx_golos GOLOS, $fixx_gbg GBG)</td></tr>";
    }
    $full_sp = $tvsh / 1000000 * $steem_per_vests;
$account_shares_progress = ($all_shares/$full_sp)*100;
if ($account_shares_progress < 0.0001) {
$content .=  "<tr><td>Доля аккаунта от всей СГ в блокчейне</td>
<td>< 0.00001% из ".round($full_sp, 3)."</td></tr>";
} else {
$content .=  "<tr><td>Доля аккаунта от всей Силы Голоса в блокчейне</td>
<td>".round($account_shares_progress, 5)."% из ".round($full_sp, 3)."</td></tr>";
 }
if (isset($json_metadata['profile']['select_tags'])) {
 $interests = implode($json_metadata['profile']['select_tags'], ', ');
}
 $content .= '<tr><td>Баланс GOLOS</td>
<td>'.$chain_balance.'</td>
</tr>
<tr><td>Баланс GBG</td>
<td>'.$sbd_balance.'</td>
</tr>';
if ($accumulative_balance !== '0.000 GOLOS') {
    $content .= '<tr><td>Баланс наград вестинга</td>
    <td>'.$accumulative_balance.'</td>';
}
if ($tip_balance !== '0.000 GOLOS') {
    $content .= '<tr><td>Баланс донатов</td>
<td>'.$tip_balance.'</td>';
}
if ($savings_balance !== '0.000 GOLOS') {
$content .= "<tr><td>GOLOS в сейфе</td>
<td>$savings_balance</td>
</tr>";
}
if ($savings_sbd_balance !== '0.000 GBG') {
$content .= "<tr><td>GBG в сейфе</td>
<td>$savings_sbd_balance</td>
</tr>";
}
if ($savings_withdraw_requests > 0) {
    $content .= "<tr><td>Вывод токенов из сейфа</td>
    <td>$savings_withdraw_requests</td></tr>";
}
$content .=  '<tr>
<td>Голосов за делегатов</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/delegat.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'">'.$datas['witnesses_voted_for'].'</a></td></tr>
</table>
<p align="center"><a href="#contents">К меню</a></p>
<h2><a name="data12">UIA активы</a></h2>';
if ($uia != false) {
    $content .= '<table><thead><tr><th>Название</th><th>Основной баланс</th><th>TIP-баланс</th></tr></thead></tbody>';
    foreach ($uia as $token => $balances) {
    $content .= '<tr>
    <td>'.$token.'</td>
    <td>'.$balances['balance'].'</td>
    <td>'.$balances['tip_balance'].'</td>
    </tr>';
    }
$content .= '</tbody></table>';
} else {
    $content .= '<p><br>
У этого аккаунта нет UIA активов, которые он когда-либо получал.<br>
</p>';
}
$content .= '<p align="center"><a href="#contents">К меню</a></p>
<h2><a name="data2">Профиль</a></h2>
<table><tr><th>Название</th><th>Значение</th></tr>
<tr>
<td>Отображаемое в профиле имя</td>
<td>'.$profile_name.'</td>
</tr>
<tr>
<td>Описание аккаунта</td>
<td>'.($profile_about ?? $profile_about ?? "").'</td>
</tr>
<tr>
<td>Местоположение</td>
<td>'.($profile_location ?? $profile_location ?? "").'</td>
</tr>';
if (isset($interests)) {
    $content .= '<tr><td>Выбранные теги</td>
<td>'.$interests.'</td></tr>';
}
$content .= '<tr><td>Социальные сети</td>
<td>'.$socials.'</td></tr>';
if ( isset($profile_image) ) {
$content .= "<tr>
<td>Изображение профиля</td>
<td><img src='$profile_image' width='130px' height='auto' alt='Изображение профиля' /></td>
</tr>";
}
if (isset($profile_website)) {
$content .=  "<tr>
<td>Сайт</td>
<td><a href='$profile_website' target='_blank'>$profile_website</a></td>
</tr>";
}
$content .= '</table>
<p align="center"><a href="#contents">К меню</a></p>
<h2><a name="data3">Статистика аккаунта</a></h2>
<table><tr><th>Название</th><th>Значение</th></tr>
<tr><td>Количество постов, которое можно опубликовать без штрафа</td>';
    if ($post_full_date > 86400) {
        $content .= "<td>4</td>";
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
    $content .= "<td>3. 4 станет через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    } else if ($New_post_bandwidth > 20000 and $New_post_bandwidth <=30000) {
        $shtraf_time = $minutes_per_day - ((20000 - 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
    $content .= "<td>2. 3 станет через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    } else if ($New_post_bandwidth > 30000 and $New_post_bandwidth <=40000) {
        $shtraf_time = $minutes_per_day - ((30000 - 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
    $content .= "<td>1. 2 станет через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    } else if ($New_post_bandwidth > 40000) {
    $shtraf_time = $minutes_per_day - ((40000 - 10000) / ($New_post_bandwidth - 10000)) * $minutes_per_day;
    $post_bandwidth_ours = date("G", $shtraf_time);
    $post_bandwidth_chas_word = getWord($post_bandwidth_ours, $array_chas);
    $post_bandwidth_minute = date("i", $shtraf_time);
    $post_bandwidth_minute_words = getWord($post_bandwidth_minute, $array_minutes);
    $post_bandwidth_seconds = date("s", $shtraf_time);
    $post_bandwidth_second_word = getWord($post_bandwidth_seconds, $array_seconds);
    $content .= "<td>0. Опубликовать пост без штрафа возможно через ".date("G $post_bandwidth_chas_word, i $post_bandwidth_minute_words, s $post_bandwidth_second_word", $shtraf_time)."</td>";
    }
    
    }
    $content .= '</tr>
<tr>
<td>Создан</td>
<td>'.$created.'</td>
</tr>
<tr>
<td>Последнее обновление аккаунта</td>
<td>'.$last_account_update.'</td>
</tr>
<tr><td>Репутация</td>
<td>'.$rep.'</td></tr>
<tr><td>Количество подписчиков</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/followers.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=followers">'.$follower_count.'</a></td></tr>
<tr><td>Подписался на блогов</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/followers.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=followings">'.$following_count.'</a></td></tr>
<tr>
<td>Аккаунт-регистратор (С его помощью можно восстановить ваш аккаунт, он вас зарегистрировал в блокчейне)</td>
<td><a href="'.$conf['siteUrl'].'golos/profiles/'.$recovery_account.'" target="_blank">'.$recovery_account.'</a></td>
</tr>';
if (isset($post_count) && $post_count > 0) {
$content .= "<tr>
<td>Количество опубликованных постов</td>
<td>$post_count</td>
</tr>";
}
$content .= '<tr>
<td>Время последнего апвоута или флага</td>
<td>'.$last_vote_time1.'</td>
</tr>
<tr>
<td>Последний пост</td>
<td>'.$last_post.'</td>
</tr>
</table>
<p align="center"><a href="#contents">К меню</a></p>';
return $content;
} else {
    $content .=  '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
    return $content;
}
		?>