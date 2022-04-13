<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
      $url = pageUrl();
      $loto_date = gmdate("Y-m-d");
      if (isset($url[3])) $loto_date = $url[3];
   $res = file_get_contents('http://178.20.43.121:3852/smartfarm/loto?date='.$loto_date);

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга. Здесь же про лотерею проекта.</p>
<h2>О лотерее проекта LONG (<a href="/minter/long/phelosophy" target="_blank">философия проекта</a>)</h2>
<p><strong>Проводится каждый день в случайное время.</strong></p>
<ol>
<li>Метод: сумма фарминга, умноженная на 10, но не более 10 000 LONG.</li>
<li>Собирается список топ 100 провайдеров пула</li>
<li>Проверяется, меньше ли или равно 50 количество получений</li>
<li>Основное смотрите в подробностях лотереи.</li>
</ol>
<hr>
<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#info">Подробности</a></li>
<li><a href="#history">Предыдущие лотереи</a></li>
</ul>
<hr>
<h2><a name="info">Подробности</a></h2>
<p>'.$res.'</p>
<hr>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="history">Предыдущие лотереи</a></h2>';
$start = strtotime('2021-10-29 GMT');
$finish = time();
$date_line = $finish - $start;
if ($date_line >= 86400) {
  $content .= '<ul>';
  for($i=$start; $i < $finish; $i+=86400){
    $now_date = gmdate("Y-m-d", $i);
    if ($now_date === gmdate("Y-m-d")) continue;
    $content .= '<li><a href="/minter/long/loto/'.$now_date.'" target="_blank">'.$now_date.'</a></li>
';
}
$content .= '</ul>';
}
$content .= '<hr>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>