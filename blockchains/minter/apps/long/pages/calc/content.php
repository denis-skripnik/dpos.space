<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $html = file_get_contents('http://138.201.91.11:3852/smartfarm/provider?address='.pageUrl()[3]);
  $provider = json_decode($html, true);

$content = '<p align="center"><strong><a href="/minter/long">Фарминг</a> <a href="/minter/long/loto">Лотерея</a></strong></p>
<h2>Семейный калькулятор LONG</h2>
<p>Допустим, у вас есть семья и друзья. Они захотели вложиться в LONG, но не хотят разбираться с кошельками.<br>
Они отдают вам рубли, доллары или иную обычную валюту, после чего вы покупаете на них BIP и LONG с последующим добавлением в пул.<br>
Данный калькулятор позволит рассчитать, сколько кому рассылать прибыли в соответствии с их долей в вашем пуле.</p>';
if (isset(pageUrl()[3]) && isset($provider)) {
  $get_amount = $provider['get_amount'] + $provider['get_loto'];
  $content .= '<h2>Адрес: <a href="https://dpos.space/minter/profiles/'.pageUrl()[3].'" target="_blank">'.pageUrl()[3].'</a></h2>
<h3>Вычисление</h3>
<p>Сумма последнего получения (фарминг + лотерея, если выиграл): <span id="all_get_amount">'.$get_amount.'</span></p>
<form>
<p><label for="lp_tokens">Число LP-токенов:<br>
<input type="text" name="lp_tokens" min="0" value="" placeholder="Введите число LP-токенов от 0"> (из <span id="max_lp">'.$provider['liquidity'].'</span>)
</label></p>
<p><label for="calc_percent">Процент (доля) получателя:<br>
<input type="range" name="calc_percent" min="0" max="100" placeholder="Выберите процент"> %
</label></p>
<p><label for="my_share">Оставить себе (процентов):<br>
<input type="range" name="my_share" min="0" max="100" value="0" placeholder="Выберите процент"> %
</label></p>
<p align="center"><strong>Отправить <span id="send_amount">0</span></strong</p>
</form>';
}
return $content;
?>