<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Для работы с Minter swap необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page">
<div class="tab">
<a class="tablinks" onclick="openMode(event, `Обмен`)">Обмен</a>
<a class="tablinks" onclick="openMode(event, `Вложить`)">Вложить</a>
</div>

<div id="Обмен" class="tabcontent">
<form class="form" name="postForm">
<p><label for="tokens">Продаём токен:
<select name="tokens"></select></label></p>
<p><label for="convert_amount">Сумма конвертации (<span id="max_token_convert">Обменять все доступные <span id="max_convert_amount"></span> <span class="convert_modal_token"></span></span>):</label></p>
<p><input type="text" name="convert_amount" id="action_convert_amount" required placeholder="Введите сумму в формате 1.000"></p>
<p><label for="convert_to">Монета получения:</label></p>
<p><input type="text" name="convert_to" id="action_convert_to" placeholder="BIP"></p>
<p><strong>Комиссия: <span id="convert_fee"></span>
Сумма покупки: <span id="buy_amount"></span></strong></p>
<span style="display: none;" id="swap_route"></span>
<p><input type="button" id="action_convert_start" value="Обменять"></p>
 </form>
</div>
<div id="Вложить" class="tabcontent">
<h2>Добавить</h2>
<form class="form" name="postForm">
<p><label for="tokens1">Токен №1:
<select name="tokens1"></select></label></p>
<p><label for="pool_amount1">Сумма в <span class="convert_modal_token1"></span> (<span id="max_token_pool1">Максимум - <span id="max_pool_amount1"></span></span>):</label></p>
<p><input type="text" name="pool_amount1" id="action_pool_amount1" required placeholder="Введите сумму в формате 1.000"></p>
<p><label for="tokens2">Токен №2:
      <select name="tokens2"></select></label></p>
<p id="new_pool" style="display: none;"><strong>Пула такого нет или ошибка Ноды. Введите во второй сумме, сколько готовы передать в новый пул токенов.</strong></p>
      <p><label for="pool_amount2">Сумма в <span class="convert_modal_token2"></span> (<span id="max_token_pool2">Максимум - <span id="max_pool_amount2"></span></span>):</label></p>
      <p><input type="text" name="pool_amount2" id="action_pool_amount2" required placeholder="Введите сумму в формате 1.000"></p>
<p><strong>Комиссия: <span id="pool_fee"></span></strong></p>
<p><input type="button" id="action_pool_start" value="Вложить"></p>
 </form>
<hr>
<h2>Ваши токены в пулах</h2>
<table><thead><tr><th>Токен пула</th>
<th>Пара</th>
<th>Сумма в первом токене</th>
<th>Сумма во втором токене</th>
<th>Ликвидность</th>
<th>Доля</th>
<th>Действия...</th></tr></thead>
<tbody id="my_pools"></tbody></table>
 
<div style="display: none;" id="remove_liquidity_modal">
<h4 class="modal-title">Удаление ликвидности для пула <span id="rl_modal_pool"></span></h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<div id="action_rl">
<form class="form" name="postForm">
<p><label for="rl_percent">Укажите процент удаления ликвидности (Баланс: <span id="rl_lp_balance"></span> <span id="rl_modal_token"></span>):</label></p>
<p><input type="number" min="0" max="100" step="0.001" name="rl_percent" id="action_rl_percent" placeholder="Выберите процент от 0 до 100"></p>
<p><strong>Комиссия: <span id="rl_fee"></span> BIP</strong></p>
<p><input type="button" id="action_rl_start" value="Удалить"></p>
</form>
</div>
</div>

</div>

                                                                                                </div>
'; ?>