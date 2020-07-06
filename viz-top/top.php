<?php
echo '<main class="content">';
$html = file_get_contents('http://138.201.91.11:3100/viz-top?type='.mb_strtolower($array_url[1]));
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
        $th .= '<th><a href="https://dpos.space/viz-top/'.$key.'">'.$fields[$key].'</a></th>';
    } else {
        $th .= '<th>'.$fields[$key].'</th>';
    }

    }
if ($key === 'name') $value = '<a href="https://dpos.space/profiles/'.$value.'/viz" target="_blank">'.$value.'</a>';
if ($key === 'gp' || $key === 'delegated_gp' || $key === 'received_gp') $value = round($value, 6);
if (strpos($key, 'percent') == true) $value = round($value, 3);
$tr .= '<td>'.$value.'</td>';
    }    
}
$tr .= '</tr>';
}
$th .= '</tr>';
}
echo '<table><thead>'.$th.'</thead>
<tbody>'.$tr.'</tbody></table>
</main>';
?>