<?php
$type = $_REQUEST['type'];
if ($type == 'result_power') {
$sp = $_REQUEST['sp'];
$charge = $_REQUEST['charge'];
$vote_weight = $_REQUEST['vote_weight'];
require __DIR__.'/snippets/get_dynamic_global_properties.php';
  require __DIR__.'/snippets/get_chain_properties.php';
  require __DIR__.'/snippets/get_feed_history.php';
require __DIR__.'/snippets/get_ticker.php';
require __DIR__.'/snippets/get_config.php';

 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];

 $chain_res = $chain_command->execute($chain_commandQuery); 
 $chain_mass = $chain_res['result'];

 $feed_res = $feed_command->execute($feed_commandQuery); 
 $feed_mass = $feed_res['result'];
 $ticker_res = $ticker_command->execute($ticker_commandQuery); 
 $ticker_mass = $ticker_res['result'];
 $ticker_price = $ticker_mass['latest'];

 $config_res = $config_command->execute($config_commandQuery); 
 $config_mass = $config_res['result'];

  // Расчет steem_per_vests
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация STEEM POWERв VESTS
// $sp - поле со введённым значением СГ.
$vesting_shares = $sp * 1000000 / $steem_per_vests;

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
echo "<p>Стоимость апвота: $dasdas_golos GOLOS, $dasdas_market_gbg GBG по курсу продажи, $dasdas_median_gbg GBG по медиане.</p>";
} else if ($type == 'result_vesting') {
    $sp = (float)$_REQUEST['sp-tec'];
    $sp_result = round(($sp / 10000) * 7, 3);
    echo "<p>Результат конвертации: $sp_result СГ</p>";
} else if ($type == 'result_vests') {
    $sptec = $_REQUEST['sp-tec'];
    require __DIR__.'/snippets/get_dynamic_global_properties.php';
    $res3 = $command3->execute($commandQuery3); 
    $mass3 = $res3['result'];
   
     // Расчет steem_per_vests
     $tvfs = (float)$mass3['total_vesting_fund_steem'];
     $tvsh = (float)$mass3['total_vesting_shares'];
     
     $steem_per_vests = 1000000 * $tvfs / $tvsh;
   
   $sp_result = round($sptec / 1000000 * $steem_per_vests, 3);
   
   echo "<p>Результат конвертации: $sp_result СГ</p>";
}
?>