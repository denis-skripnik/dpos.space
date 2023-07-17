<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$content = '';
$pagenum = 1;
if (isset(pageUrl()[3]) && is_numeric(pageUrl()[3])) {
    $pagenum = pageUrl()[3];
} else if (isset(pageUrl()[3]) && !is_numeric(pageUrl()[3])) {
    $data = get404Page();
return;
}
$html = file_get_contents('http://178.20.43.121:3100/viz-api?service=top&type='.mb_strtolower(pageUrl()[2]).'&page='.$pagenum);
$top = json_decode($html, true);
if ($top && count($top) > 0) {
$fields = ['name' => 'Логин', 'shares' => 'Соц. капитал', 'shares_percent' => '% от всего соц. капитала', 'delegated_shares' => 'Делегировано соц. капитала другим', 'received_shares' => 'Получено соц. капитала от других делегированием', 'effective_shares' => 'Эффективный соц. капитал', 'vesting_withdraw_rate' => 'Выводимый соц. капитал', 'viz' => 'Баланс VIZ', 'viz_percent' => '% от всех VIZ'];
if ($top) {
$tr = '';
    $th = '<tr>';
foreach ($top as $num => $user) {
    $num++;
    $this_num = $num;
    $num += ($pagenum*100)-100;
    $tr .= '<tr align="right">';
    if ($this_num === 1 || $num-($pagenum*100)-$num === 1) {
    $th .= '<th>№</th>';
}
    $tr .= '<td>'.$num.'</td>';
    foreach ($user as $key => $value) {
    if ($key !== '_id') {
        if ($this_num === 1) {
    if (strpos($key, 'percent') === false && $key !== 'name') {
        $th .= '<th><a href="'.$conf['siteUrl'].'viz/top/'.$key.'">'.$fields[$key].'</a></th>';
    } else {
        $th .= '<th>'.$fields[$key].'</th>';
    }

    }
if ($key === 'name') $value = '<a href="'.$conf['siteUrl'].'viz/profiles/'.$value.'" target="_blank">'.$value.'</a>';
if (strpos($key, 'percent') == true) $value = round($value, 3).'%';
if (is_numeric($value)) $value = number_format($value, 3, ',', ' ');
$tr .= '<td>'.$value.'</td>';
    }    
}
$tr .= '</tr>';
}
$th .= '</tr>';
}
$content = '<table><thead>'.$th.'</thead>
<tbody>'.$tr.'</tbody></table>
';
} else {
    $content = '<p>Данных на данной странице не найдено. Вернитесь на предыдущую.</p>
';
}
$content .= '</p>';
if ($pagenum > 1) {
    $content .= '<a href="'.$conf['siteUrl'].'viz/top/'.pageUrl()[2].'/'.($pagenum-1).'">Предыдущая</a> - ';
}
$content .= '<a href="'.$conf['siteUrl'].'viz/top/'.pageUrl()[2].'/'.($pagenum+1).'">Следующая</a></p>';
return $content;
?>