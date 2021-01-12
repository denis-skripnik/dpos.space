<?php
define('AUTHOR_REWARDS_LIMIT', 10);
global $conf;
require 'snippets/get_account_history_chunk.php';

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

$res = getAccountHistoryChunk($user, $startWith, ['select_ops' => ['fill_order']]);
    
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

            $result['content'] = '<div id="ajax_content"><h2>Ордера на внутренней бирже, связанные с пользователем '.$user.'</h2>
    <table id="rewards-ol">
            <tr><th>Дата и время</th>
            <th>продавец</th>
<th>покупатель</th>
            <th>сумма на продажу</th>
            <th>Сумма на покупку</th>
</tr>';
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
        $timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
        $timestamp = '<a href="'.$site_url.'steem/explorer/tx/'.$datas[1]['trx_id'].'" target="_blank">'.$timestamp.'</a>';
                $op1 = $op[1];
                if ($op[0] == 'fill_order') {
                    $rowCount++;
                    $seller = $op[1]['current_owner'] ?? "";
                    $buyer = $op[1]['open_owner'] ?? "";
                    $sell_amount = $op[1]['current_pays'] ?? "";
                    $buy_amount = $op[1]['open_pays'];
                    $result['content'] .= '<tr><td>' . $timestamp . '</td>
    <td><a href="'.$site_url.'steem/profiles/'.$seller.'" target="_blank">'.$seller.'</a></td>
    <td><a href="'.$site_url.'steem/profiles/'.$buyer.'" target="_blank">'.$buyer.'</a></td>
        <td>'.$sell_amount.'</td>
        <td>'.$buy_amount.'</td></tr>';
                    }
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