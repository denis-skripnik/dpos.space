<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $html = file_get_contents('http://138.201.91.11:3000/golos-api?service=stakebot&type=bids');
    $table = json_decode($html, true);
    $content = '<p align="center"><a href="'.$conf['siteUrl'].'golos/stakebot/jackpot">Джекпот</a></p>
<p>Список сбрасывается в 18:00 по Москве.</p>
<p>Вся <a href="'.$conf['siteUrl'].'golos/profiles/golos-stake-bot/donates" target="_blank">история донатов golos_stake_bot</a>.</p>
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