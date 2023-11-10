<?php
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
$steem_per_vests = 1000000 * $total_vesting_fund / $total_vesting_shares;
   
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

$shares = $sp;

$payout = $shares * $charge /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$payout = (int)$payout / 1000000;
echo "<p>Награда даст $payout</p>";
} else if ($type == 'result_fund') {
  $sp = $_REQUEST['sp'];
  $sp = str_replace(',','.',$sp); //Меняем запятую на точку
  $sp = floatval($sp); //удаляем все лишнее
  $sp = (float)$sp;
  $shares = $sp;

  $award_fund = $shares * 0.1 /100 / ($total_reward_shares/1000000) * $total_reward_fund / ($total_vesting_fund / $total_vesting_shares)*1000000;
$award_fund = (int)$award_fund / 1000000;
$withdraw_amount = $award_fund * 200;
$all_shares_for_withdrawal = $withdraw_amount * 28;
echo '<p>Если у вас есть приложение, можете создать наградной фонд. Как?<br>
Награждаете свой аккаунт раз в 432 секунды на 0.1%. Вы будете получать '.$award_fund.' SHARES.<br>
Раз в сутки необходимо из соц. капитала выводить '.$withdraw_amount.' SHARES, а для этого доступно к выводу в соц. капитале должно быть не менее '.$all_shares_for_withdrawal.'</p>';
} else if ($type == 'result_vests') {
    $sptec = $_REQUEST['sp-tec'];
   
     
   $sp_result = round($sptec / 1000000 * $steem_per_vests, 3);
   
   echo "<p>Результат конвертации: $sp_result соц. капитала</p>";
}
?>