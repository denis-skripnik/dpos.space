<?php
echo '<main class="content"><h2>Сортировка</h2>
<p><span align="left">GBG</span> <span align="center"><a href="https://dpos.space/golos-top/GP">СГ</a></span> <span align="right"><a href="https://dpos.space/golos-top/GOLOS">GOLOS</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3100/golos-top?token=GBG');
$table = json_decode($html, true);
$top = $table['data'];
echo '<table><thead><tr><th>Позиция в топе</th><th>Логин</th><th>Баланс GBG</th><th>Процент от всех GBG</th><th>Баланс GOLOS</th><th>Процент от всех GOLOS</th><th>MGESTS</th><th>СГ</th><th>Процент от общей СГ</th></tr>
</thead><tbody id="target">';
if ($top) {
foreach ($top as $num => $user) {
$num = $num +1;
    echo '<tr><td>'.$num.'</td>
<td><a href="https://dpos.space/profiles/'.$user['login'].'/golos" target="_blank">@'.$user['login'].'</a></td>
<td>'.$user['sbd_balance'].'</td>
<td>'.$user['sbd_balance_percent'].'</td>
<td>'.$user['balance'].'</td>
<td>'.$user['balance_percent'].'</td>
<td>'.$user['mgests'].'</td>
<td>'.$user['gp'].'</td>
<td>'.$user['gests_percent'].'</td></tr>';
}
}
echo '</tbody></table>
</main>';
?>