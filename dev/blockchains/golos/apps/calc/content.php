<?php return '
<h2>Рассчитываем стоимость апвота в зависимости от введённой СГ</h2>
<p><label name="steempower">Введите Значение СГ: </label>
<input type="text" name="steempower" id="sp" value=""></p>
<p><label name="votepower">Введите батарейку (от 1 до 100): </label>
<input type="text" name="votepower" id="vp" value=""> %</p>
<p><label name="vote_weight">Процент апвота (от 1 до 100, устанавливается под постом, если Силы Голоса достаточно для этого): </label>
<input type="text" name="vote_weight" id="vote_weight" value=""> %</p>
<p align="center"><input type="button" id="result_power" value="Вывести стоимость апвота"></p>
<div id="let1"></div>
<h2>Примерная награда из СГ за сутки</h2>
<p><label name="all-sp">Количество СГ: </label>
<input type="text" name="all-sp" id="all_sp" value="" placeholder="Количество СГ"></p>
<p align="center"><input type="button" id="result_vesting" value="Рассчитать награду с СГ"></p>
<div id="let3"></div>
<h2>Перевод GESTS в СГ</h2>
<p><label name="sp-tec">Количество GESTS: </label>
<input type="text" name="sp-tec" id="sp_tec" value=""></p>
<p align="center"><input type="button" id="result_vests" value="Рассчитать GESTS в СГ"></p>
<div id="let2"></div>
'; ?>