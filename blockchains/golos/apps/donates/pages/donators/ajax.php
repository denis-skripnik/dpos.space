<button data-fancybox-close class="btn">Закрыть</button>
<?php
$l = $_GET['login'];
$t = $_GET['token'];
$d = $_GET['date'];
$s = $_GET['siteUrl'];
$html = file_get_contents('http://138.201.91.11:3000/golos-api?service=donates&type=donators-content&login='.$l.'&token='.$t);
$data = json_decode($html, true);
echo '<h2>Посты донатера <a href="'.$s.'golos/profiles/'.$l.'" target="_blank">'.$l.'</a></h2>
<table><thead><tr><th>Ссылка на пост</th><th><a id="golos_amount">Сумма донатов</a></th></tr></thead><tbody>';
if ($data) {
foreach ($data as $post) {
  echo '<tr align="right"><td align="left">'.$post['link'].'</td>
<td>'.$post['amount'].'</td></tr>';
}
}
echo '</tbody></table>';
?>