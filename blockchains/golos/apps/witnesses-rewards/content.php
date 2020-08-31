<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://138.201.91.11:3000/golos-api?service=witnesses');
    $table = json_decode($html, true);
    $content = '<table id="table"><thead><tr><th>Логин</th><th>за вчерашний день</th><th>за сегодня</th><th>за прошлый месяц</th><th>за текущий месяц</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $witness) {
      $content .= '<tr align="right"><td><a href="'.$conf['siteUrl'].'golos/profiles/'.$witness['login'].'/witness" target="_blank">'.$witness['login'].'</a></td>
    <td>'.$witness['old_daily_profit'].'</td>
    <td>'.$witness['now_daily_profit'].'</td>
    <td>'.$witness['old_monthly_profit'].'</td>
    <td>'.$witness['now_monthly_profit'].'</td>
    </tr>';
    }
    }
    $content .= '</tbody></table>';
return $content;
?>