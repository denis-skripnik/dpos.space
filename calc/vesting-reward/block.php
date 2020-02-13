<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
echo "<h2>Примерная награда из $amount2 за сутки</h2>
<p><label name='all-sp'>Количество $amount2: </label>
<input type='text' name='all-sp' id='all_sp' value='' placeholder='Количество $amount2'></p>
<p align='center'><input type='button' id='result_vesting' value='Рассчитать награду с $amount2'></p>";
?>
<div id="let3"></div>