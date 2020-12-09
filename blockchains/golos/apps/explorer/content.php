<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require 'get_dynamic_global_properties.php';
require 'get_chain_properties.php';

$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
$chain_res = $chain_command->execute($chain_commandQuery); 
$chain_mass = $chain_res['result'];
$content = '<form class="form" method = "post" action = "">
<input type = "hidden" name = "chain" value = "golos">
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
  $content .= '<li><a href="'.$conf['siteUrl'].'golos/explorer/block/'.$irreversible_block.'" target="_blank">'.$irreversible_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="head_blocks">Последние блоки с последнего (обратимого)</a></h2>
<ul>
';
$head_blocks = [$mass3['head_block_number'], $mass3['head_block_number']-1, $mass3['head_block_number']-2, $mass3['head_block_number']-3, $mass3['head_block_number']-4, $mass3['head_block_number']-5, $mass3['head_block_number']-6, $mass3['head_block_number']-7, $mass3['head_block_number']-8, $mass3['head_block_number']-9];
foreach ($head_blocks as $head_block) {
  $content .= '<li><a href="'.$conf['siteUrl'].'golos/explorer/block/'.$head_block.'" target="_blank">'.$head_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="chain_props">Основные параметры</a></h2>
<ul>';
$chf = [];
$chf['account_creation_fee'] = "Размер комиссии за создание аккаунта без делегирования (GOLOS)";
$chf['maximum_block_size'] = 'Максимальный размер блока в сети (в байтах):';
$chf['sbd_interest_rate'] = "% начисляемый на GBG";
$chf['create_account_min_golos_fee'] = "Мин. комиссия на создание аккаунта с делегированием (GOLOS)";
$chf['create_account_min_delegation'] = "Мин. СГ при создании аккаунта с делегированием (GOLOS)";
$chf['create_account_delegation_time'] = "Время заморозки делегированной СГ при создании аккаунта с делегированием (дней)";
$chf['min_delegation'] = "Размер мин. делегирования СГ (GOLOS)";
$chf['max_referral_interest_rate'] = "Макс. % от реферала";
$chf['max_referral_term_sec'] = "Макс. срок получения % от реферала (секунд)";
$chf['min_referral_break_fee'] = "Мин. сумма выкупа реферала (GOLOS)";
$chf['max_referral_break_fee'] = "Макс. сумма выкупа реферала (GOLOS)";
$chf['posts_window'] = "Длительность интервала/окна для постов";
$chf['posts_per_window'] = "Кол-во постов за интервал";
$chf['comments_window'] = "Длительность интервала/окна для комментариев";
$chf['comments_per_window'] = "Кол-во комментариев за интервал";
$chf['votes_window'] = "Длительность интервала/окна для голосования";
$chf['votes_per_window'] = "Кол-во голосов за интервал";
$chf['auction_window_size'] = "Длительность штрафного окна при голосовании (секунды)";
$chf['max_delegated_vesting_interest_rate'] = "Макс. % дохода при делегировании СГ";
$chf['custom_ops_bandwidth_multiplier'] = "Мультипликатор пропускной способности для операций custom_json";
$chf['min_curation_percent'] = "Мин. кураторский %";
$chf['max_curation_percent'] = "Макс. кураторский %";
$chf['curation_reward_curve'] = "Кривая кураторского вознаграждения";
$chf['allow_distribute_auction_reward'] = "Распределение штрафа из штрафного окна в пользу других кураторов";
$chf['allow_return_auction_reward_to_fund'] = "Распределение штрафа из штрафного окна в фонд вознаграждений";
$chf['worker_reward_percent'] = "% от эмиссии в пул воркеров";
$chf['witness_reward_percent'] = "% от эмиссии в пул делегатов";
$chf['vesting_reward_percent'] = "% от эмиссии в пул вестинга/на СГ";
$chf['worker_request_creation_fee'] = "Размер платы за подачу заявки воркером (GBG)";
$chf['worker_request_approve_min_percent'] = "% от общей СГ, необ. для одобрения заявки воркера";
$chf['sbd_debt_convert_rate'] = "% от общего кол-ва GBG для ежедневной конвертации в GOLOS при долге более 20%";
$chf['vote_regeneration_per_day'] = "Степень регенерации батарейки, кол-во полных апвоутов в день";
$chf['witness_skipping_reset_time'] = "Срок пропуска блоков, после которого ключ делегата сбрасывается и нода не участвует в подписании";
$chf['witness_idleness_time'] = "Срок с подписи последнего блока делегатом, после которого все голоса с него обнуляются";
$chf['account_idleness_time'] = "Срок неактивности аккаунта, после которого отменяется делегирование и запускается понижение СГ";
$chf['claim_idleness_time'] = 'Длительность окна/временного цикла для востребования пользователем своей доли от эмиссии (секунд)';
$chf['min_invite_balance'] = 'Минимальный баланс инвайта/чека для создания';
$chf['asset_creation_fee'] = 'Стоимость создания UIA актива';
$chf['invite_transfer_interval_sec'] = 'Минимальный интервал для переводов с инвайт-кодов (секунды)';
foreach ($chain_mass as $prop => $prop_value) {
  if ($prop !== 'min_curation_percent' && $prop !== 'max_curation_percent' && $prop !== 'flag_energy_additional_cost') {
  $content .= '<li>'.$chf[$prop].': '.$prop_value.'</li>';
  }
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>