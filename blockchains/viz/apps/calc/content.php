<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Рассчитываем сумму награждения других аккаунтов в зависимости от социального капитала</h2>
<p><label name="steempower">Введите Значение Соц. капитал (SHARES): </label>
<input type="text" name="steempower" id="sp" value=""></p>
<p><label name="votepower">Введите процент энергии: </label>
<input type="text" name="votepower" id="vp" value=""> %</p>
<p align="center"><input type="button" id="result_power" value="Вывести"></p>
<div><strong id="let1"></strong></div>
<hr>
<h2>Для разработчиков: формирование наградного фонда</h2>
<p><label name="fund_sp">Введите Значение Соц. капитал (SHARES): </label>
<input type="text" name="fund_steempower" id="fund_sp" value=""></p>
<p align="center"><input type="button" id="result_fund" value="Вывести"></p>
<div><strong id="let3"></strong></div>
<h2>Перевод VIZ в SHARES</h2>
<p><label name="sp-tec">Количество VIZ: </label>
<input type="text" name="sp-tec" id="sp_tec" value=""></p>
<p align="center"><input type="button" id="result_vests" value="Рассчитать"></p>
<div><strong id="let2"></strong></div>
<hr>
'; ?>