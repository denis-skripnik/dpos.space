<?php
 if (!isset($_GET['month']) && !isset($_GET['year'])) {
    $_GET['month'] = 2;
    $_GET['year'] = 2020;
     } else {
        $_GET['month'] = (float)$_GET['month'];
        $_GET['year'] = (float)$_GET['year'];
     }
echo '<main class="content">
<link rel="stylesheet" type="text/css" href="//cdn.datatables.net/1.10.15/css/jquery.dataTables.min.css">
<script type="text/javascript" src="//cdn.datatables.net/1.10.15/js/jquery.dataTables.min.js"></script>
<p><strong><a href="https://dpos.space/golos-donates">Посты-лидеры по количеству донатов</a></strong></p>
<h2>Выберите дату</h2>
<form action="" method="get">
<p>Месяц:
<select name="month" placeholder="Месяц">
<option value="2">Февраль</option>
</select></p>
<p>Год:
<select name="year" placeholder="Выберите год">
<option value="2020">2020</option>
</select></p>
<p><input type="submit" value="Посмотреть"></p></form>';
$html = file_get_contents('http://138.201.91.11:3900/donates?type=posts&date='.$_GET['month'].'_'.$_GET['year']);
$table = json_decode($html, true);
echo '<table id="table"><thead><tr><th>Ссылка на пост</th><th><a id="golos_amount">Сумма донатов в GOLOS</a></th><th><a id="gbg_amount">Сумма донатов в GBG</a></th></tr></thead><tbody id="target">';
if ($table) {
foreach ($table as $post) {
echo '<tr><td>'.$post['link'].'</td>
<td>'.$post['golos_amount'].'</td>
<td>'.$post['gbg_amount'].'</td></tr>';
}
}
echo '</tbody></table>
<script src="sort.js"></script>
</main>';
?>