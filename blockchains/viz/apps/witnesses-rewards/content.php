<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://178.20.43.121:3100/viz-api?service=witnesses');
    $table = json_decode($html, true);
    $content = '<p><strong>Обновление происходит в полночь по GMT, но не все сразу делегаты обновляются, а те, которые подписывают блоки.</strong></p>
<table id="table"><thead><tr><th>Логин</th><th>за вчерашний день</th><th>за сегодня</th><th>за прошлый месяц</th><th>за текущий месяц</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $witness) {
      $content .= '<tr align="right"><td><a href="'.$conf['siteUrl'].'viz/profiles/'.$witness['login'].'/witness" target="_blank">'.$witness['login'].'</a></td>
    <td>'.round($witness['old_daily_profit'], 3).'</td>
    <td>'.round($witness['now_daily_profit'], 3).'</td>
    <td>'.round($witness['old_monthly_profit'], 3).'</td>
    <td>'.round($witness['now_monthly_profit'], 3).'</td>
    </tr>';
    }
    }
    $content .= '</tbody></table>';
return $content;
?>