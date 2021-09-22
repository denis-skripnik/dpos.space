<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
    $api = file_get_contents('http://138.201.91.11:3852/smartfarm/rps');
    $res = json_decode($api, true);  
    $block_intevral = $res['block_interval'];
    $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга по ссылке выше. Здесь же про игру "Камень, ножницы, бумага".</p>
<h2>Об игре rps</h2>
<ul><li>Для участия отправляете любую сумму LONG на адрес<br>
<span id="send_to_address">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</span> (<input type="button" id="copy_address" value="Копировать">)<br>
В сообщении (В консоли надо нажать "Расширенный режим") указываем<br>
<strong><span id="send_with_memo">lrps</span></strong><br>
(<input type="button" id="copy_memo" value="Копировать">)<br>
<strong>В случае выпадания одинаковых предметов побеждает тот, у кого больше сумма. Если суммы ставок одинаковые, выигрыш делится на число победителей.</strong></li>
<li>Раз в <span id="rps_block_interval">'.$res['block_interval'].'</span> блоков будут определяться победитель:
Если в конце не остаётся одинаковое количество предметов, победитель один. Если 2 - 2.</li>
<li>Сумма выигрыша = сумма всех ставок * 0.9 / кол-во победителей.</li>
<li>Эта сумма и рассылается победившим. Комиссия же остаётся на адресе наград, после чего будет участвовать в следующем фарминге и лотерее среди держателей пула <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a></li>
<li><strong>Если в раунде лишь один участник, он переносится на следующий раунд, пока не присоединится кто-то ещё.</strong></li></ul>
<p><strong>Пост с публикациями выигрышей (редактируется каждый раунд): <a href="https://t.me/long_have_fun/64" target="_blank">@long_have_fun/64</a></strong></p>
<p><strong>До выбора победителей осталось <span id="end_rps_round"></span></p>
<hr>
<h3><a name="contents">Оглавление</a></h3>
<ul><li><a href="#play">Играть</a></li>
<li><a href="#now_round">Участники</a></li>
</ul>
<hr>
<h3><a name="play">Играть</a></h3>
<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page"><form>
<p><label for="amount">Сумма ставки (максимум <span id="max_bid"></span> LONG) <br>
<input type="number" min=1 name="amount"></p>
<p><strong><input type="button" id="action_rps_play" value="Поехали!"></strong></p>
</form></div>
<p align="center"><a href="#contents">К оглавлению</a></p>
<hr>
<h3><a name="results">Результаты последнего раунда</a></h3>
<p><strong><input type="button" onclick="location.reload()" value="Обновить"></strong></p>
<div id="rps_results"></div>
<p align="center"><a href="#contents">К оглавлению</a></p>
<hr>
<h3><a name="now_round">Участники сего раунда</a></h3>
<p><strong><input type="button" onclick="location.reload()" value="Обновить"></strong></p>
<table><thead><tr>
<th>Адрес</th>
<th>Ставка</th>
<th>Предмет</th>
</tr></thead>
<tbody>';
$types = ['Камень', 'Ножницы', 'Бумага'];
foreach($res['members'] as $member) {
  $content .= '<tr>
<td><a href="/minter/profiles/'.$member['address'].'" target="_blank">'.$member['address'].'</a></td>
<td>'.$member['amount'].' LONG</td>
<td>'.$types[$member['type']].'</td>
</tr>';
}
$content .= '</tbody></table>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>