<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '<p><span align="center"><a href="'.$conf['siteUrl'].'viz/search">Найти</a></span></p>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Заполните поля, чтобы создать ссылку</h2>
<h3 id ="now_energy"></h3>
<form class="form">
<input type="hidden" name="target" value="committee">
<p><label for="energy">Процент энергии, который вы готовы потратить при награде. Энергия регенерирует за сутки на 20%:</label>
<input type="text" name="energy" id="awarding_energy" value="" required placeholder="Введите процент энергии без знака %">%</p>
<p><label for="payout">Сумма награды (если измените, процент энергии изменится):</label>
<input type="text" name="payout" value="" placeholder="Введите сумму награды"> <span id="max_payout"></span></p>
<p><label for="custom_sequence">Протокол:
	<select name="custom_sequence">
	<option value=0>viz://</option>
	<option value=1>https://</option>
	<option value=2>ipfs</option>
	<option value=3>magnet</option></select></label></p>
<p><label for="keyword">Анкор (текст) ссылки: <br>
<input type="text" name="keyword" value="" placeholder="Введите анкор ссылки"></label></p>
<p><label for="link">Адрес ссылки (без указания протокола, т.е. не https://yandex.ru, а yandex.ru): <br>
<input type="text" name="link" value="" placeholder="Введите адрес ссылки"></label></p>
<p><label for="inlink">Адрес родительской ссылки (без указания протокола, т.е. не https://yandex.ru, а yandex.ru): <br>
	<input type="text" name="inlink" value="" placeholder="Введите адрес родительской ссылки"></label></p>
<p><strong><input type="button" onclick="send_award(this.form.target.value, this.form.energy.value, this.form.custom_sequence.value, this.form.keyword.value, this.form.link.value, this.form.inlink.value);" value="создать"></strong></p>
</form>
<div id="main_award_info" style="display: none;"></div>
<script>
accountData();
</script>
</div>'; ?>