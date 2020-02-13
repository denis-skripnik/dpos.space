<?php

$chain = $_REQUEST['chain'];
$sptec = $_REQUEST['sp-tec'];
$array_url = $_REQUEST['array_url'];
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
require $_SERVER['DOCUMENT_ROOT'].'/calc/snippets/get_dynamic_global_properties.php';

if( isset($array_url[1]) ){ // проверяем существование элемента
 $res3 = $command3->execute($commandQuery3); 

 $mass3 = $res3['result'];

  // Расчет steem_per_vests
if ($chain != 'viz') {
  $tvfs = (float)$mass3['total_vesting_fund_steem'];
} else {
  $tvfs = (float)$mass3['total_vesting_fund'];
}
  $tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;

$sp_result = round($sptec / 1000000 * $steem_per_vests, 3);

echo "<p>Результат конвертации: $sp_result $amount2</p>";
}
?>