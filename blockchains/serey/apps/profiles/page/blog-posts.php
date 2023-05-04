<?php
require $_SERVER['DOCUMENT_ROOT'].'/helpers.php';

require 'snippets/get_discussions_by_blog.php';
require 'snippets/get_dynamic_global_properties.php';
require 'snippets/get_config.php';
$result = [];
if( isset($user) ){ // проверяем существование элемента

 $res = $command->execute($commandQuery); 

 $mass = $res['result'];

 if($mass == true){
 
  $res3 = $command3->execute($commandQuery3); 

 $mass3 = $res3['result'];

 $config_res = $config_command->execute($config_commandQuery); 

 $config_mass = $config_res['result'];

  // Расчет hive_per_SEREY
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  $hive_per_SEREY = 1000000 * $tvfs / $tvsh;
date_default_timezone_set('UTC');
$now_date = date("Y-m-d", mktime(0, 0, 0, date('m'), date('d') -7, date('Y')))."T".date("H:i:s", mktime(date('H'), date('i'), date('s')));
$WLS_this_date = time();
$total_vesting_fund_steem = (float)$mass3["total_vesting_fund_steem"];
$total_reward_fund_steem = (float)$mass3["total_reward_fund_steem"];
$total_reward_shares2 = (int)$mass3["total_reward_shares2"];
$total_vesting_shares = (float)$mass3["total_vesting_shares"];
    $hive_per_SEREY = $total_vesting_fund_steem / $total_vesting_shares;
    $result['content'] = "<h2>Свежие посты аккаунта $user</h2>
  <table><tr><th>№</th>
<th>Название</th>
<th>До выплаты</th>
<th>Бенефициары</th>
<th>Прогнозируемые выплаты автору</th>
<th>Общая авторская выплата</th>
<th>Сумма продвижения</th>
</tr>";
$post_list = array();
$summ_beneficiaries_pending = 0;
$summ_author_hive = 0;
$summ_author_HP = 0;
 $full_summ_author_hive = 0;
$full_summ_author_HP = 0;
 $summ_author_WLS = 0;
$full_summ_author_WLS = 0;
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
  $result['content'] .= '<td><a href="https://serey.io/authors/'.$post['author'].'/'.$post['permlink'].'" target="_blank">'.$post['title'].'</a></td>';
$sum_num += 1;
} else {
  $result['content'] .= '<td><a href="https://serey.io/authors/'.$post['author'].'/'.$post['permlink'].'" target="_blank">'.$post['title'].'</a> (Репост от <a href="'.$conf['siteUrl'].'serey/profiles/'.$post['author'].'" target="_blank">@'.$post['author'].'</a>)</td>';
$sum_reblogs_num += 1;
}
$result['content'] .= '<td>'.$date_for_pay1.'</td>';
$sum_weight = 0;
foreach ($post['active_votes'] as $vote) {
  $sum_weight += $vote['percent'];
}
$pending_payout_value = (float)$post['pending_payout_value'];
$pending_serey = round($pending_payout_value, 3);
$curation_pending = ($pending_serey/100)*25;
$all_no_curations = round($pending_serey - $curation_pending, 3);

$all_beneficiaries = 0;
$beneficiaries_list = '';
foreach ($post['beneficiaries'] as $beneficiarie) {
$all_beneficiaries += $beneficiarie['weight'];
$beneficiarie_weight = $beneficiarie['weight']/100;
$beneficiaries_list .= $beneficiarie['account']." - ".$beneficiarie_weight."%  ";
}
$beneficiaries_procent = $all_beneficiaries/100;
$beneficiaries_pending = round(($all_no_curations/100)*$beneficiaries_procent, 3);
$result['content'] .= '<td>'.$beneficiaries_list.'('.$beneficiaries_pending.' SP)</td>';
$summ_beneficiaries_pending = $summ_beneficiaries_pending + $beneficiaries_pending;
$full_author_pending = round($all_no_curations - $beneficiaries_pending, 3);
$author_HP = round($full_author_pending, 3);
$author_hive = round($full_author_pending - $author_HP, 3);

$author_WLS = $author_HP*2;

    $result['content'] .= "<td>$author_hive SEREY и $author_HP SP</td>
    <td>$full_author_pending SEREY</td>";
  if ($post['author'] == $user) {
    $summ_author_hive = $summ_author_hive + $author_hive;
    $summ_author_HP = $summ_author_HP + $author_HP;
    } else if ($post['author'] != $user) {
    $full_summ_author_hive = $full_summ_author_hive + $author_hive;
    $full_summ_author_HP = $full_summ_author_HP + $author_HP;
    }
    
$result['content'] .= '<td>'.$post['promoted'].'</td>
</tr>';
}
}
}
if (!empty($post_list)) {
$round_days = '7 суток';
$result['content'] .= "<tr><td></td>
<td>Постов: $sum_num, Репостов: $sum_reblogs_num</td>
<td>Все посты, опубликованные за $round_days.</td>
<td>$summ_beneficiaries_pending SP</td>";
    $result['content'] .= "<td>Репосты: $full_summ_author_hive SEREY и $full_summ_author_HP SP<br />
Общая сумма возможных выплат: $summ_author_hive SEREY и $summ_author_HP SP</td>";
$summ_fool_author = $summ_author_hive+$summ_author_HP;
$result['content'] .= "<td>$summ_fool_author SEREY</td>";
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