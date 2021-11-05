<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function node($params) {
  $html = file_get_contents('https://mainnet-gate.decimalchain.com/api/'.$params);
  $data = json_decode($html, true);
  return $data;
}

$content = '<h2>Введите в поле ниже номер блока или хэш-сумму транзакции блокчейна Decimal:</h2>
<form class="form" method = "post" action = "">
  <input type = "hidden" name = "chain" value = "decimal">
  <input type = "hidden" name = "service" value = "explorer">
  <label for = "data">Введите номер блока или хэш-сумму транзакции: </label>
  <input type = "text" name = "data" value="">
  <input type = "submit" value = "узнать инфу"/>
</form>
<hr />
<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#last_blocks">Последние блоки</a></li>
<li><a href="#status">Статус</a></li></ul>
<h2><a name="last_blocks">Последние блоки</a></h2>
<ul>
';
$last_blocks = node('blocks?limit=10&offset=0')['result']['blocks'];
foreach ($last_blocks as $irreversible_block) {
  $emission = (float)$irreversible_block['emission'] / (10 ** 18);
  $emission = round($emission, 3);
  $content .= '<li><a href="'.$conf['siteUrl'].'decimal/explorer/block/'.$irreversible_block['height'].'" target="_blank">'.$irreversible_block['height'].'</a> ('.$irreversible_block['txsCount'].' транзакций, эмиссия '.$emission.' DEL)</li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="status">Статус</a></h2>
<ul>';
$status = node('rpc/node_info');
$content .= '<li>Сеть: '.$status['node_info']['network'].'</li>
<li>Хеш последнего блока: '.$last_blocks[0]['hash'].'</li>
<li>Номер последнего блока: '.$last_blocks[0]['height'].'</li>
<li>Дата и время последнего блока: '.$last_blocks[0]['date'].'</li>
</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>