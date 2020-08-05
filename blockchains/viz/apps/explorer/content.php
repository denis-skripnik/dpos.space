<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require 'get_dynamic_global_properties.php';
require 'get_chain_properties.php';

$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
$chain_res = $chain_command->execute($chain_commandQuery); 
$chain_mass = $chain_res['result'];
$content = '<h2>Введите в поле ниже номер блока или хэш-сумму транзакции блокчейна Viz:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "chain" value = "viz">
  <input type = "hidden" name = "service" value = "explorer">
  <label for = "data">Введите номер блока или хэш-сумму транзакции: </label>
  <input type = "text" name = "data" value="">
  <input type = "submit" value = "узнать инфу"/>
</form>
<hr />
<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#stable_blocks">Последние блоки с необратимого</a></li>
<li><a href="#head_blocks">Последние блоки с последнего (обратимого)</a></li>
<li><a href="#chain_props">Основные параметры</a></li></ul>
<h2><a name="stable_blocks">Последние блоки с необратимого</a></h2>
<ul>
';
$irreversible_blocks = [$mass3['last_irreversible_block_num'], $mass3['last_irreversible_block_num']-1, $mass3['last_irreversible_block_num']-2, $mass3['last_irreversible_block_num']-3, $mass3['last_irreversible_block_num']-4, $mass3['last_irreversible_block_num']-5, $mass3['last_irreversible_block_num']-6, $mass3['last_irreversible_block_num']-7, $mass3['last_irreversible_block_num']-8, $mass3['last_irreversible_block_num']-9];
foreach ($irreversible_blocks as $irreversible_block) {
  $content .= '<li><a href="'.$conf['siteUrl'].'viz/explorer/block/'.$irreversible_block.'" target="_blank">'.$irreversible_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="head_blocks">Последние блоки с последнего (обратимого)</a></h2>
<ul>
';
$head_blocks = [$mass3['head_block_number'], $mass3['head_block_number']-1, $mass3['head_block_number']-2, $mass3['head_block_number']-3, $mass3['head_block_number']-4, $mass3['head_block_number']-5, $mass3['head_block_number']-6, $mass3['head_block_number']-7, $mass3['head_block_number']-8, $mass3['head_block_number']-9];
foreach ($head_blocks as $head_block) {
  $content .= '<li><a href="'.$conf['siteUrl'].'viz/explorer/block/'.$head_block.'" target="_blank">'.$head_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="chain_props">Основные параметры</h2>
<ul>';
$chf = [];
$chf['account_creation_fee'] = 'Передаваемая комиссия при создании аккаунта';
$chf['create_account_delegation_ratio'] = 'Коэффициент наценки делегирования при создании аккаунта';
$chf['create_account_delegation_time'] = 'Срок делегирования при создании аккаунта (в секундах)';
$chf['maximum_block_size'] = 'Максимальный размер блока в сети (в байтах)';
$chf['min_delegation'] = 'Минимальное количество токенов при делегировании';
$chf['bandwidth_reserve_percent'] = 'Доля сети, выделяемая для резервной пропускной способности';
$chf['bandwidth_reserve_below'] = 'Резервная пропускная способность действует для аккаунтов с долей сети до порога';
$chf['vote_accounting_min_rshares'] = 'Минимальный вес голоса для учёта при награждении (VIZ)';
$chf['committee_request_approve_min_percent'] = 'Минимальная доля совокупного социального капитала для решения по заявке в Фонде ДАО';
$chf['inflation_witness_percent'] = 'Доля эмиссии, идущая на вознаграждение делегатов';
      $chf['inflation_ratio_committee_vs_reward_fund'] ='Доля оставшейся эмиссии, идущая в Фонд ДАО (остальное - в Фонд наград)';
      $chf['inflation_recalc_period'] = 'Количество блоков между пересчётом инфляционной модели';
      $chf['data_operations_cost_additional_bandwidth'] = 'Дополнительная наценка пропускной способности за каждую data операцию в транзакции';
      $chf['witness_miss_penalty_percent'] = 'Штраф делегату за пропуск блока в процентах от суммарного веса голосов';
      $chf['witness_miss_penalty_duration'] = 'Длительность штрафа делегату за пропуск блока в секундах';
      $chf['create_invite_min_balance'] = 'Минимальный баланс для создания инвайт кода';
      $chf['committee_create_request_fee'] = 'Комиссия за создание заявки в комитет';
      $chf['create_paid_subscription_fee'] = 'Комиссия за создание платной подписки';
      $chf['account_on_sale_fee'] = 'Комиссия за установку аккаунта на продажу';
      $chf['subaccount_on_sale_fee'] = 'Комиссия за установку субаккаунтов на продажу';
      $chf['witness_declaration_fee'] = 'Комиссия за декларирование аккаунта делегатом';
      $chf['withdraw_intervals'] = 'Количество интервалов для уменьшения капитала';
foreach ($chain_mass as $prop => $prop_value) {
  if ($prop !== 'min_curation_percent' && $prop !== 'max_curation_percent' && $prop !== 'flag_energy_additional_cost') {
  $content .= '<li>'.$chf[$prop].': '.$prop_value.'</li>';
  }
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>