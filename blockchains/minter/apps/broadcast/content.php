<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<form>
<p><label for="tx">Транзакция:<br>
<input type="text" name="tx" value=""></label></p>
<div id="results" style="display: none;"></div>
<p><strong><input type="button" name="submit_broadcast" value="Отправить в сеть"></strong></p>
</form>
<hr>
<h2>Отправка мультисиг транзации</h2>
<form>
<p><label for="multisig_address">Мультисиг адрес:<br>
<input type="text" name="multisig_address" value=""></label></p>
<p><label for="tx_data">JSON код транзакции:<br>
<textarea name="tx_data"></textarea></label></p>
<p><lable for="a">Подписи:<br>
<input name="a" id="answer" placeholder="Введите подпись" type="text" ></label></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
    <div id="out"></div>
<p><button type="button" onclick="submitMultisigTX(this.form.multisig_address.value)">Отправить</button></p>
</form>
'; ?>