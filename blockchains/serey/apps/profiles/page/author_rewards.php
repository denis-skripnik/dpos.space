<?php
define('AUTHOR_REWARDS_LIMIT', 5);
global $conf;
require 'snippets/get_account_history_chunk.php';
require 'snippets/get_dynamic_global_properties.php';

$res3 = $command3->execute($commandQuery3);

$mass3 = $res3['result'];

// Расчет hive_per_SEREY
    $tvfs = (float)$mass3['total_vesting_fund_steem'];
$tvsh = (float)$mass3['total_vesting_shares'];
$hive_per_SEREY = 1000000 * $tvfs / $tvsh;

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

$startWith = $_REQUEST['start'] ?? -1;
$retry_counter = 0;
while ($rowCount !== AUTHOR_REWARDS_LIMIT && $retry_counter < 3) {
$res = getAccountHistoryChunk($user, $startWith);
    
$mass = $res['result'];

    if (! $mass) {
        $result['content'] = '<p>Результатов нет. Возможно все подходящие операции в истории далеко или такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
        if (isset($_REQUEST['options']) || isset($_GET['options'])) {
            echo json_encode($result);
        return;
        } else {
        return $result['content'];
        }
    }

    krsort($mass);

            $result['content'] = '<div id="ajax_content"><h2>Авторские награды пользователя '.$user.'</h2>
    <table id="rewards-ol">
            <tr><th>Дата и время получения</th>
            <th>Ссылка на пост или комментарий</th>
            <th>Награда</th></tr>';
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
                if ($op[0] == 'author_reward') {
                    $rowCount++;
                    $author = $op[1]['author'] ?? "";
                    $permlink = $op[1]['permlink'] ?? "";
                    $gp_payout = (float)$op[1]['vesting_payout']  / 1000000 * $hive_per_SEREY;
                    $gp_payout = round($gp_payout, 6).' SP';
                    $result['content'] .= '<tr><td>' . $timestamp . '</td>
    <td><a href="https://serey.io/authors/'.$author.'/'.$permlink.'" target="_blank">'.$author.'/'.$permlink.'</a></td>                    
<td>'.$gp_payout.'</td></tr>';
                    }
                }
                $retry_counter++;
                if ($startWith === -1) break;
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