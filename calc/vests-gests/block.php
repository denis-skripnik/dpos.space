<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
echo "<h2>Перевод $sp_tec в $amount2</h2>
<p><label name='sp-tec'>Количество $sp_tec: </label>
<input type='text' name='sp-tec' id='sp_tec' value=''></p>
<p align='center'><input type='button' id='result_vests' value='Рассчитать $sp_tec в $amount2'></p>";
?>
<div id="let2"></div>