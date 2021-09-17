<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Для работы с монетами необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page">
<p><strong>Для управления монетами важно, чтоб вы являлись их создателями.</strong></p>
<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#create">Создать или пересоздать монету / токен</a></li>
<li><a href="#edit_owner">Изменить владельца</a></li>
<li><a href="#mint_token">Эмиссия токена</a></li>
<li><a href="#burn_token">Сжигание токена</a></li></ul>
<hr>
<h2><a name="create">Создать или пересоздать монету / токен</a></h2>
<form name="crtc_form">
<p><label>Действие: <br>
<select name="type">
<option value="CREATE_COIN">Создание монеты</option>
<option value="RECREATE_COIN">Пересоздание монеты</option>
<option value="CREATE_TOKEN">Создание токена</option>
<option value="RECREATE_TOKEN">Пересоздание токена</option>
</select></label></p>
<p><label>Название: <br>
<input type="text" name="name" value="" required></label></p>
<p><label>Тикер: <br>
<input type="text" name="symbol" value="" required></label></p>
<p><label>Сумма начальной эмиссии: <br>
<input type="text" name="initialAmount" value="" required></label></p>
<p><label>Максимальная эмиссия: <br>
<input type="number" name="maxSupply" min="1" max="1000000000000000" value="" required></label></p>
<fieldset id="for_coin">
<legend>Настройки монеты</legend>
<p><label>CRR: <br>
<input type="range" min="10" max="100" step="10" name="constantReserveRatio" value=""></label></p>
<p><label>Начальный резерв в BIP: <br>
<input type="text" name="initialReserve" value=""></label></p>
<p><strong><input type="button" value="Отправить" onclick="createCoin(this.form.type.value, this.form.name.value, this.form.symbol.value, parseFloat(this.form.initialAmount.value), parseFloat(this.form.maxSupply.value), {constantReserveRatio: parseInt(this.form.constantReserveRatio.value), initialReserve: parseFloat(this.form.initialReserve.value)});"></strong></p>
</fieldset>

<fieldset id="for_token">
<legend>Настройки токена</legend>
<p><label>Разрешить эмиссию: <br>
<input type="checkbox" name="mintable" value=""></label></p>
<p><label>Разрешить сжигание: <br>
<input type="checkbox" name="burnable" value=""></label></p>
<p><strong><input type="button" value="Отправить" onclick="createCoin(this.form.type.value, this.form.name.value, this.form.symbol.value, parseFloat(this.form.initialAmount.value), parseFloat(this.form.maxSupply.value), {mintable: Boolean(this.form.mintable.value), burnable: Boolean(this.form.burnable.value)});"></strong></p>
</fieldset>
</form>
<p><strong><a href="#contents">К оглавлению</a></strong></p>
<hr>
<h2><a name="edit_owner">Изменить владельца монеты</a></h2>
<form>
<p><label>Тикер монеты: <br>
<input type="text" name="symbol" value=""></label></p>
<p><label>Адрес нового владельца (начинается с Mx): <br>
<input type="text" name="newOwner" value=""></label></p>
<p><strong><input type="button" value="Отправить" onclick="editCoinOwner(this.form.symbol.value, this.form.newOwner.value);"></strong></p>
</form>
<p><strong><a href="#contents">К оглавлению</a></strong></p>

<hr>
<h2><a name="mint_token">Эмиссия токена</a></h2>
<form>
<p><label>Тикер: <br>
<input type="text" name="coin" value=""></label></p>
<p><label>Сумма: <br>
<input type="number" name="amount" min="0" stap="0.00000000000001" value=""></label></p>
<p><strong><input type="button" value="Отправить" onclick="mintToken(this.form.coin.value, parseFloat(this.form.amount.value));"></strong></p>
</form>
<p><strong><a href="#contents">К оглавлению</a></strong></p>

<h2><a name="burn_token">Сжигание токена</a></h2>
<form>
<p><label for="tokens">Токен:
    <select name="tokens"></select></label></p>
    <p><label for="amount">Сумма сжигания (<span id="max_token_burn">все доступные <span id="max_burn_amount"></span> <span class="burn_modal_token"></span></span>):</label></p>
    <p><input type="text" name="amount" id="action_burn_amount" required placeholder="Введите сумму в формате 1.000"></p>
    <p><strong><input type="button" value="Отправить" onclick="burnToken(this.form.token.value, parseFloat(this.form.amount.value));"></strong></p>
</form>
<p><strong><a href="#contents">К оглавлению</a></strong></p>
</div>'; ?>