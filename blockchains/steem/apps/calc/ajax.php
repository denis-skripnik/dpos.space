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
require __DIR__.'/snippets/getRewardFund.php';

 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];

 $chain_res = $chain_command->execute($chain_commandQuery); 
 $chain_mass = $chain_res['result'];

 $feed_res = $feed_command->execute($feed_commandQuery); 
 $feed_mass = $feed_res['result'];
 $ticker_res = $ticker_command->execute($ticker_commandQuery); 
 $ticker_mass = $ticker_res['result'];
 $ticker_price = $ticker_mass['latest'];
 $RewardFund_res = $RewardFund_command->execute($RewardFund_commandQuery);
 $RewardFund_mass = $RewardFund_res['result'];
  $config_res = $config_command->execute($config_commandQuery); 
 $config_mass = $config_res['result'];

  // Расчет steem_per_vests
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

// Конвертация STEEM POWERв VESTS
// $sp - поле со введённым значением СГ.
$vesting_shares = $sp * 1000000 / $steem_per_vests;

$steem_a = $tvfs / $tvsh;
$steem_n = 100; // vote_vait;
$steem_r = $sp / $steem_a;
$steem_m2 = 100 * $charge * (100 * $steem_n) / 10000;
$steem_m = ($steem_m2 + 49) / 50;
$rewa = (float)$RewardFund_mass['reward_balance'];
$recent = (float)$RewardFund_mass['recent_claims'];

$steem_i = $rewa / $recent;
$base = (float)$feed_mass["current_median_history"]["base"];
    $quote = (float)$feed_mass["current_median_history"]["quote"];
$median_price = round($base/$quote, 2);
$dasdas_golos = round($steem_r * $steem_m * 100 * $steem_i, 3)*($vote_weight/100);
$dasdas_gbg = round($steem_r * $steem_m * 100 * $steem_i * $median_price, 3)*($vote_weight/100);
echo "<p>Стоимость апвота: $dasdas_golos STEEM, $dasdas_gbg SBD</p>";
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
   
   echo "<p>Результат конвертации: $sp_result SP</p>";
}
?>