<?php
echo '<main class="content"><h2>Сортировка</h2>
<p><span align="left">СГ</span> <span align="center"><a href="https://dpos.space/golos-top/GBG">GBG</a></span> <span align="right"><a href="https://dpos.space/golos-top/GOLOS">GOLOS</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3100/golos-top?token=GP');
$table = json_decode($html, true);
$top = $table['data'];
echo '<table><thead><tr><th>Позиция в топе</th><th>Логин</th><th>СГ</th><th>MGESTS</th><th>Процент от общей СГ</th><th>Баланс GOLOS</th><th>Процент от всех GOLOS</th><th>Баланс GBG</th><th>Процент от всех GBG</th></tr>
</thead><tbody id="target">';
if ($top) {
foreach ($top as $num => $user) {
$num = $num +1;
    echo '<tr><td>'.$num.'</td>
<td><a href="https://dpos.space/profiles/'.$user['login'].'/golos" target="_blank">@'.$user['login'].'</a></td>
<td>'.$user['gp'].'</td>
<td>'.$user['mgests'].'</td>
<td>'.$user['gests_percent'].'</td>
<td>'.$user['balance'].'</td>
<td>'.$user['balance_percent'].'</td>
<td>'.$user['sbd_balance'].'</td>
<td>'.$user['sbd_balance_percent'].'</td></tr>';
}
}
echo '</tbody></table>
</main>';
?>