<?php
echo '<main class="content">';
$html = file_get_contents('http://138.201.91.11:3100/golos-top?type='.mb_strtolower($array_url[1]));
$top = json_decode($html, true);

$fields = ['name' => 'Логин', 'gp' => 'СГ', 'gp_percent' => '% от всей СГ', 'delegated_gp' => 'Делегировано СГ другим', 'received_gp' => 'Получено СГ от других делегированием', 'effective_gp' => 'Эффективная СГ, учитываемая при апвотинге', 'golos' => 'Баланс GOLOS', 'golos_percent' => '% от всех GOLOS', 'gbg' => 'Баланс GBG', 'gbg_percent' => '% от всех GBG'];
if ($top) {
$tr = '';
    $th = '<tr>';
foreach ($top as $num => $user) {
    $num++;
    $tr .= '<tr>';
    if ($num === 1) {
    $th .= '<th>Номер</th>';
}
    $tr .= '<td>'.$num.'</td>';
    foreach ($user as $key => $value) {
    if ($key !== '_id') {
        if ($num === 1) {
            if (strpos($key, 'percent') === false && $key !== 'name') {
                $th .= '<th><a href="https://dpos.space/golos-top/'.$key.'">'.$fields[$key].'</a></th>';
            } else {
                $th .= '<th>'.$fields[$key].'</th>';
            }
    }
if ($key === 'name') $value = '<a href="https://dpos.space/profiles/'.$value.'/golos" target="_blank">'.$value.'</a>';
if ($key === 'gp' || $key === 'delegated_gp' || $key === 'received_gp') $value = round($value, 6);
$tr .= '<td>'.$value.'</td>';
    }    
}
$tr .= '</tr>';
}
$th .= '</tr>';
}
echo '<table><thead>'.$th.'</thead>
<tbody>'.$tr.'</tbody></table></main>';
?>