<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
    $res = file_get_contents('http://138.201.91.11:3852/smartfarm/payd-loto');
    $tickets = json_decode($res, true);  
    $jackpot = $tickets['jackpot'];
    $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$types = ['10', '50', '100', '500', '1000'];
    $jackpot_list = '';
$contents = '';
    $tickets_lists = '';
foreach($types as $type) {
$jackpot_list .= '<li>Лотерея '.$type.' LONG: '.$jackpot[$type].' билетов, '.number_format((10 * $jackpot[$type] * 0.05), 2, ',', '&nbsp;').' LONG получат победители</li>';
$contents .= '<li><a href="#tickets'.$type.'">Билеты лотереи '.$type.' LONG</a></li>';
$tickets_lists .= '<hr>
<h3><a name="tickets'.$type.'">Список билетов лотереи '.$type.' LONG</a></h3>
<table><thead><tr>
<th>Номер</th>
<th>Адрес</th>
</tr></thead><tbody>';
if (isset($tickets[$type])) {
foreach($tickets[$type] as $n => $ticket) {
  $n++;
  $tickets_lists .= '<tr>
<td>'.$n.'</td>
    <td><a href="/minter/profiles/'.$ticket['address'].'" target="_blank">'.$ticket['address'].'</a></td>
</tr>';
}
}
$tickets_lists .= '</tbody></table>
<p align="center"><a href="#contents">К оглавлению</a></p>';
}

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга по ссылке выше. Здесь же про лотерею с покупкой билетов на 10, 50 и 100 LONG.</p>
<h2>О лотерее payd-loto</h2>
<ul><li>Покупка билетов производится путём отправки '.implode(', ', $types).' LONG на адрес<br>
<span id="send_to_address">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</span> (<input type="button" id="copy_address" value="Копировать">)<br>
<strong>Отправка другой суммы или без указания сообщения является донатом.</strong><br>
В сообщении (В консоли надо нажать "Расширенный режим") указываем<br>
<strong><span id="send_with_memo">lpl</span></strong><br>
(<input type="button" id="copy_memo" value="Копировать">)</li>
<li>Раз в <span id="pl_block_interval">'.$tickets['options']['pl_block_interval'].'</span> блоков будут определяться победители в каждой из лотерей:
Кол-во выигрывающих = кол-во билетов / 10 с математическим округлением,<br>
т. е., если билетов 15, будет 2 победителя, если 14 - 1. Если меньше 5, будет тоже один победитель</li>
<li>Сумма выигрыша = (10, 50 или 100 * кол-во билетов * 0.85 (комиссия 15%)) / кол-во победителей.</li>
<li>Эта сумма и рассылается победившим билетам. Комиссия же остаётся на адресе наград, после чего будет участвовать в следующем фарминге и лотерее среди держателей пула <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></li>
<li><strong>Если в раунде лишь один билет, он переносится на следующий раунд, пока не добавит кто-то ещё один или несколько билетов.</strong></li></ul>
<p><strong>Канал с объявлениями победителей: <a href="https://t.me/long_have_fun" target="_blank">@long_have_fun</a></strong></p>
<p><strong>До выбора победителей осталось <span id="end_round"></span><br>
Не рекомендуем покупать билеты сразу после сброса таймера, пока не очистится список билетов (это может привести к донату вместо участия).</strong></p>
<hr>
<h3>Джекпот раз в <span id="plj_block_interval">'.$tickets['options']['plj_block_interval'].'</span> блоков</h3>
<p><strong>В джекпоте участвуют все билеты, что играли в лотерею, за неделю. Фонд - это 5% от покупки каждого билета.<br>
Число выигрышей считается также, как в лотереях, но делится на 1000 (т. е. при 1490 будет 1 победитель, при 1723 - 2, при 2021 - 2, при 2579 - 3 и т.п.)</strong></p>
<h4>Фонд джекпота каждой из лотерей и число билетов</h4>
<ol>'.$jackpot_list.'</ol>
<p><strong>До выбора победителей в джекпоте осталось <span id="jackpot_end_round"></span><br>
Не рекомендуем покупать билеты сразу после сброса таймера, пока не очистится список билетов (это может привести к донату вместо участия).</strong></p>
<hr>
<h3><a name="contents">Оглавление</a></h3>
<ul><li><a href="#buy_ticket">Купить билет</a></li>
'.$contents.'
</ul>
<hr>
<h3><a name="buy_ticket">Купить билет</a></h3>
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="loto_type">Тип лотереи<br>
<select name="loto_type">
<option value="">Выберите тип лотереи</option>
</select></p>
<p><strong><input type="button" id="action_buy_ticket" value="Купить"></strong></p>
</form></div>
<p align="center"><a href="#contents">К оглавлению</a></p>
'.$tickets_lists;
return $content;
?>