<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://178.20.43.121:3000/golos-api?service=stakebot&type=jackpot');
    $result = json_decode($html, true);
    $amount = 0;
    if (isset($result['amount'])) {
      $amount = $result['amount'];
    }
    $content = '<p align="center"><a href="'.$conf['siteUrl'].'golos/stakebot">К списку текущих ставок</a></p>
<p>Список очищается после получения джекпота победителями. Это происходит в полночь по GMT (3 часа по Москве) 1 числа каждого месяца.</p>
<p>Фонд формируется за счёт 5% от сумм ставок участников.</p>
<p>Вся <a href="'.$conf['siteUrl'].'golos/profiles/golos-stake-bot/donates" target="_blank">история донатов golos_stake_bot</a>.</p>
<h2>Сумма джекпота: '.$amount.' GOLOS</h2>
<table id="table"><thead><tr><th>№</th><th>Логин</th><th>Сумма</th></tr></thead><tbody id="target">';
    if (isset($result['data'])) {
      $table = $result['data'];
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