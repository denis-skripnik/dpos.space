<?php
global $conf;
$content = '';
$html = file_get_contents('http://138.201.91.11:3100/viz-top?type='.mb_strtolower(pageUrl()[2]));
$top = json_decode($html, true);

$fields = ['name' => 'Логин', 'shares' => 'Соц. капитал', 'shares_percent' => '% от всего соц. капитала', 'delegated_shares' => 'Делегировано соц. капитала другим', 'received_shares' => 'Получено соц. капитала от других делегированием', 'effective_shares' => 'Эффективный соц. капитал', 'viz' => 'Баланс VIZ', 'viz_percent' => '% от всех VIZ'];
if ($top) {
$tr = '';
    $th = '<tr>';
foreach ($top as $num => $user) {
    $num++;
    $tr .= '<tr>';
    if ($num === 1) {
    $th .= '<th>№</th>';
}
    $tr .= '<td>'.$num.'</td>';
    foreach ($user as $key => $value) {
    if ($key !== '_id') {
        if ($num === 1) {
    if (strpos($key, 'percent') === false && $key !== 'name') {
        $th .= '<th><a href="'.$conf['siteUrl'].'viz/top/'.$key.'">'.$fields[$key].'</a></th>';
    } else {
        $th .= '<th>'.$fields[$key].'</th>';
    }

    }
if ($key === 'name') $value = '<a href="'.$conf['siteUrl'].'viz/profiles/'.$value.'" target="_blank">'.$value.'</a>';
if ($key === 'gp' || $key === 'delegated_gp' || $key === 'received_gp') $value = round($value, 6);
if (strpos($key, 'percent') == true) $value = round($value, 3);
$tr .= '<td>'.$value.'</td>';
    }    
}
$tr .= '</tr>';
}
$th .= '</tr>';
}
$content = '<table><thead>'.$th.'</thead>
<tbody>'.$tr.'</tbody></table>';
return $content;
?>