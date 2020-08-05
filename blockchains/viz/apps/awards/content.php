<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Что такое награждение пользователей Viz</h2>
<p>Награждение - это возможность на основе количества социального капитала (SHARES) в Viz награждать других пользователей из эмиссии. Она составляет 10% в год.</p>
<p>Кроме того, вы можете указать дополнительную награду (аккаунт и процент). Причём процент - это не дополнительный процент энергии, а процент от процента энергии основной награды.
Пример: вы награждаете аккаунт за то, что помог с созданием иллюстрации на 80%, а ещё одного - за идею иллюстрации на 10%. Тогда первый получит 72%, а второй 8% (10% от 80%).</p>
<p>Энергия - показатель, от которого зависит, сколько токенов из эмиссии получат награждаемые. Энергия восстанавливается за сутки на 20%.</p>
<h2>Страницы сервиса</h2>
<p><span align="left"><a href="'.$conf['siteUrl'].'viz/awards/url">Генератор url наград и qr-кодов</a></span> <span align="right"><a href="'.$conf['siteUrl'].'viz/awards/builder">Конструктор форм</a></span></p>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Заполните поля, чтобы отправить награду</h2>
<h3 id ="now_energy"></h3>
<form id="award_user_form" action="'.$conf['siteUrl'].'viz/awards/send/" method="get">
<p><label for="target">Кого наградить:</label>
<input type="text" name="target" value="" placeholder="Введите получателя награды"></p>
<p><label for="energy">Процент энергии, который вы готовы потратить при награде. Энергия регенерирует за сутки на 20%:</label>
<input type="text" name="energy" id="awarding_energy" value="" required placeholder="Введите процент энергии без знака %">%</p>
<p><label for="payout">Сумма награды. Если вы заполните это поле, оно будет иметь больший преоритет, чем процент энергии:</label>
<input type="text" name="payout" value="" placeholder="Введите сумму награды"> <span id="max_payout"></span></p>
<p><label for="custom_sequence">Номер Custom операции, отправленной пользователем, которому предназначена награда (в принципе, можно указать любое число, например, id новости, опубликованной пользователем, в базе данных вашего сайта):</label>
<input type="number" min="0" name="custom_sequence" value="" placeholder="номер custom операции"></p>
<p><label for="memo">Заметка (memo):</label></p>
<p><input type="text" name="memo" value="" placeholder="Введите заметку к награде"></p>
<hr>
<h3>Дополнительная награда</h3>
<p><label for="benef_login">Логин: </label></p>
<p><input id="nick" placeholder="Введите бенефициара" type="text" ></p>
<p>Процент от процента энергии основной награды: <input type="text" name="benef_procent" value="" data-fixed="benef_procent"> <input type="range" name="benef_procent" id="per" data-fixed="benef_procent" max="99" value=""></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
    <div>
    	<table id="out" border="1px">
    		<tr>
    			<th>Логин</th>
    			<th>Процент</th>
    			<th>Удаление</th>
    		</tr>
    	</table>
    <input type="hidden" name="beneficiaries" id="benifs" value="">
<hr>
<p><strong><input type="submit" value="Наградить"></strong></p>
</form>
<script>
accountData();
</script>
</div>'; ?>