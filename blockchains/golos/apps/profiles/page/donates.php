<?php
define('AUTHOR_REWARDS_LIMIT', 10);
global $conf;
require 'snippets/get_account_history_chunk.php';
require 'snippets/get_dynamic_global_properties.php';

$res3 = $command3->execute($commandQuery3);

$mass3 = $res3['result'];

// Расчет steem_per_vests
    $tvfs = (float)$mass3['total_vesting_fund_steem'];
$tvsh = (float)$mass3['total_vesting_shares'];
$steem_per_vests = 1000000 * $tvfs / $tvsh;

if (!isset($user) && isset($_REQUEST['options']['user'])) { // проверяем существование элемента
    $user = $_REQUEST['options']['user'];
    } else if (!isset($user) && !isset($_REQUEST['options']['user'])) {
    return;
    }
    
    $site_url = '';
    if (isset($_REQUEST['options']['siteUrl'])) {
        $site_url = $_REQUEST['options']['siteUrl'];
    } else if (isset($conf['siteUrl'])) {
        $site_url = $conf['siteUrl'];
    }

    $rowCount = 0;

$startWith = $_REQUEST['start'] ?? 300000000;

    $res = getAccountHistoryChunk($user, $startWith, ['select_ops' => ['donate']]);

    $mass = $res['result'];

    if (!$mass) {
        $result['content'] = '<p>Результатов нет. Возможно все подходящие операции в истории далеко или такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
        if (isset($_REQUEST['options']) || isset($_GET['options'])) {
            echo json_encode($result);
        return;
        } else {
        return $result['content'];
        }
    }

    krsort($mass);
            
    $result['content'] = '<div id="ajax_content"><h2>История донатов пользователя '.$user.'</h2>
    <table id="rewards-ol">
            <tr><th>Дата и время получения</th>
<th>от кого</th>
<th>Кому</th>
<th>Сумма</th>
<th>Подробности</th></tr>';
                    foreach ($mass as $datas) {
                if ($rowCount === AUTHOR_REWARDS_LIMIT) {
                    break;
                }
                $startWith = $datas[0] - 1;
    
                    $op = $datas[1]['op'];
                $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
                $timestamp1 = $datas[1]['timestamp'];
                $timestamp2 = strtotime($timestamp1);
                $month2 = date('m', $timestamp2);
                $timestamp = date('j', $timestamp2) . ' ' . $month[$month2] . ' ' . date('Y г. H:i:s', $timestamp2);
                $op1 = $op[1];
                    $rowCount++;
                    $from = $op[1]['from'];
                    $to = $op[1]['to'];
                    $amount = $op[1]['amount'];
$memo = $op[1]['memo'];
$more_info = 'Приложение: '.$memo['app'].', версия: '.$memo['version'].(isset($memo['comment']) ? ', Комментарий: '.$memo['comment'] : '').'. ';
$target = $memo['target'];
foreach ($target as $key => $value) {
$more_info .= $key.': '.$value.',';
}
$more_info = substr($more_info, 0, -1);                    
$result['content'] .= '<tr><td>' . $timestamp . '</td>
<td><a href="'.$site_url.'golos/profiles/'.$from.'" target="_blank">'.$from.'</a></td>
<td><a href="'.$site_url.'golos/profiles/'.$to.'" target="_blank">'.$to.'</a></td>
<td>'.$amount.'</td>
<td>'.$more_info.'</td></tr>';
                }
            
            $result['content'] .= '</table><br>';

            $result['nextIsExists'] = $startWith !== '';
            if ($result['nextIsExists']) {
                $result['next'] = $startWith;
            }
            $result['content'] .= '</div>';
            if (isset($_REQUEST['options']) || isset($_GET['options'])) {
                echo json_encode($result);
            } else {
            return $result['content'];
            }