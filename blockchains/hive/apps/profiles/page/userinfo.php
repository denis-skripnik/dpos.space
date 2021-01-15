<?php
global $conf;
use GrapheneNodeClient\Tools\Reputation;

require 'snippets/get_account.php';
require 'snippets/get_dynamic_global_properties.php';
require 'snippets/get_chain_properties.php';
require 'snippets/get_config.php';
require 'snippets/get_ticker.php';
require 'snippets/get_follow_count.php';
require 'snippets/getRewardFund.php';

$content = '';
$res = $command->execute($commandQuery); 
$mass = $res['result'];

if( isset(pageUrl()[2]) && isset($mass) && count($mass) > 0){ // проверяем существование элемента

 if($mass == true){
 
 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];
 $ticker_res = $ticker_command->execute($ticker_commandQuery); 
 $ticker_mass = $ticker_res['result'];
 $ticker_price = $ticker_mass['latest'];
 $followcount_res = $followcount_command->execute($followcount_commandQuery); 
 $followcount_mass = $followcount_res['result'];
 $config_res = $config_command->execute($config_commandQuery); 
 $config_mass = $config_res['result'];
 $chain_res = $chain_command->execute($chain_commandQuery); 
 $chain_mass = $chain_res['result'];

 $RewardFund_res = $RewardFund_command->execute($RewardFund_commandQuery);
 $RewardFund_mass = $RewardFund_res['result'];
  
 // Расчет hive_per_vests
    $tvfs = (float)$mass3['total_vesting_fund_hive'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $hive_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация VESTS в Hive Power
$HP = (float)$mass[0]['vesting_shares'] / 1000000 * $hive_per_vests;
$delegated_HP = (float)$mass[0]['received_vesting_shares'] / 1000000 * $hive_per_vests;
$un_delegating_HP = (float)$mass[0]['delegated_vesting_shares'] / 1000000 * $hive_per_vests;
$delegating_HP = round($un_delegating_HP, 3);
$vesting_withdraw_rate = (float)$mass[0]['vesting_withdraw_rate'] / 1000000 * $hive_per_vests;
$minus_shares = (float)$delegated_HP - (float)$delegating_HP;
$all_shares = $minus_shares + (float)$HP;


date_default_timezone_set('UTC');
$server_time = time();

$content .=  '<h2><a name="contents">Оглавление</a></h2>
<nav><ul><li><a href="#data1">Экономика</a></li>
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
$sbd_balance = $datas['hbd_balance'];
$savings_balance = $datas['savings_balance'];
$savings_sbd_balance = $datas['savings_hbd_balance']; 
$savings_withdraw_requests = $datas['savings_withdraw_requests'] === 0 ? 'да' : 'нет';
$next_vesting_withdrawal1 = $datas['next_vesting_withdrawal'];
$next_vesting_withdrawal2 = strtotime($next_vesting_withdrawal1);
$month6 = date('m', $next_vesting_withdrawal2);
$next_vesting_withdrawal = date('d', $next_vesting_withdrawal2).' '.$month[$month6].' '.date('Y г. H:i:s', $next_vesting_withdrawal2);
$current_time = strtotime($mass3['time']) * 1000;
$last_vote_seconds = strtotime($last_vote_time) * 1000;
$fastpower = 10000/$config_mass['HIVE_VOTING_MANA_REGENERATION_SECONDS'];
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
$hive_a = $tvfs / $tvsh;
$hive_n = 100; // vote_vait;
$hive_r = $HP / $hive_a;
$hive_m2 = 100 * $charge * (100 * $hive_n) / 10000;
$hive_m = ($hive_m2 + 49) / 50;
$fixx_hive_m2 = 100 * 100 * (100 * $hive_n) / 10000;
$fixx_hive_m = ($fixx_hive_m2 + 49) / 50;
$rewa = $RewardFund_mass['reward_balance'];
$recent = $RewardFund_mass['recent_claims'];
$hive_i = (float)$rewa / (float)$recent;
$dasdas_hive = round($hive_r * $hive_m * 100 * $hive_i, 3);
$dasdas_HBD = round($hive_r * $hive_m * 100 * $hive_i * $ticker_price, 3);
$fixx_hive = round($hive_r * $fixx_hive_m * 100 * $hive_i, 3);
$fixx_HBD = round($hive_r * $fixx_hive_m * 100 * $hive_i * $ticker_price, 3);

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
<tr><td>Личная HP</td>
<td>".round($HP, 3)." HIVE</td>
</tr>";
if ($delegated_HP > 0) {
$content .= '<tr><td>Получено в пользование Hive Power</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/delegations.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=received">'.round($delegated_HP, 3).'</a> HIVE</td>
</tr>';
}
if ($vesting_withdraw_rate > 0) {
$content .=  "<tr><td>Сумма вывода из Hive Power</td>
<td>".round($vesting_withdraw_rate, 3)." HIVE</td>
</tr>
<tr><td>Следующий вывод</td>
<td>$next_vesting_withdrawal</td></tr>";
}
if ($delegating_HP > 0) {
$content .=  '<tr><td>Делегировано HP другим аккаунтам</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/delegations.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=delegated">'.round($delegating_HP, 3).'</a> HIVE</td></tr>';
}
if ($datas['proxied_vsf_votes'][0] != 0) {
    $content .=  "<tr><td>Прокси HP для голосования за делегатов</td>
    <td>$proxy_shares Ƶ</td></tr>";
}
    $content .=  "<tr><td>Итоговое количество HP, влияющее на силу апвота</td>
    <td>".round($all_shares, 3)." HIVE</td></tr>";
    if ($dasdas_HBD == 0) {
        $content .= "<tr><td>Прогнозируемая стоимость апвота при текущей батарейке (При 100%)</td>
    <td>$dasdas_hive HIVE ($fixx_hive HIVE)</td></tr>";
    } else {
        $content .= "<tr><td>Прогнозируемая стоимость апвота при текущей батарейке (При 100%), HBD по курсу продажи HIVE</td>
    <td>$dasdas_hive HIVE, $dasdas_HBD HBD ($fixx_hive HIVE, $fixx_HBD HBD)</td></tr>";
    }
    $full_HP = $tvsh / 1000000 * $hive_per_vests;
$account_shares_progress = ($all_shares/$full_HP)*100;
if ($account_shares_progress < 0.0001) {
$content .=  "<tr><td>Доля аккаунта от всей HP в блокчейне</td>
<td>< 0.00001% из ".round($full_HP, 3)."</td></tr>";
} else {
$content .=  "<tr><td>Доля аккаунта от всего соц. капитала в блокчейне</td>
<td>".round($account_shares_progress, 5)."% из ".round($full_HP, 3)."</td></tr>";
 }
if (isset($json_metadata['profile']['select_tags'])) {
 $interests = implode($json_metadata['profile']['select_tags'], ', ');
}
 $content .= '<tr><td>Баланс HIVE</td>
<td>'.$chain_balance.'</td>
</tr>
<tr><td>Баланс HBD</td>
<td>'.$sbd_balance.'</td>
</tr>';
if ($savings_balance !== '0.000 HIVE') {
$content .= "<tr><td>HIVE в сейфе</td>
<td>$savings_balance</td>
</tr>";
}
if ($savings_sbd_balance !== '0.000 HBD') {
$content .= "<tr><td>HBD в сейфе</td>
<td>$savings_sbd_balance</td>
</tr>";
}
if ($savings_withdraw_requests > 0) {
    $content .= "<tr><td>Вывод токенов из сейфа</td>
    <td>$savings_withdraw_requests</td></tr>";
}
$content .=  '<tr>
<td>Hiveов за делегатов</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/delegat.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'">'.$datas['witnesses_voted_for'].'</a></td></tr>
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
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/followers.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=followers">'.$follower_count.'</a></td></tr>
<tr><td>Подписался на блогов</td>
<td><a data-fancybox class="ajax_modal" data-src="#ajax_modal_content" href="javascript:;" data-url="'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/followers.php" data-params="user='.$user.'&siteUrl='.$conf['siteUrl'].'&type=followings">'.$following_count.'</a></td></tr>
<tr>
<td>Аккаунт-регистратор (С его помощью можно восстановить ваш аккаунт, он вас зарегистрировал в блокчейне)</td>
<td><a href="'.$conf['siteUrl'].'hive/profiles/'.$recovery_account.'" target="_blank">'.$recovery_account.'</a></td>
</tr>';
if (isset($post_count) && $post_count > 0) {
$content .= "<tr>
<td>Количество опубликованных постов</td>
<td>$post_count</td>
</tr>";
}
$content .= '<tr>
<td>Время последнего апвота или флага</td>
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