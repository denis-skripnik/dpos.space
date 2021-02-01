<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="seed_auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page">
<p><strong>Для управления монетами важно, чтоб вы являлись их создателями.</strong></p>
<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#create">Создать или пересоздать монету</a></li>
<li><a href="#edit_owner">Изменить владельца</a></li></ul>
<h2><a name="create">Создать или пересоздать монету</a></h2>
<form>
<p><label>Действие: <br>
<select name="type">
<option value="CREATE_COIN">Создание монеты</option>
<option value="RECREATE_COIN">Пересоздание монеты</option>
</select></label></p>
<p><label>Название монеты: <br>
<input type="text" name="name" value=""></label></p>
<p><label>Тикер монеты: <br>
<input type="text" name="symbol" value=""></label></p>
<p><label>Сумма начальной эмиссии: <br>
<input type="text" name="initialAmount" value=""></label></p>
<p><label>CRR: <br>
<input type="range" min="10" max="100" step="10" name="constantReserveRatio" value=""></label></p>
<p><label>Начальный резерв в BIP: <br>
<input type="text" name="initialReserve" value=""></label></p>
<p><label>Максимальная эмиссия монеты: <br>
<input type="number" name="maxSupply" min="1" max="1000000000000000" value=""></label></p>
<p><strong><input type="button" value="Отправить" onclick="createCoin(this.form.type.value, this.form.name.value, this.form.symbol.value, parseFloat(this.form.initialAmount.value), parseInt(this.form.constantReserveRatio.value), parseFloat(this.form.initialReserve.value), parseFloat(this.form.maxSupply.value));"></strong></p>
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
</div>'; ?>