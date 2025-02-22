<?php
define('TRX_LIMIT', 10);
global $conf;
require 'snippets/get_account_history_chunk.php';
require 'snippets/get_dynamic_global_properties.php';

$res3 = $command3->execute($commandQuery3);

$mass3 = $res3['result'];

// Расчет steem_per_vests
    $tvfs = (float)$mass3['total_vesting_fund'];
$tvsh = (float)$mass3['total_vesting_shares'];

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

while ($rowCount !== TRX_LIMIT && $retry_counter < 4) {
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

            $result['content'] = '<div id="ajax_content"><h2>Полученные награды пользователю '.$user.'</h2>
    <table id="rewards-ol">
            <tr><th>Дата и время получения</th>
                        <th>Инициатор награды</th>
            <th>Сумма выплаты</th>
            <th>Заметка (memo)</th>
<th>Номер custom операции</th></tr>';
                    foreach ($mass as $datas) {
                if ($rowCount === TRX_LIMIT) {
                    break;
                }
    
   
                $op = $datas[1]['op'];
                $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
                $timestamp1 = $datas[1]['timestamp'];
         $timestamp2 = strtotime($timestamp1);
        $month2 = date('m', $timestamp2);
        $timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
        $timestamp = '<a href="'.$site_url.'viz/explorer/tx/'.$datas[1]['trx_id'].'" target="_blank">'.$timestamp.'</a>';
                
                $op1 = $op[1];
                if ($op[0] == 'receive_award') {
                    $rowCount++;
                    $startWith = $datas[0] - 1;
                    $award_initiator = $op[1]['initiator'] ?? "";
                    $award_memo = $op[1]['memo'] ?? "";
                    $award_shares = round((float)($op[1]['shares'] ?? ""), 3);
                    $award_custom_sequence = (float)($op[1]['custom_sequence'] ?? "");
                    $lastSelectedIndex = $datas[0];
                        $result['content'] .= '<tr><td>' . $timestamp . '</td>
    <td><a href="'.$site_url.'viz/profiles/'.$award_initiator.'" target="_blank">'.$award_initiator.'</a></td>
                        <td>' . $award_shares . ' Ƶ</td>
    <td>'.$award_memo.'</td>
<td>'.$award_custom_sequence.'</td></tr>';
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