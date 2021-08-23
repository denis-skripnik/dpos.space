<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $html = file_get_contents('http://138.201.91.11:3258/smartfarm/provider?address='.pageUrl()[3]);
  $provider = json_decode($html, true);
$friends = '{}';
  if (isset($provider['friends']) && count($provider['friends']) > 0) $friends = json_encode($provider['friends'], true);
  
  $content = '<p align="center"><strong><a href="/minter/long">Фарминг</a> <a href="/minter/long/loto">Лотерея</a></strong></p>
<h2>Семейный калькулятор LONG</h2>
<p>Данный раздел создан по просьбе людей, которые хотели бы дать возможность своим друзьям и родным получать доход с фарминга, а также зарабатывать на привлечении друзей, сохраняя повышенный процент, который накапливался Вами при помощи инвест. дней. Как это работает?</p>
<p>Как Вы знаете, каждый кошелёк, который реинвестирует доход от фарминга обратно в пул получает инвест. дни. Они увеличивают процент от фарминга на Вашем кошельке. Ваши друзья и родные, которым некогда разбираться во всех тонкостях Minter могут держать токены на Вашем кошельке, а Вы в свою очередь сможете открыть для них своего рода индивидуальный счёт. Более того, Вы можете ввести в ручную процент заработка каждого участника в том случае, если Вы хотите дополнительно получать прибыль за счёт вновь прибывших. Иными словами Вы можете сами решить, сколько зарабатывает приглашенный.</p>
<h3>Пример</h3>
<p>Я зарабатываю на фарминге в пуле LONG/BIP 0,8% в день.</br />
Мой друг Павел узнал о том, что можно иметь ежедневный доход и решил попробовать с небольшой суммы (1000 рублей). Павел попросил меня объяснить ему, как это сделать. Но регистрировать личный кошелёк, разбираться в принципе работы и увеличивать самому статистику у Павла просто нет времени.</p>
<p>Таким образом я куплю для Павла сам BIP, обменяю их на LONG и сам обеспечу ему фарминг, запомнив лишь итоговое количество токенов пула.<br />
Я могу назначить Павлу заработок в 0.5%/день (из максимальных 0.8% на моём кошельке), а остальные 0.3%/день будут моей пассивной прибылью.<br />
А Павлу я смогу просто скинуть ссылку на данную страницу, где в выпадающем списке он будет под кодовым именем "Друг 1".</p>
<span style="display: none" id="json_friends">'.$friends.'</span>';
if (isset(pageUrl()[3]) && isset($provider)) {
  $get_amount = $provider['get_amount'] + $provider['get_loto'];
  $content .= '<h2>Адрес: <a href="https://dpos.space/minter/profiles/'.pageUrl()[3].'" target="_blank">'.pageUrl()[3].'</a></h2>
<h3>Вычисление</h3>
<p>Сумма последнего получения (фарминг + лотерея, если выиграл): <span id="all_get_amount">'.$get_amount.'</span></p>
<form>
<p><label for="friends_templates">Сохранённые друзья:<br>
<select name="friends_templates">
<option value="">Выберите друга</option>
</select>
</label> (<span id="delete_friend"></span>)</p>

<p><label for="lp_tokens">Число LP-токенов:<br>
<input type="text" name="lp_tokens" min="0" value="" placeholder="Введите число LP-токенов от 0"> (из <span id="max_lp">'.$provider['liquidity'].'</span>)
</label></p>
<p><label for="calc_percent">Процент (доля) получателя:<br>
<input type="range" name="calc_percent" min="0" max="100" step="0.2" placeholder="Выберите процент"> <span id="lp_percent"></span>%
</label></p>
<p><label for="my_share">Оставить себе (процентов):<br>
<input type="range" name="my_share" min="0" max="100" value="0" placeholder="Выберите процент"> <span id="self_percent"></span>%
</label></p>
<p align="center"><strong>Отправить <span id="send_amount">0</span></strong</p>
<p align="center"><input type="button" value="Сохранить" id="save_friend"></p>
<p id="save_link"></p>
</form>';
}
return $content;
?>