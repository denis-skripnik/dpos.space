<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
echo "<h2>Рассчитываем стоимость апвота в зависимости от введённой $amount2</h2>
<p><label name='steempower'>Введите Значение $amount2: </label>
<input type='text' name='steempower' id='sp' value=''></p>
<p><label name='votepower'>Введите батарейку (от 1 до 100): </label>
<input type='text' name='votepower' id='vp' value=''> %</p>";
if ($chain != 'viz') {
echo "<p><label name='vote_weight'>Процент апвота (от 1 до 100, устанавливается под постом, если $amount2 достаточно для этого): </label>
<input type='text' name='vote_weight' id='vote_weight' value=''> %</p>";
}
echo "<p align='center'><input type='button' id='result_power' value='Вывести стоимость апвота'></p>";
?>
<div id="let1"></div>