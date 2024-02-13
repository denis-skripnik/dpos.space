<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
function getLevel($gp_percent) {
    $res = [];
    if ($gp_percent >= 5) {
        $res = ['file' => 10, 'name' => 'Повелители морей'];
    } else if ($gp_percent >= 1) {
            $res = ['file' => 9, 'name' => 'Киты'];
        } else if ($gp_percent >= 0.5) {
            $res = ['file' => 8, 'name' => 'Косатки'];
        } else if ($gp_percent >= 0.25) {
            $res = ['file' => 7, 'name' => 'Акулы'];
        } else if ($gp_percent >= 0.1) {
            $res = ['file' => 6, 'name' => 'Дельфины'];
        } else if ($gp_percent >= 0.05) {
            $res = ['file' => 5, 'name' => 'Черепахи'];
        } else if ($gp_percent >= 0.025) {
            $res = ['file' => 4, 'name' => 'Рыбы'];
        } else if ($gp_percent >= 0.01) {
            $res = ['file' => 3, 'name' => 'Осьминоги'];
        } else if ($gp_percent >= 0.005) {
            $res = ['file' => 2, 'name' => 'Крабы'];
        } else if ($gp_percent >= 0) {
            $res = ['file' => 1, 'name' => 'Креветки'];
        }
return $res;
}

$content = '';
$pagenum = 1;
if (isset(pageUrl()[3])) {
    $pagenum = pageUrl()[3];
}
$html = file_get_contents('http://178.20.43.121:3000/golos-api?service=top&type='.mb_strtolower(pageUrl()[2]).'&page='.$pagenum);
$get_page = json_decode($html, true);
$top = $get_page['users'];
$next_page = true;
if ($top && count($top) > 0) {
$fields = ['name' => 'Логин', 'gp' => 'СГ (%)', 'delegated_gp' => 'Делегировано СГ другим', 'received_gp' => 'Получено СГ от других делегированием', 'effective_gp' => 'Эффективная СГ, учитываемая при апвоутинге', 'emission_received_gp' => 'Получено СГ с эмиссией', 'emission_delegated_gp' => 'Делегировано СГ с эмиссией', 'gp_withdraw_rate' => 'Выводится СГ', 'golos' => 'Баланс GOLOS (%)', 'gbg' => 'Баланс GBG (%)', 'tip_balance' => 'TIP-баланс', 'market_balance' => 'Маркет-баланс', 'reputation' => 'Репутация'];
if ($top) {
$tr = '';
    $th = '<tr>';
foreach ($top as $num => $user) {
    $num++;
    $level = getLevel($user['gp_percent']);
    $this_num = $num;
    $num += ($pagenum*100)-100;
    $tr .= '<tr align="right">';
    if ($this_num === 1 || $num-($pagenum*100)-$num === 1) {
    $th .= '<th>№</th>';
}
    $tr .= '<td>'.$num.'</td>';
    foreach ($user as $key => $value) {
    if (strpos($key, 'percent') !== false) continue;
        if ($key !== '_id') {
        if ($this_num === 1) {
    if ($key !== 'name') {
        $th .= '<th><a href="'.$conf['siteUrl'].'golos/top/'.$key.'">'.$fields[$key].'</a></th>';
    } else {
        $th .= '<th>'.$fields[$key].'</th>';
    }

    }
    if (is_numeric($value)) $value = number_format($value, 3, ',', '&nbsp;');
    if ($key === 'golos' || $key === 'gbg' || $key === 'gp') $value .= ' <small>('.round((float)$user[$key.'_percent'], 3).'%)</small>';
if ($key === 'name') {
    $value = '<a href="'.$conf['siteUrl'].'golos/profiles/'.$value.'" target="_blank">'.$value.'</a> <img src="https://golos.id/images/gamefication/'.$level['file'].'.png" alt="'.$level['name'].'" height="24px;">';
    $tr .= '<td align="left">'.$value.'</td>';
} else {
    $tr .= '<td>'.$value.'</td>';
}
    }    
}
$tr .= '</tr>';
}
$th .= '</tr>';
}
$content = '<p>Всего: '.$get_page['counter'].'</p>
<table><thead>'.$th.'</thead>
<tbody>'.$tr.'</tbody></table>
';
} else {
    $content = '<p>Данных на данной странице не найдено. Вернитесь на предыдущую.</p>
';
$next_page = false;
}
if ($top && count($top) < 100) {
    $next_page = false;
}
$content .= '</p>';
if ($pagenum > 1) {
    $content .= '<a href="'.$conf['siteUrl'].'golos/top/'.pageUrl()[2].'/'.($pagenum-1).'">Предыдущая</a> - ';
}
if ($next_page == true) {
    $finish_page = ceil($get_page['counter'] / 100); // округляем вверх до целого числа
    $content .= '<a href="'.$conf['siteUrl'].'golos/top/'.pageUrl()[2].'/'.($pagenum+1).'">Следующая</a>
<a href="'.$conf['siteUrl'].'golos/top/'.pageUrl()[2].'/'.$finish_page.'">Последняя</a></p>';
}
    return $content;
?>