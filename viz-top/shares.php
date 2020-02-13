<?php
echo '<main class="content"><h2>Сортировка</h2>
<p><span align="left">SHARES</span> <span align="right"><a href="https://dpos.space/viz-top/VIZ">VIZ</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3600/viz-top?token=SHARES');
$table = json_decode($html, true);
$top = $table['data'];
echo '<table><thead><tr><th>Позиция в топе</th><th>Логин</th><th>SHARES</th><th>Процент от всех SHARES</th><th>Баланс VIZ</th><th>Процент от всех VIZ</th></tr>
</thead><tbody id="target">';
if ($top) {
foreach ($top as $num => $user) {
$num = $num +1;
    echo '<tr><td>'.$num.'</td>
<td><a href="https://dpos.space/profiles/'.$user['login'].'/viz" target="_blank">@'.$user['login'].'</a></td>
<td>'.$user['shares'].'</td>
<td>'.$user['gests_percent'].'</td>
<td>'.$user['balance'].'</td>
<td>'.$user['balance_percent'].'</td></tr>';
}
}
echo '</tbody></table>
</main>';
?>