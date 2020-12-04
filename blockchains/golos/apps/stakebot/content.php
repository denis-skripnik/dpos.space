<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://138.201.91.11:3000/golos-api?service=stakebot');
    $table = json_decode($html, true);
    $content = '<p>Список сбрасывается в 18:00 по Москве.</p>
<table id="table"><thead><tr><th>№</th><th>Логин</th><th>Сумма</th></tr></thead><tbody id="target">';
    if ($table) {
    foreach ($table as $key => $value) {
      $n = $key + 1;
      $content .= '<tr align="right"><td>'.$n.'</td>
<td><a href="'.$conf['siteUrl'].'golos/profiles/'.$value['user'].'" target="_blank">'.$value['user'].'</a></td>
    <td>'.$value['amount'].' GOLOS</td>
      </tr>';
    }
    }
    $content .= '</tbody></table>';
return $content;
?>