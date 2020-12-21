<?php
define('DELEGATIONS_LIMIT', 10);

$user = $_GET['options']['user'];
$type = $_GET['options']['type'];
$siteUrl = $_GET['options']['siteUrl'];
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';
require 'snippets/get_vesting_delegations.php';
require 'snippets/get_dynamic_global_properties.php';
if (!$user) {
    die();
}

$res3 = $command3->execute($commandQuery3); 
$mass3 = $res3['result'];
$tvfs = (float)$mass3['total_vesting_fund_steem'];
$tvsh = (float)$mass3['total_vesting_shares'];
$steem_per_vests = 1000000 * $tvfs / $tvsh;

$rowCount = 0;

$startWith = $_REQUEST['start'] ?? '';
$result['content'] = '';
$type_str = '';
$type_account = '';
if ($type === 'received') {
    $type_str = 'полученный делегированием от других аккаунтов';
$type_account = 'delegator';
} else {
    $type_str = 'Делегированный другим аккаунтам';
$type_account = 'delegatee';
}

$result['content'] .= '<h2>'.$type_str.' СГ пользователя '.$user.'</h2>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<table><tr>
<th>Логин</th>
<th>Сумма</th>
<th>Процент возврата кураторских с делегирования</th>
<th>Мин. время возврата делегирования</th>
</tr>';
$delegations_result = vestingDelegations($user, $startWith, $type);
if (isset($delegations_result) && count($delegations_result) > 0) {
    foreach ($delegations_result as $delegation) {
        $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $min_delegation_time = $delegation['min_delegation_time'];
        $min_delegation_time2 = strtotime($min_delegation_time);
$month2 = date('m', $min_delegation_time2);
$timestamp = date('j', $min_delegation_time2).' '.$month[$month2].' '.date('Y г. H:i:s', $min_delegation_time2);
$rowCount++;
$percent = $delegation['interest_rate'] / 100;
$gp = $delegation['vesting_shares'] / 1000000 * $steem_per_vests;
$gp = round($gp, 6);
$result['content'] .= '<tr>
<td><a href="'.$siteUrl.'golos/profiles/'.$delegation[$type_account].'" target="_blank">@'.$delegation[$type_account].'</a></td>
<td>'.$gp.' СГ</td>
<td>'.$percent.'%</td>
<td>'.$timestamp.'</td>
</tr>';
if ($rowCount === DELEGATIONS_LIMIT) {
    $startWith = $delegations_result[$rowCount][$type_account];
    break;
}        
}
    }
    $result['nextIsExists'] = $startWith !== '';
    if ($result['nextIsExists']) {
        $result['next'] = $startWith;
    }
    
    $result['content'] .= '</table>';
    echo json_encode($result);
