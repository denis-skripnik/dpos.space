<?php
  global $conf;
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
    <p><span align="left"><a href="'.$conf['siteUrl'].'golos/donates/comments">Топ комментариев</a></span> <span align="right"><a href="'.$conf['siteUrl'].'golos/donates/posts">Топ постов</a></span></p>
    <h2>Выберите дату</h2>
    <form action="'.$conf['siteUrl'].'golos/donates/" method="get">
    <p>Месяц:
    <select name="month" placeholder="Месяц">';
foreach ($months as $number => $month) {
$content .= '<option '.(isset($selected[$number]) ? $selected[$number] : "").'value="'.$number.'">'.$month.'</option>';
}
    $content .= '</select></p>
    <p>Год:
    <select name="year" placeholder="Выберите год">
    <option value="2020">2020</option>
    </select></p>
    <p><input type="submit" value="Посмотреть"></p></form>';
    $html = file_get_contents('http://138.201.91.11:3900/donates?type=donators&date='.$_GET['month'].'_'.$_GET['year']);
    $table = json_decode($html, true);
    $content .= '<table id="table"><thead><tr><th>Логин</th><th>Сумма донатов в GOLOS</th><th>Сумма донатов в GBG</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $donator) {
      $content .= '<tr><td>'.$donator['link'].'</td>
    <td>'.$donator['golos_amount'].'</td>
    <td>'.$donator['gbg_amount'].'</td></tr>';
    }
    }
    $content .= '</tbody></table>
    <script src="'.$conf['siteUrl'].'blockchains/golos/apps/donates/sort.js"></script>';
return $content;
?>