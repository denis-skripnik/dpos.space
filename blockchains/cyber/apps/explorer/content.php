<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function node($params) {
  $html = file_get_contents('https://rpc.cyber.posthuman.digital/'.$params);
  $data = json_decode($html, true);
return $data['result'];
}

$content = '<h2>Введите в поле ниже номер блока или хэш-сумму транзакции блокчейна Cyber:</h2>
<form class="form" method = "post" action = "">
  <input type = "hidden" name = "chain" value = "cyber">
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
$last_block = node('status?')['sync_info']['latest_block_height'];
$irreversible_blocks = [$last_block, $last_block-1, $last_block-2, $last_block-3, $last_block-4, $last_block-5, $last_block-6, $last_block-7, $last_block-8, $last_block-9];
foreach ($irreversible_blocks as $irreversible_block) {
  $content .= '<li><a href="'.$conf['siteUrl'].'cyber/explorer/block/'.$irreversible_block.'" target="_blank">'.$irreversible_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="status">Статус</a></h2>
<ul>';
$status = node('status?');
$content .= '<li>Сеть: '.$status['node_info']['network'].'</li>
<li>Версия: '.$status['node_info']['version'].'</li>
<li>Хеш последнего блока: '.$status['sync_info']['latest_block_hash'].'</li>
<li>Номер последнего блока: '.$status['sync_info']['latest_block_height'].'</li>
<li>Дата и время последнего блока: '.$status['sync_info']['latest_block_time'].'</li>
<li>Адрес валидатора: '.$status['validator_info']['address'].'</li>
<li>тип публичного ключа: '.$status['validator_info']['pub_key']['type'].', ключ: '.$status['validator_info']['pub_key']['value'].'</li>
</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>