<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Рассчитываем стоимость апвота в зависимости от введённой Hive power</h2>
<p><label name="hivepower">Введите Значение HP: </label>
<input type="text" name="hivepower" id="sp" value=""></p>
<p><label name="votepower">Введите батарейку (от 1 до 100): </label>
<input type="text" name="votepower" id="vp" value=""> %</p>
<p><label name="vote_weight">Процент апвота (от 1 до 100, устанавливается под постом, если Силы Голоса достаточно для этого): </label>
<input type="text" name="vote_weight" id="vote_weight" value=""> %</p>
<p align="center"><input type="button" id="result_power" value="Вывести стоимость апвота"></p>
<div id="let1"></div>
<h2>Перевод VESTS в HP</h2>
<p><label name="sp-tec">Количество VESTS: </label>
<input type="text" name="sp-tec" id="sp_tec" value=""></p>
<p align="center"><input type="button" id="result_vests" value="Рассчитать VESTS в HP"></p>
<div id="let2"></div>
'; ?>