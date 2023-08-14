<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Что такое награждение пользователей Viz</h2>
<p>Награждение - это возможность на основе количества социального капитала (SHARES) в Viz награждать других пользователей из эмиссии. Она составляет 10% в год.</p>
<p>Бенефициары - это те, кого ещё вы хотите наградить (помимо получателя). Например, вы можете наградить на 100% энергии того, кто помог вам с логотипом, а также указать, что по 20%бенефициарских получат веб-дизайнер и верстальщик. В итоге у получателя будет награда на 60% энергии, а у бенефициаров по 20% (суммарно 40).</p>
<p>Энергия - показатель, от которого зависит, сколько токенов из эмиссии получат награждаемые. Энергия восстанавливается за сутки на 20%.</p>
<h2>Страницы сервиса</h2>
<p><span align="left"><a href="'.$conf['siteUrl'].'viz/awards">Форма награждения</a></span> <span align="right"><a href="'.$conf['siteUrl'].'viz/awards/builder">Конструктор форм</a></span></p>
<h2>Сформировать url и qr-код</h2>
<p>В полях названия, как в url, а в скобках пояснения.</p>
<form class="form" id="AwardUrlForm">
<p><label for="target">target (логин Viz награждаемого):</label></p>
<p><input type="text" name="target" value=""></p>
<p><label for="isFixed">Фиксированная в VIZ награда</label>
<input type="checkbox" name="isFixed" id="isFixed"></p>
<p><label for="energy">Energy (процент энергии, который вы готовы потратить при награде):</label></p>
<p><input type="text" name="energy" id="awarding_energy" value=""></p>
<p><label for="payout">payout (сумма награды). Если вы заполните это поле, оно будет иметь больший преоритет, чем процент энергии:</label></p>
<p><input type="text" name="payout" value=""></p>
<p><label for="custom_sequence">custom_sequence (номер Custom операции, отправленной пользователем, которому предназначена награда. в принципе, можно указать любое число, например, id новости, опубликованной пользователем, в базе данных вашего сайта):</label></p>
<p><input type="number" min="0" name="custom_sequence" value="0"></p>
<p><label for="memo">Memo (Заметка. Может быть любой текст или идентификация вашего приложения):</label></p>
<p><input type="text" name="memo" value=""></p>
<hr>
<h3>beneficiaries (Бенефициары)</h3>
<p><label for="benef_login">Логин бенефициара: </label></p>
<p><input id="nick" placeholder="Введите бенефициара" type="text" ></p>
<p>Процент: <input type="text" name="benef_procent" value="" data-fixed="benef_procent"> <input type="range" name="benef_procent" id="per" data-fixed="benef_procent" max="99" value=""></p>
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
<p><strong><input type="button" onclick="view_url(`'.$conf['siteUrl'].'`)" value="Сформировать url"></strong></p>
</form>

<div id="award_url" style="display: none;">
</div>
'; ?>