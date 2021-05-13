<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function node($params) {
  $html = file_get_contents('https://api.minter.one/v2/'.$params);
  $data = json_decode($html, true);
  return $data;
}

$content = '<h2>Введите в поле ниже номер блока или хэш-сумму транзакции блокчейна Minter:</h2>
<form class="form" method = "post" action = "">
  <input type = "hidden" name = "chain" value = "minter">
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
$last_block = node('status?')['latest_block_height'];
$irreversible_blocks = [$last_block, $last_block-1, $last_block-2, $last_block-3, $last_block-4, $last_block-5, $last_block-6, $last_block-7, $last_block-8, $last_block-9];
foreach ($irreversible_blocks as $irreversible_block) {
  $content .= '<li><a href="'.$conf['siteUrl'].'minter/explorer/block/'.$irreversible_block.'" target="_blank">'.$irreversible_block.'</a></li>';
}
$content .= '</ul>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="status">Статус</a></h2>
<ul>';
$status = node('status?');
$content .= '<li>Сеть: '.$status['network'].'</li>
<li>Хеш последнего блока: '.$status['latest_block_hash'].'</li>
<li>Номер последнего блока: '.$status['latest_block_height'].'</li>
<li>Дата и время последнего блока: '.$status['latest_block_time'].'</li>
<li>Публичный ключ валидатора: '.$status['public_key'].'</li></ul>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>