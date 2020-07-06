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
$status = $mass['signing_key'] === 'VIZ1111111111111111111111111111111114T1Anm' ? 'отключён' : 'включён';
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
      
      foreach ($props as $prop => $value) {
if ($prop !== 'min_curation_percent' && $prop !== 'max_curation_percent' && $prop !== 'flag_energy_additional_cost') {
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