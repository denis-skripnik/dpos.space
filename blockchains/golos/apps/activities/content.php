<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://138.201.91.11:3000/golos-api?service=activity_stats');
    $table = json_decode($html, true);
    $content = '<link rel="stylesheet" type="text/css" href="//cdn.datatables.net/1.10.15/css/jquery.dataTables.min.css">
<script type="text/javascript" src="//cdn.datatables.net/1.10.15/js/jquery.dataTables.min.js"></script>
<p>Все данные удаляются в полночь по Москве. Иногда возможно будет пропускать, но чаще всего нет.</p>
<table id="table"><thead><tr><th>Логин</th><th>Постов и комментариев</th><th>Количество флагов</th><th>Количество апвотов</th><th>Средний процент флага</th><th>Средний процент апа</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $user) {
      if ($user['flags'] > 0) {
          $average_flags_weight = $user['all_flags_weight'] / $user['flags'];
          $average_flags_weight /= 100;
        } else {
        $average_flags_weight = 0;
      }
          if ($user['upvotes'] > 0) {
            $average_upvotes_weight = $user['all_upvotes_weight'] / $user['upvotes'];
            $average_upvotes_weight /= 100;
        } else {
              $average_upvotes_weight = 0;
          }
      $content .= '<tr align="right"><td align="left"><a href="'.$conf['siteUrl'].'golos/profiles/'.$user['login'].'" target="_blank">'.$user['login'].'</a></td>
<td>'.$user['content'].'</td>
<td>'.$user['flags'].'</td>
<td>'.$user['upvotes'].'</td>
<td>'.$average_flags_weight.'</td>
<td>'.$average_upvotes_weight.'</td></tr>';
    }
    }
    $content .= '</tbody></table>
    <script src="'.$conf['siteUrl'].'blockchains/golos/apps/activities/sort.js"></script>';
return $content;
?>