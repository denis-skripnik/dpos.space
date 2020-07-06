<?php
$type = $_REQUEST['type'];
if ($type == 'result_power') {
$sp = $_REQUEST['sp'];
$sp = str_replace(',','.',$sp); //Меняем запятую на точку
$sp = floatval($sp); //удаляем все лишнее
$sp = (float)$sp;

$charge = $_REQUEST['charge'];
$charge = str_replace(',','.',$charge); //Меняем запятую на точку
$charge = floatval($charge); //удаляем все лишнее
$charge = (float)$charge;

require __DIR__.'/snippets/get_dynamic_global_properties.php';
  require __DIR__.'/snippets/get_chain_properties.php';
require __DIR__.'/snippets/get_config.php';

 $res3 = $command3->execute($commandQuery3); 
 $mass3 = $res3['result'];

 $chain_res = $chain_command->execute($chain_commandQuery); 
 $chain_mass = $chain_res['result'];

 $config_res = $config_command->execute($config_commandQuery); 
 $config_mass = $config_res['result'];

  // Расчет steem_per_vests
  $total_vesting_fund = (float)$mass3['total_vesting_fund'];
  $total_vesting_shares = (float)$mass3['total_vesting_shares'];
 $total_reward_fund = (float)$mass3["total_reward_fund"];
$total_reward_shares = (int)$mass3["total_reward_shares"];
$shares = $sp;

$payout = $shares * $charge /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$payout = (int)$payout / 1000000;
echo "<p>Награда даст $payout</p>";
} else if ($type == 'result_vests') {
    $sptec = $_REQUEST['sp-tec'];
    require __DIR__.'/snippets/get_dynamic_global_properties.php';
    $res3 = $command3->execute($commandQuery3); 
    $mass3 = $res3['result'];
   
     // Расчет steem_per_vests
     $tvfs = (float)$mass3['total_vesting_fund'];
     $tvsh = (float)$mass3['total_vesting_shares'];
     
     $steem_per_vests = 1000000 * $tvfs / $tvsh;
   
   $sp_result = round($sptec / 1000000 * $steem_per_vests, 3);
   
   echo "<p>Результат конвертации: $sp_result соц. капитала</p>";
}
?>