<?php
global $conf;
require 'snippets/get_witness_by_account.php';
$content = '';
if( isset(pageUrl()[2]) ){ // проверяем существование элемента

 $res = $command->execute($commandQuery); 
 $mass = $res['result'];

 if($mass == true){
 
date_default_timezone_set('UTC');
$server_time = time();

$content .=  '<h2><a name="contents">Оглавление</a></h2>
<nav><ul><li><a href="#data1">Основное</a></li>
<li><a href="#data2">Параметры</a></li>
</ul></nav>
<h2><a name="data1">Основное</a></h2>';
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$created1 = $mass['created'];
$created2 = strtotime($created1);
$month1 = date('m', $created2);
$created = date('d', $created2).' '.$month[$month1].' '.date('Y г. H:i:s', $created2);
$url = $mass['url'];
$total_missed = $mass['total_missed'];
$last_confirmed_block_num = $mass['last_confirmed_block_num'];
$status = $mass['signing_key'] === 'GLS1111111111111111111111111111111114T1Anm' ? 'отключён' : 'включён';
$hardfork_version_vote = $mass['hardfork_version_vote'];
$hardfork_time_vote1 = $mass['hardfork_time_vote'];
$hardfork_time_vote2 = strtotime($hardfork_time_vote1);
$month2 = date('m', $hardfork_time_vote2);
$hardfork_time_vote = date('d', $hardfork_time_vote2).' '.$month[$month2].' '.date('Y г. H:i:s', $hardfork_time_vote2);
$running_version = $mass['running_version'];
$props = $mass['props'];

$content .=  '<ul><li>Стал делегатом '.$created.'</li>
<li>'.$total_missed.' пропусков</li>
<li>Url: <a href="'.$url.'" target="_blank">'.$url.'</a></li>
<li>Последний подтверждённый блок: '.$last_confirmed_block_num.'</li>
<li>Статус: '.$status.'</li>
<li>Проголосовал за ХФ '.$hardfork_version_vote.' '.$hardfork_time_vote.'</li>
<li>Текущая версия: '.$running_version.'</li></ul>
<p align="center"><a href="#contents">К меню</a></p>
<h2><a name="data2">Параметры</a></h2>
<table><tr><th>Параметр</th><th>Значение</th><th>Описание</th></tr>';
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
$chf['posts_window'] = "Длительность интервала/окна для постов (минуты)";
$chf['posts_per_window'] = "Кол-во постов за интервал";
$chf['comments_window'] = "Длительность интервала/окна для комментариев (минуты)";
$chf['comments_per_window'] = "Кол-во комментариев за интервал";
$chf['votes_window'] = "Длительность интервала/окна для голосования (минуты)";
$chf['votes_per_window'] = "Кол-во голосов за интервал";
$chf['auction_window_size'] = "Длительность штрафного окна при голосовании (секунды)";
$chf['max_delegated_vesting_interest_rate'] = "Макс. % дохода при делегировании СГ";
$chf['custom_ops_bandwidth_multiplier'] = "Мультипликатор пропускной способности для операций custom_json";
$chf['min_curation_percent'] = "Мин. кураторский %";
$chf['max_curation_percent'] = "Макс. кураторский %";
$chf['curation_reward_curve'] = "Кривая кураторского вознаграждения";
$chf['allow_distribute_auction_reward'] = "Распределение штрафа из штрафного окна в пользу других кураторов";
$chf['allow_return_auction_reward_to_fund'] = "Распределение штрафа из штрафного окна в фонд вознаграждений";
$chf['worker_request_creation_fee'] = "Размер платы за подачу заявки воркером (GBG)";
$chf['worker_request_approve_min_percent'] = "% от общей СГ, необ. для одобрения заявки воркера";
$chf['worker_emission_percent'] = "процент эмиссии, поступающий на наполнение фонда воркеров";
$chf['vesting_of_remain_percent'] = "процент распределения оставшегося на пул вестинга и общий пул";
$chf['worker_request_creation_fee'] = "Размер платы за подачу заявки воркером:";
$chf['worker_request_approve_min_percent'] = "% от общей СГ, необ[' для одобрения заявки воркера:";
$chf['sbd_debt_convert_rate'] = "% от общего кол-ва GBG для ежедневной конвертации в GOLOS при долге более 20%";
$chf['vote_regeneration_per_day'] = "Степень регенерации батарейки, кол-во полных апвоутов в день";
$chf['witness_skipping_reset_time'] = "Срок пропуска блоков, после которого ключ делегата сбрасывается и нода не участвует в подписании";
$chf['witness_idleness_time'] = "Срок с подписи последнего блока делегатом, после которого все голоса с него обнуляются";
$chf['account_idleness_time'] = "Срок неактивности аккаунта, после которого отменяется делегирование и запускается понижение СГ";
$chf['claim_idleness_time'] = 'Длительность окна/временного цикла для востребования пользователем своей доли от эмиссии (секунд)';
$chf['min_invite_balance'] = 'Минимальный баланс инвайта/чека для создания';
$chf['asset_creation_fee'] = 'Стоимость создания UIA актива';
$chf['invite_transfer_interval_sec'] = 'Минимальный интервал для переводов с инвайт-кодов (секунды)';
$chf['worker_emission_percent'] = "процент эмиссии, поступающий на наполнение фонда воркеров";
$chf['vesting_of_remain_percent'] = "процент распределения оставшегося на пул вестинга и общий пул";
$chf['worker_request_creation_fee'] = "Размер платы за подачу заявки воркером:";
$chf['worker_request_approve_min_percent'] = "% от общей СГ, необ[' для одобрения заявки воркера:";
$chf['sbd_debt_convert_rate'] = "% от общего кол-ва GBG для ежедневной конвертации в GOLOS при долге более 20%:";
$chf['vote_regeneration_per_day'] = "Степень регенерации батарейки, кол-во полных апвоутов в день:";
$chf['witness_skipping_reset_time'] = "Срок пропуска блоков, после которого ключ делегата сбрасывается и нода не участвует в подписании (минуты):";
$chf['witness_idleness_time'] = "Срок с подписи последнего блока делегатом, после которого все голоса с него обнуляются (дни):";
$chf['account_idleness_time'] = "Срок неактивности аккаунта, после которого отменяется делегирование и запускается понижение СГ (дни)";
$chf['claim_idleness_time'] = 'Длительность окна/временного цикла для востребования пользователем своей доли от эмиссии (секунд): ';
$chf['min_invite_balance'] = 'Минимальный баланс инвайта/чека для создания: ';
$chf['asset_creation_fee'] = 'Стоимость создания UIA актива:';
$chf['invite_transfer_interval_sec'] = 'Минимальный интервал для переводов с инвайт-кодов (секунды):';
$chf['convert_fee_percent'] = "Процент комиссии по конвертации";
$chf['min_golos_power_to_curate'] = "Мин[' СГ для получения кураторских";
$chf['negrep_posting_window'] = "Время постинга аккаунтом с отрицательной репутацией (минут)";
$chf['negrep_posting_per_window'] = "Кол-во постов для публикации аккаунтами с отриц[' репутацией";
$chf['unwanted_operation_cost'] = "Стоимость нежелательных операций.";
$chf['unlimit_operation_cost'] = "Цена 1 операции при отрицательной репутации.";

foreach ($props as $prop => $value) {
if ($prop !== 'min_curation_percent' && $prop !== 'max_curation_percent' && $prop !== 'flag_energy_additional_cost' && $prop !== 'worker_reward_percent' && $prop !== 'witness_reward_percent' && $prop !== 'vesting_reward_percent') {
    $content .= '<tr><td>'.$prop.'</td>
<td>'.$value.'</td>
<td>'.$chf[$prop].'</td></tr>';
}
}
$content .=  '</table>
<p align="center"><a href="#contents">К меню</a></p>';
    } else {
    $content .=  '<p>такого пользователя не существует или не был когда-либо делегатом. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
    }     
}
        return $content;
		?>