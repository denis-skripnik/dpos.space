<?php
global $conf;
require 'snippets/get_account.php';
require 'snippets/get_dynamic_global_properties.php';
require 'snippets/get_chain_properties.php';
require 'snippets/get_config.php';
function calculateBandwidth($ost, $p) {
    $types = ["byte", "Kb", "Mb", "Gb", "Tb"];
    $counter = 0;
    while ($ost >= 1024) {
        $ost /= 1024;
$counter++;
}
$ost = round($ost, 3);
$new_p = round($p / (1024 ** ($counter)), 3);
if ($new_p > 0) {
$ost_percent = ($ost / $new_p) * 100;
if ($counter === 0) $counter = 1;
$return_str = 'Осталось '.$ost.' '.$types[$counter-1].' из '.$new_p.' '.$types[$counter-1].' ('.$ost_percent.'%)';
} else {
    $ost_percent = 0;
    $return_str = 'Осталось '.$ost.' '.$types[0].' из '.$new_p.' '.$types[0].' ('.$ost_percent.'%)';}
return $return_str;
}

$content = '';
$res = $command->execute($commandQuery); 
$mass = $res['result'];

if( isset(pageUrl()[2]) && isset($mass) && count($mass) > 0){ // проверяем существование элемента

 if($mass == true){
 
 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];
 $config_res = $config_command->execute($config_commandQuery); 
 $config_mass = $config_res['result'];

 $props_res = $chain_command->execute($chain_commandQuery); 
 $props_mass = $props_res['result'];
$vote_accounting_min_viz = $props_mass['vote_accounting_min_rshares'] / 1000000;


  // Расчет steem_per_vests
    $tvfs = (float)$mass3['total_vesting_fund'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация VESTS в STEEM POWER
$sp = (float)$mass[0]['vesting_shares'] / 1000000 * $steem_per_vests;
$delegated_sp = (float)$mass[0]['received_vesting_shares'] / 1000000 * $steem_per_vests;
$un_delegating_sp = (float)$mass[0]['delegated_vesting_shares'] / 1000000 * $steem_per_vests;
$delegating_sp = round($un_delegating_sp, 3);
$vesting_withdraw_rate = (float)$mass[0]['vesting_withdraw_rate'] / 1000000 * $steem_per_vests;


date_default_timezone_set('UTC');
$server_time = time();

$content .=  '<h2><a name="contents">Оглавление</a></h2>
<nav><ul><li><a href="#data1">Экономика</a></li>
<li><a href="#data2">Профиль</a></li>
<li><a href="#data3">Статистика</a></li></ul></nav>
<h2><a name="data1">Экономика</a></h2>';
$datas = $mass[0];
 $name = $datas['name'];
 $custom_sequence = $datas['custom_sequence'];
$custom_sequence_block_num = $datas['custom_sequence_block_num'];
$json_metadata = json_decode($datas['json_metadata'], true);
if (isset($json_metadata['profile']['nickname'])) {
$profile_name = $json_metadata['profile']['nickname'];
} else {
$profile_name = $name;
}
$profile_about = ($json_metadata['profile']['about'] ?? "");
$profile_location = ($json_metadata['profile']['location'] ?? "");
$profile_image = ($json_metadata['profile']['profile_image'] ?? "");
$profile_website = ($json_metadata['profile']['site'] ?? "");
$profile_birthday = '';
if (isset($json_metadata['profile']['birthday'])) {
    $birthday = explode('.', $json_metadata['profile']['birthday']);
    $b_month = ['1' => 'января', '2' => 'февраля', '3' => 'марта', '4' => 'апреля', '5' => 'мая', '6' => 'июня', '7' => 'июля', '8' => 'августа', '9' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря'];
$b_year = ($birthday[2] ? ' '.$birthday[2] : "");
$profile_birthday = $birthday[0].' '.$b_month[$birthday[1]].$b_year;
}
$profile_social = ($json_metadata['profile']['services'] ?? "");
$socials = '';
if ($profile_social != '') {
if (isset($profile_social['vk']) && $profile_social['vk'] != '') $socials .= '<a href="https://vk.com/'.$profile_social['vk'].'" target="_blank">Вконтакте</a> ';
    if (isset($profile_social['facebook']) && $profile_social['facebook'] != '') $socials .= '<a href="https://www.facebook.com/'.$profile_social['facebook'].'" target="_blank">Facebook</a> ';
        if (isset($profile_social['instagram']) && $profile_social['instagram'] != '') $socials .= '<a href="https://www.instagram.com/'.$profile_social['instagram'].'" target="_blank">Instagram</a> ';
            if (isset($profile_social['twitter']) && $profile_social['twitter'] != '') $socials .= '<a href="https://twitter.com/'.$profile_social['twitter'].'" target="_blank">Twitter</a> ';
                if (isset($profile_social['telegram']) && $profile_social['telegram'] != '') $socials .= '<a href="https://t.me/'.$profile_social['telegram'].'" target="_blank">Telegram</a> ';
                    if (isset($profile_social['skype']) && $profile_social['skype'] != '') $socials .= '<a href="skype://'.$profile_social['skype'].'" target="_blank">Skype</a> ';
                        if (isset($profile_social['whatsapp']) && $profile_social['whatsapp'] != '') $socials .= '<a href="whatsapp://'.$profile_social['whatsapp'].'" target="_blank">Whatsapp</a> ';
                            if (isset($profile_social['viber']) && $profile_social['viber'] != '') $socials .= '<a href="viber://'.$profile_social['viber'].'" target="_blank">Viber</a>';
                        }
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
 $last_vote_time = $datas['last_vote_time'];
$last_vote_time2 = strtotime($last_vote_time);
$month3 = date('m', $last_vote_time2);
$last_vote_time1 = date('d', $last_vote_time2).' '.$month[$month3].' '.date('Y г. H:i:s', $last_vote_time2);

$chain_balance = $datas['balance'];
$next_vesting_withdrawal1 = $datas['next_vesting_withdrawal'];
$next_vesting_withdrawal2 = strtotime($next_vesting_withdrawal1);
$month6 = date('m', $next_vesting_withdrawal2);
$next_vesting_withdrawal = date('d', $next_vesting_withdrawal2).' '.$month[$month6].' '.date('Y г. H:i:s', $next_vesting_withdrawal2);


$current_time = strtotime($mass3['time']) * 1000;
$last_vote_seconds = strtotime($last_vote_time) * 1000;
    $fastpower = 10000/$config_mass['CHAIN_ENERGY_REGENERATION_SECONDS'];
$fast_power = round($fastpower, 5);
    $volume_not = ($datas['energy']+(($current_time-$last_vote_seconds)/1000)*$fast_power)/100; //расчет текущей Voting Power
$volume = round($volume_not, 2); // Округление до двух знаков после запятой
 
if ($volume>=100) {
$charge = min($volume, 100);
}
else {
	$charge=$volume;
}
}
    $volume_estimate =($datas['energy']+(($current_time-$last_vote_seconds)/1000)*$fast_power);//расчет текущей Voting Power
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
$minus_shares = (float)$mass[0]['received_vesting_shares'] - (float)$mass[0]['delegated_vesting_shares'];
$all_shares = $minus_shares + (float)$mass[0]['vesting_shares'];
    $total_vesting_fund = (float)$mass3["total_vesting_fund"];
    $total_vesting_shares = (float)$mass3["total_vesting_shares"];
      $total_reward_fund = (float)$mass3["total_reward_fund"];
    $total_reward_shares = (int)$mass3["total_reward_shares"];
    $shares = $sp;
    
$all_shares = ($sp ?? $sp ?? "")-($delegating_sp ?? $delegating_sp ?? "")+($delegated_sp ?? $delegated_sp ?? "");

$payout20 = $all_shares * 20 /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$payout20 = (int)$payout20 / 1000000;
if ($payout20 < 0.000001) {
    $payout20 = 'Меньше минимальной';
}

$payout100 = $all_shares * 100 /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$payout100 = (int)$payout100 / 1000000;
if ($payout100 < 0.000001) {
    $payout100 = 'Меньше минимальной';
}

if ($datas['proxied_vsf_votes'][0] != 0) {
$proxied_vsf_votes = $datas['proxied_vsf_votes'][0]/1000000;
$proxied_gpsf_votes = round($proxied_vsf_votes*$tvfs/$tvsh, 3);
$proxy_shares = round($proxied_gpsf_votes, 3);
}

$bold = (int)$datas['average_bandwidth'];
$w = 7*24*60*60; // сек в неделе.
$t = $current_time - (strtotime($datas['last_bandwidth_update']) * 1000);
$k = $mass3['current_reserve_ratio'];
$c = $mass3['bandwidth_reserve_candidates'];
$e = $mass3['max_virtual_bandwidth'];
$r = 0;
$all_mshares = $all_shares * 1000000;
$total_vesting_mshares = $total_vesting_shares * 1000000;
$s = $all_mshares * (100 - $r/100)/100;
$bnew = max(0, ($w - $t) * $bold / $w); //+ N
$p = $s/$total_vesting_mshares*$e;
$ost= $p-$bnew;
$bandwidth = calculateBandwidth($ost/1000000, $p/1000000);
if ($all_shares != 0){
    $min_energy = $vote_accounting_min_viz / $all_shares * 100;
} else {
    $min_energy = 100;
}
$min_energy = round($min_energy, 2);
if ($min_energy < 0.01) {
    $min_energy = 0.01.'%';
} else if ($min_energy > 100) {
    $min_energy = 'Аккаунт не может награждать при текущем количестве токенов в соц. капитале.';
} else {
    $min_energy_amount = $all_shares * $min_energy /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$min_energy_amount /= 1000000;
$min_energy_amount = round($min_energy_amount, 3).' VIZ';
$min_energy .= '% ('.$min_energy_amount.')';
}

$content .=  "<table><tr>
<th>Название</th>
<th>Значение</th>
</tr>
<tr>
<td>Актуальная энергия</td>
<td>$charge%</td>
</tr>";
if ($fast_power == '0.11574') {
    $do100 = "$n_chas $chas_word, $n_minute $minute_word, $n_second $second_word";
    } else if ($fast_power == '0.02315') {
    $do100 = ($n_days ?? $n_days ?? "")." ".($days_word ?? $days_word ?? "")." $n_chas $chas_word, $n_minute $minute_word, $n_second $second_word";
    }
$content .=  "<tr><td>100% энергии</td>
<td>Будет $power_minus (осталось $do100)</td></tr>
<tr><td>Пропускная способность аккаунта</td>
<td>$bandwidth</td></tr>
<tr><td>Личный социальный капитал</td>
<td>".round($sp, 3)." Ƶ</td>
</tr>";
if ($delegated_sp > 0) {
$content .= '<tr><td>Получено в пользование соц. капитала</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/delegations.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=received">'.round($delegated_sp, 3).'</a> Ƶ</td>
</tr>';
}
if ($vesting_withdraw_rate > 0) {
$content .=  "<tr><td>Сумма вывода из соц. капитала</td>
<td>".round($vesting_withdraw_rate, 3)." Ƶ</td>
</tr>
<tr><td>Следующий вывод</td>
<td>$next_vesting_withdrawal</td></tr>";
}
if ($delegating_sp > 0) {
$content .=  '<tr><td>Делегировано социального капитала другим аккаунтам</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/delegations.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=delegated">'.round($delegating_sp, 3).'</a> Ƶ</td></tr>';
}
if ($datas['proxied_vsf_votes'][0] != 0) {
    $content .=  "<tr><td>Прокси соц. капитал для голосования за делегатов</td>
    <td>$proxy_shares Ƶ</td></tr>";
}
$content .=  "<tr><td>Итоговая сумма соцкапитала, влияющая на силу наград</td>
    <td>".round($all_shares, 3)." Ƶ</td></tr>
<tr><td>Минимальный процент энергии для награждения</td>
<td>$min_energy</td> </tr>";
if ($min_energy != 'Аккаунт не может награждать при текущем количестве токенов в соц. капитале.') {
    $content .= "<tr><td>Сумма награды при затрате 20% энергии (при 100%)</td>
    <td>$payout20 ($payout100)</td></tr>";
}
    $full_sp = $tvsh / 1000000 * $steem_per_vests;
$account_shares_progress = ($all_shares/$full_sp)*100;
if ($account_shares_progress < 0.0001) {
$content .=  "<tr><td>Доля аккаунта от всего соц. капитала в блокчейне</td>
<td>< 0.00001% из ".round($full_sp, 3)."</td></tr>";
} else {
$content .=  "<tr><td>Доля аккаунта от всего соц. капитала в блокчейне</td>
<td>".round($account_shares_progress, 5)."% из ".round($full_sp, 3)."</td></tr>";
 }
if (isset($json_metadata['profile']['interests'])) {
 $interests = implode($json_metadata['profile']['interests'], ', ');
}
 $content .= '<tr><td>Баланс VIZ</td>
<td>'.$chain_balance.' Ƶ</td>
</tr>
<tr>
<td>Голосов за делегатов</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/delegat.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'">'.$datas['witnesses_voted_for'].'</a></td></tr>
</table>
<p align="center"><a href="#contents">К меню</a></p>
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
</tr>
<tr><td>День рождения</td>
<td>'.$profile_birthday.'</td></tr>';
if (isset($interests)) {
    $content .= '<tr><td>Интересы</td>
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
<tr>
<td>Создан</td>
<td>'.$created.'</td>
</tr>
<tr>
<td>Последнее обновление аккаунта</td>
<td>'.$last_account_update.'</td>
</tr>
<tr>
<td>Аккаунт-регистратор (С его помощью можно восстановить ваш аккаунт, он вас зарегистрировал в блокчейне)</td>
<td><a href="'.$conf['siteUrl'].'viz/profiles/'.$recovery_account.'" target="_blank">'.$recovery_account.'</a></td>
</tr>
<tr>
<td>Время последней награды</td>
<td>'.$last_vote_time1.'</td>
</tr>
<tr>
<td>Номер последней Custom операции (custom_sequence)</td>
<td>'.$custom_sequence.'</td>
</tr>
<tr>
<td>Номер последнего блока, содержащего custom операцию</td>
<td><a href="'.$conf['siteUrl'].'viz/explorer/block/'.$custom_sequence_block_num.'/" target="_blank">'.$custom_sequence_block_num.'</a></td>
</tr></table>
<p align="center"><a href="#contents">К меню</a></p>';
    } else {
    $content .=  '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
     }
        return $content;
		?>