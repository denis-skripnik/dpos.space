<?php

$chain = $_REQUEST['chain'];
$sp = $_REQUEST['sp'];
$charge = $_REQUEST['charge'];
if ($chain != 'viz') {
$vote_weight = $_REQUEST['vote_weight'];
}
$array_url = $_REQUEST['array_url'];
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/get_dynamic_global_properties.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/get_chain_properties.php';
if ($chain != 'WLS' && $chain != 'viz') {
  require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/get_feed_history.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/get_ticker.php';
}
require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/get_config.php';
if ($chain == 'WLS' or $chain == 'steem') {
require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/getRewardFund.php';
}

if( isset($array_url[1]) ){ // проверяем существование элемента
 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];

 $chain_res = $chain_command->execute($chain_commandQuery); 
 $chain_mass = $chain_res['result'];

 if ($chain != 'WLS' && $chain != 'viz') {
 $feed_res = $feed_command->execute($feed_commandQuery); 
 $feed_mass = $feed_res['result'];
 $ticker_res = $ticker_command->execute($ticker_commandQuery); 
 $ticker_mass = $ticker_res['result'];
 $ticker_price = $ticker_mass['latest'];
}

 $config_res = $config_command->execute($config_commandQuery); 

 $config_mass = $config_res['result'];

  if ($chain == 'WLS' or $chain == 'steem') {
$RewardFund_res = $RewardFund_command->execute($RewardFund_commandQuery);
 $RewardFund_mass = $RewardFund_res['result'];
 }
 
  // Расчет steem_per_vests
if ($chain != 'viz') {
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
} else {
  $tvfs = (float)$mass3['total_vesting_fund'];
}
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация STEEM POWERв VESTS
// $sp - поле со введённым значением СГ.
$vesting_shares = $sp * 1000000 / $steem_per_vests;
// $charge - значение батарейки в формате **.**

if ($chain == 'WLS') {
$recent = $RewardFund_mass['recent_claims'];
$rewa = $RewardFund_mass['reward_balance'];
$primerr = $vesting_shares / $recent;
$brimerr = ($primerr * $rewa) * 100000;
$wqaaa = ($brimerr /100) * ($charge)*($vote_weight/100);
$dasdas = round($wqaaa, 3)/5;
echo "<p>Стоимость апвота: $dasdas</p>";
} else if ($chain == 'viz') {
  $total_vesting_fund = (float)$mass3["total_vesting_fund"];
$total_vesting_shares = (float)$mass3["total_vesting_shares"];
  $total_reward_fund = (float)$mass3["total_reward_fund"];
$total_reward_shares = (int)$mass3["total_reward_shares"];
$shares = $sp;

$payout = $shares * $charge /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$payout = (int)$payout / 1000000;
echo "<p>Награда даст $payout</p>";
} else if ($chain == 'golos' ) {
$base = (float)$feed_mass["current_median_history"]["base"];
    $quote = (float)$feed_mass["current_median_history"]["quote"];
   $median_price = round($base/$quote, 3);
    $total_vesting_fund_steem = (float)$mass3["total_vesting_fund_steem"];
    $total_vesting_shares = (float)$mass3["total_vesting_shares"];
    $total_reward_fund_steem = (float)$mass3["total_reward_fund_steem"];
	$total_reward_shares2 = (int)$mass3["total_reward_shares2"];
    $golos_per_vests = $total_vesting_fund_steem / $total_vesting_shares;

$account["golos_power"] = round($vesting_shares * $golos_per_vests, 3);
$vest_shares = (int)1e6 * $account["golos_power"] / $golos_per_vests;

$max_vote_denom = $chain_mass["vote_regeneration_per_day"] * (5 * 60 * 60 * 24) / (60 * 60 * 24);
$used_power = (int)($charge*100 + $max_vote_denom - 1) / $max_vote_denom;
$fixx_used_power = (int)(10000 + $max_vote_denom - 1) / $max_vote_denom;
$rshares = (($vest_shares * $used_power) / 10000);
$account["rshares"] = round($rshares);
$fixxrshares = (($vest_shares * $fixx_used_power) / 10000);
$account["fixx_rshares"] = round($fixxrshares);
$value_golos = round($account["rshares"] * $total_reward_fund_steem / $total_reward_shares2, 3);
$value_median_gbg = round($value_golos * $median_price, 3);
$value_market_gbg = round($value_golos * $ticker_price, 3);

$dasdas_golos = $value_golos*($vote_weight/100);
$dasdas_median_gbg = $value_median_gbg*($vote_weight/100);
$dasdas_market_gbg = $value_market_gbg*($vote_weight/100);
echo "<p>Стоимость апвота: $dasdas_golos $amount1, $dasdas_market_gbg $amount3 по курсу продажи, $dasdas_median_gbg $amount3 по медиане.</p>";
} else if ($chain == 'steem') {
  $steem_a = $tvfs / $tvsh;
  $steem_n = 100; // vote_vait;
  $steem_r = $sp / $steem_a;
  $steem_m2 = 100 * $charge * (100 * $steem_n) / 10000;
  $steem_m = ($steem_m2 + 49) / 50;
  $rewa = $RewardFund_mass['reward_balance'];
  $recent = $RewardFund_mass['recent_claims'];
  $steem_i = $rewa / $recent;
  $base = (float)$feed_mass["current_median_history"]["base"];
      $quote = (float)$feed_mass["current_median_history"]["quote"];
  $median_price = round($base/$quote, 2);
  $dasdas_golos = round($steem_r * $steem_m * 100 * $steem_i, 3)*($vote_weight/100);
  $dasdas_gbg = round($steem_r * $steem_m * 100 * $steem_i * $median_price, 3)*($vote_weight/100);
  echo "<p>Стоимость апвота: $dasdas_golos $amount1, $dasdas_gbg $amount3</p>";
  }
  
}
?>