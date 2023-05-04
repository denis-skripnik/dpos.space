<?php
require $_SERVER['DOCUMENT_ROOT'].'/helpers.php';

require 'snippets/get_discussions_by_blog.php';
require 'snippets/get_feed_history.php';
require 'snippets/get_dynamic_global_properties.php';
require 'snippets/get_config.php';
$result = [];

if( isset($user) ){ // проверяем существование элемента

 $res = $command->execute($commandQuery); 

 $mass = $res['result'];

 if($mass == true){
 
  $res3 = $command3->execute($commandQuery3); 

 $mass3 = $res3['result'];

 $feed_res = $feed_command->execute($feed_commandQuery); 
 $feed_mass = $feed_res['result'];

 $config_res = $config_command->execute($config_commandQuery); 

 $config_mass = $config_res['result'];

  // Расчет steem_per_vests
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  $steem_per_vests = 1000000 * $tvfs / $tvsh;
date_default_timezone_set('UTC');
$now_date = date("Y-m-d", mktime(0, 0, 0, date('m'), date('d') -7, date('Y')))."T".date("H:i:s", mktime(date('H'), date('i'), date('s')));
$WLS_this_date = time();
$base = (float)$feed_mass["current_median_history"]["base"];
    $quote = (float)$feed_mass["current_median_history"]["quote"];
   $median_price = round($base/$quote, 3);
$total_vesting_fund_steem = (float)$mass3["total_vesting_fund_steem"];
$total_reward_fund_steem = (float)$mass3["total_reward_fund_steem"];
$total_reward_shares2 = (int)$mass3["total_reward_shares2"];
$total_vesting_shares = (float)$mass3["total_vesting_shares"];
    $golos_per_vests = $total_vesting_fund_steem / $total_vesting_shares;
    $sbd_print_rate = $mass3['sbd_print_rate']/10000;
    $result['content'] = "<h2>Свежие посты аккаунта $user</h2>
  <table><tr><th>№</th>
<th>Название</th>
<th>До выплаты</th>
<th>Кураторские</th>
<th>Бенефициары</th>
<th>Прогнозируемые выплаты автору</th>
<th>Общая авторская выплата</th>
<th>Штраф</th>
<th>Сумма продвижения</th>
</tr>";
$post_list = array();
$summ_beneficiaries_pending = 0;
$summ_author_golos = 0;
$summ_author_sp = 0;
 $summ_author_gbg = 0;
 $full_summ_author_golos = 0;
$full_summ_author_sp = 0;
 $full_summ_author_gbg = 0;
 $summ_author_WLS = 0;
$full_summ_author_WLS = 0;
 $arr_curation_procent = array();
 $arr_shtraf_procent = array();
 $summ_curation_procent = 0;
 $summ_shtraf_procent = 0;
 $sum_num = 0;
 $sum_reblogs_num = 0;
 foreach ($mass as $num => $post) {
if ( isset($post) ){
 if ($post['created'] >= $now_date) {
$post_list[] = $post;

 $cashout_time = strtotime($post['cashout_time']);
$date_for_pay = $cashout_time - $WLS_this_date;
$day_for_pay = date("j", $date_for_pay);
$hours_for_pay = date("G", $date_for_pay);
$minutes_for_pay = date("i", $date_for_pay);
$array_chas = array("час", "часа", "часов");
$chas_word = getWord($hours_for_pay, $array_chas);
$array_minutes = array("минута", "минуты", "минут");
$minute_word = getWord($minutes_for_pay, $array_minutes);
$array_days = array("день", "дня", "дней");
$days_word = getWord($day_for_pay, $array_days).',';
$date_for_pay2 = date('j', $date_for_pay) -1;
$date_for_pay3 = date(" $days_word G $chas_word, i $minute_word", $date_for_pay);
$date_for_pay1 = $date_for_pay2.$date_for_pay3;
$post_number = $num + 1;

$result['content'] .= '<tr><td align="center">'.$post_number.'</td>';
if ($post['author'] == $user) {
  $result['content'] .= '<td><a href="https://golos.id'.$post['url'].'" target="_blank">'.$post['title'].'</a></td>';
$sum_num += 1;
} else {
  $result['content'] .= '<td><a href="https://golos.id'.$post['url'].'" target="_blank">'.$post['title'].'</a> (Репост от <a href="'.$conf['siteUrl'].'golos/profiles/'.$post['author'].'" target="_blank">@'.$post['author'].'</a>)</td>';
$sum_reblogs_num += 1;
}
$result['content'] .= '<td>'.$date_for_pay1.'</td>';
$sum_weight = 0;
foreach ($post['active_votes'] as $vote) {
  $sum_weight += $vote['weight'];
}
  $curation_procent = round($post['curation_rewards_percent']/100, 2);
  $result['content'] .= '<td>'.$curation_procent.'%</td>';
$arr_curation_procent[] = $curation_procent;
$summ_curation_procent = $summ_curation_procent + $curation_procent;
$pending_payout_value = (float)$post['pending_payout_value'];
$pending_golos = round($pending_payout_value / $median_price, 3);
$curation_pending = ($pending_golos/100)*$curation_procent;
$all_no_curations = round($pending_golos - $curation_pending, 3);

$all_beneficiaries = 0;
$beneficiaries_list = '';
foreach ($post['beneficiaries'] as $beneficiarie) {
$all_beneficiaries += $beneficiarie['weight'];
$beneficiarie_weight = $beneficiarie['weight']/100;
$beneficiaries_list .= $beneficiarie['account']." - ".$beneficiarie_weight."%  ";
}
$beneficiaries_procent = $all_beneficiaries/100;
$beneficiaries_pending = round(($all_no_curations/100)*$beneficiaries_procent, 3);
$result['content'] .= '<td>'.$beneficiaries_list.'('.$beneficiaries_pending.' СГ)</td>';
$summ_beneficiaries_pending = $summ_beneficiaries_pending + $beneficiaries_pending;
$full_author_pending = round($all_no_curations - $beneficiaries_pending, 3);
if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '10000') {
$author_sp = round($full_author_pending, 3);
} else if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '0') {
$author_sp = round($full_author_pending/2, 3);
} else if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '100') {
$author_sp = round($full_author_pending/1.1, 3);
}
$author_pending = round($full_author_pending - $author_sp, 3);

$author_gbg = round($author_pending*$median_price*$sbd_print_rate, 3);
$author_golos = round($author_pending - ($author_pending*$sbd_print_rate), 3);
$author_WLS = $author_sp*2;

  if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '0') {
    $result['content'] .= "<td>$author_golos GOLOS, $author_gbg GBG и $author_sp СГ</td>
<td>В GOLOS: $full_author_pending, в GBG: ".round($full_author_pending*$median_price, 3)."</td>";
  } else   if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '10000') {
    $result['content'] .= "<td>$author_golos GOLOS и $author_sp СГ</td>
    <td>$full_author_pending GOLOS</td>";
  }
  if ($post['author'] == $user) {
    $summ_author_golos = $summ_author_golos + $author_golos;
    $summ_author_gbg = $summ_author_gbg + $author_gbg;
    $summ_author_sp = $summ_author_sp + $author_sp;
    } else if ($post['author'] != $user) {
    $full_summ_author_golos = $full_summ_author_golos + $author_golos;
    $full_summ_author_gbg = $full_summ_author_gbg + $author_gbg;
    $full_summ_author_sp = $full_summ_author_sp + $author_sp;
    }
    
$reward_weight = $post['reward_weight'];
$reward_weight_procent = $reward_weight/100;
$shtraf_procent = 100 - $reward_weight_procent;

$result['content'] .= '<td>'.round($shtraf_procent, 2).'%</td>';
$arr_shtraf_procent[] = $shtraf_procent;
$summ_shtraf_procent = $summ_shtraf_procent + $shtraf_procent;
$result['content'] .= '<td>'.$post['promoted'].'</td>
</tr>';
}
}
}
if (!empty($post_list)) {
$count_curation_procent = count($arr_curation_procent);
$full_curation_procent = round($summ_curation_procent/$count_curation_procent, 2);
$count_shtraf_procent = count($arr_shtraf_procent);
$full_shtraf_procent = round($summ_shtraf_procent/$count_shtraf_procent, 2);
$round_days = '7 суток';
$result['content'] .= "<tr><td></td>
<td>Постов: $sum_num, Репостов: $sum_reblogs_num</td>
<td>Все посты, опубликованные за $round_days.</td>
<td>Средний кураторский процент: $full_curation_procent%</td>
<td>$summ_beneficiaries_pending СГ</td>";
  if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '10000') {
    $result['content'] .= "<td>Репосты: $full_summ_author_golos GOLOS и $full_summ_author_sp СГ<br />
Общая сумма возможных выплат: $summ_author_golos GOLOS и $summ_author_sp СГ</td>";
$summ_fool_author = $summ_author_golos+$summ_author_sp;
$result['content'] .= "<td>$summ_fool_author GOLOS</td>
<td>В среднем, $full_shtraf_procent%</td>";
  } else if (($post['percent_steem_dollars'] ?? $post['percent_steem_dollars'] ?? "") == '0') {
    $result['content'] .= "<td>Репосты: $full_summ_author_golos GOLOS,  $full_summ_author_gbg GBG и $full_summ_author_sp СГ<br />
Общая сумма возможных выплат: $summ_author_golos GOLOS,  $summ_author_gbg GBG и $summ_author_sp СГ</td>";
    $summ_fool_author = $summ_author_golos+$summ_author_sp;
    $result['content'] .= "<td>$summ_fool_author GOLOS, ".round($summ_fool_author*$median_price, 3)." GBG</td>
    <td>В среднем, $full_shtraf_procent%</td>";
     
  }
  $result['content'] .= '<td></td>
</tr>';
}
$result['content'] .= "</table>";
} else {
  $result['content'] = '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
}
}
return $result['content'];
?>