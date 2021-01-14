<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require 'get_dynamic_global_properties.php';
require 'get_chain_properties.php';

$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
$chain_res = $chain_command->execute($chain_commandQuery); 
$chain_mass = $chain_res['result'];
$content = '<form class="form" method = "post" action = "">
<input type = "hidden" name = "chain" value = "steem">
<input type = "hidden" name = "service" value = "explorer">
<label for = "data">Номер блока или id транзакции: </label>
<input align="left" type = "text" name = "data" value="">
<input align="left" type = "submit" value = "узнать инфу"/>
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
  $content .= '<li><a href="'.$conf['siteUrl'].'steem/explorer/block/'.$irreversible_block.'" target="_blank">'.$irreversible_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="head_blocks">Последние блоки с последнего (обратимого)</a></h2>
<ul>
';
$head_blocks = [$mass3['head_block_number'], $mass3['head_block_number']-1, $mass3['head_block_number']-2, $mass3['head_block_number']-3, $mass3['head_block_number']-4, $mass3['head_block_number']-5, $mass3['head_block_number']-6, $mass3['head_block_number']-7, $mass3['head_block_number']-8, $mass3['head_block_number']-9];
foreach ($head_blocks as $head_block) {
  $content .= '<li><a href="'.$conf['siteUrl'].'steem/explorer/block/'.$head_block.'" target="_blank">'.$head_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="chain_props">Основные параметры</a></h2>
<ul>';
$chf = [];
$chf['account_creation_fee'] = "Размер комиссии за создание аккаунта без делегирования (STEEM):";
$chf['maximum_block_size'] = 'Максимальный размер блока в сети (в байтах):';
$chf['sbd_interest_rate'] = "% начисляемый на SBD:";
$chf['account_subsidy_budget'] = "Субсидии аккаунта, которые будут добавлены к субсидии аккаунта за блок. Это максимальная ставка, которую можно создать с помощью субсидий:";
$chf['account_subsidy_decay'] = "сокращение субсидий по счету:";

foreach ($chain_mass as $prop => $prop_value) {
  $content .= '<li>'.$chf[$prop].': '.$prop_value.'</li>';
  }
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>