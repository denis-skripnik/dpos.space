<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="seed_auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page">
<div id="main_wallet_info" style="display: none;">
<p>Адрес: <a target="_blank" id="address_link"><span id="current_address"></span></a><br>
<input type="button" id="copy_address" value="Копировать"></p>
<ul id="balances" style="display: none;"></ul>
<ul id="actions" class="terms" style="display: none;"></ul>
<h2>Делегированные монеты</h2>
<table><thead><tr>
<th>Статус валидатора, ключ<br>
Название</th>
<th>Стек<br>
В BIP</th>
<th>В списке ожидания?</th>
<th>Действия...</th>
</tr></thead>
</tr></thead>
<tbody id="delegation_tbody"></tbody></table>

<div style="display: none;" id="delegate_modal">
<h4 class="modal-title">Конвертация <span class="delegate_modal_token"></span></h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<div id="action_delegate">
<form class="form" name="postForm">
<p><label for="delegate_template">Выберите шаблон делегирования:</label></p>
<p><select name="delegate_template" id="select_delegate_template">
<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
</select> <span style="display: none;" id="remove_delegate_template">(<input type="button" value="Удалить текущий шаблон" id="action_remove_delegate_template">)</span> </p>
<p><label for="delegate_to">Публичный ключ валидатора (можно выбрать <a href="'.$conf['siteUrl'].'minter/validators" target="_blank">тут</a>):</label></p>
<p><input type="text" name="delegate_to" id="action_delegate_key" placeholder="MP..."></p>
<p><label for="delegate_amount">Сумма делегирования (<span id="max_token_delegate">делегировать все доступные <span id="max_delegate_amount"></span> <span class="delegate_modal_token"></span></span>):</label></p>
<p><input type="text" name="delegate_amount" id="action_delegate_stake" placeholder="Введите сумму в формате 1.000"></p>
<p><strong>Комиссия: <span id="delegate_fee">1</span> <span class="delegate_modal_token"></span></strong></p>
<p><input type="button" id="action_delegate_start" value="Делегировать"></p>
<hr>
<p><input type="button" id="action_save_delegate_template" value="Создать шаблон делегирования"></p> 
</form>
</div>
</div>

<div style="display: none;" id="anbond_modal">
<h4 class="modal-title">Анбонд <span class="anbond_modal_token"></span></h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<div id="action_anbond">
<form class="form" name="postForm">
<p><label for="delegate_to">Публичный ключ валидатора:</label></p>
<p><input type="text" readonly name="anbond_to" id="action_anbond_key"></p>
<p><label for="anbond_amount">Сумма анбонда (<span id="max_token_anbond">все доступные <span id="max_anbond_amount"></span> <span class="anbond_modal_token"></span></span>):</label></p>
<p><input type="text" name="anbond_amount" id="action_anbond_stake" placeholder="Введите сумму в формате 1.000"></p>
<p><strong>Комиссия: <span id="anbond_fee">10</span> <span class="anbond_modal_token"></span></strong></p>
<p><input type="button" id="action_anbond_start" value="Анбонднуть"></p>
</form>
</div>
</div>

</div>
</div>
<script>
getDelegations();
</script>
'; ?>