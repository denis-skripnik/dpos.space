<?php
define('DELEGATIONS_LIMIT', 10);

$user = $_GET['options']['user'];
$type = $_GET['options']['type'];
$siteUrl = $_GET['options']['siteUrl'];
require_once 'snippets/get_vesting_delegations.php';
if (!$user) {
    die();
}

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

$result['content'] .= '<h2>'.$type_str.' соц. капитал пользователя '.$user.'</h2>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<table><tr>
<th>Логин</th>
<th>Сумма</th>
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

$result['content'] .= '<tr>
<td><a href="'.$siteUrl.'viz/profiles/'.$delegation[$type_account].'" target="_blank">@'.$delegation[$type_account].'</a></td>
<td>'.$delegation['vesting_shares'].'</td>
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
