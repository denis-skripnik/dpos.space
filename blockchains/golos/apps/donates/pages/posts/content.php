<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
  if (isset(pageUrl()[3])) {
  if (!isset($_GET['month']) && !isset($_GET['year'])) {
    $_GET['month'] = (int)date('m');
    $_GET['year'] = (int)date('Y');
     } else {
      $_GET['month'] = (int)$_GET['month'];
      $_GET['year'] = (int)$_GET['year'];
   }
$months = [1 => 'Январь', 2 => 'Февраль', 3 => 'Март', 4 => 'Апрель', 5 => 'Май', 6 => 'Июнь', 7 => 'Июль', 8 => 'Август', 9 => 'Сентябрь', 10 => 'Октябрь', 11 => 'ноябрь', 12 => 'Декабрь'];
$selected = [];
$selected[$_GET['month']] = 'selected ';
    $content = '<link rel="stylesheet" type="text/css" href="//cdn.datatables.net/1.10.15/css/jquery.dataTables.min.css">
    <script type="text/javascript" src="//cdn.datatables.net/1.10.15/js/jquery.dataTables.min.js"></script>
    <p><span align="left"><a href="'.$conf['siteUrl'].'golos/donates/donators">Топ донатящих</a></span> <span align="right"><a href="'.$conf['siteUrl'].'golos/donates/comments">Топ комментариев</a></span></p>
    <h2>Выберите дату</h2>
    <form class="form" action="'.$conf['siteUrl'].'golos/donates/posts/'.pageUrl()[3].'/" method="get">
    <p>Месяц:
    <select name="month" placeholder="Месяц">';
    foreach ($months as $number => $month) {
      $content .= '<option '.(isset($selected[$number]) ? $selected[$number] : "").'value="'.$number.'">'.$month.'</option>';
      }
    $content .= '</select></p>
    <p>Год:
    <select name="year" placeholder="Выберите год">
    <option value="2024">2024</option>
    <option value="2023">2023</option>
    <option value="2022">2022</option>
    <option value="2021">2021</option>
    <option value="2020">2020</option>
    </select></p>
    <p><input type="submit" value="Посмотреть"></p></form>';
    $html = file_get_contents('http://178.20.43.121:3000/golos-api?service=donates&type=posts&token='.pageUrl()[3].'&date='.$_GET['month'].'_'.$_GET['year']);
    $table = json_decode($html, true);
    $content .= '<table id="table"><thead><tr><th>Ссылка на пост</th><th><a id="golos_amount">Сумма донатов</a></th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $post) {
      $content .= '<tr align="right"><td align="left">'.$post['link'].'</td>
    <td>'.$post['amount'].'</td></tr>';
    }
    }
    $content .= '</tbody></table>
    <script src="'.$conf['siteUrl'].'blockchains/golos/apps/donates/sort.js"></script>';
  } else {
    $content = '<p>Выберите токен</p>
<ul><li><a href="'.$conf['siteUrl'].'golos/donates/posts/golos" target="_blank">GOLOS</a></li>
<li><a href="'.$conf['siteUrl'].'golos/donates/posts/gbg" target="_blank">GBG</a></li>';
$html = file_get_contents('http://178.20.43.121:3000/golos-api?service=donates&type=tokens');
$tokens = json_decode($html, true);
if (isset($tokens) && count($tokens) > 0) {
  foreach ($tokens as $token) {
    $content .= '<li><a href="'.$conf['siteUrl'].'golos/donates/posts/'.$token.'" target="_blank">'.$token.'</a></li>';
  }
}
$content .= '</ul>
<p>Или введите его название</p>
<form class="form" action="'.$conf['siteUrl'].'golos/donates/posts" method="post">
<input type="hidden" name="chain" value="golos">
<input type="hidden" name="service" value="donates">
<input type="hidden" name="page" value="posts">
<p><input type="text" name="token" value="" placeholder="Введите токен"></p>
<p><input type="submit" value="Посмотреть"></p></form>';
  }

return $content;
?>