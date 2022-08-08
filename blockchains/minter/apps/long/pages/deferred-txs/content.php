<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
   $res = file_get_contents('http://178.20.43.121:3852/smartfarm/deferred-txs');
   $txs = json_decode($res, true);

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга. Здесь же отложенные транзакции.</p>
<p>Из-за больших комиссий мы вынуждены были сделать систему накопления сумм транзакций пользователей LONG с рассылкой раз в неделю. Ниже вы найдёте таблицу транзакций.</p>
<table id="txs_table"><thead><tr>
<th>Адрес кошелька</th>
<th>сумма</th>
<th>заметка к платежу</th>
</tr></thead><tbody id="target">';
if (count($txs) > 0) {
foreach ($txs as $tx) {
  $content .= '<tr>
<td><a href="https://dpos.space/minter/profiles/'.$tx['to'].'" target="_blank">'.$tx['to'].'</a></td>
<td>'.round($tx['value'], 8).' '.$tx['coin'].'</td>
<td>'.$tx['memo'].'</td>
</tr>';
}
$content .= '</tbody></table>';
}
return $content;
?>