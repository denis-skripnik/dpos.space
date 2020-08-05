<button data-fancybox-close class="btn">Закрыть</button>
<?php
$r = $_GET['referrer'];
$s = $_GET['siteUrl'];
$html = file_get_contents('http://138.201.91.11:3000/golos-api?service=referrers&type=one&login='.$r);
$data = json_decode($html, true);
echo '<h2>Рефералы пригласителя <a href="'.$s.'golos/profiles/'.$data['login'].'" target="_blank">'.$data['login'].'</a></h2>
<ul>';
foreach ($data['referals'] as $referal) {
    echo '<li><a href="'.$s.'golos/profiles/'.$referal.'" target="_blank">'.$referal.'</a></li>
';
}

echo '</li>';
?>