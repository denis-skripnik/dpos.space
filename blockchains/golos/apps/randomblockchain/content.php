<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
if (!empty($_GET)) {
$start_block = $_GET['block1'];
$end_block = $_GET['block2'];
$participants = $_GET['participants'];
$start_link = '<a href="https://ropox.app/steemjs/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fgolos.lexa.host%2Fws&blockNum='.$start_block.'" target="_blank">'.$start_block.'</a>';
$end_link = '<a href="https://ropox.app/steemjs/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fgolos.lexa.host%2Fws&blockNum='.$end_block.'" target="_blank">'.$end_block.'</a>';
return '<div >
    <h1>Стартовый блок раунда '.$start_link.', блок последнего участника раунда '.$end_link.'</h1>
<h2><a href="https://golos.id/ru/@denis-skripnik/ru-generator-sluchaijnykh-chisel-na-baze-dannykh-iz-bch" target="_blank">Принцип генерации случайных чисел в этом посте</a></h2>
<h3> Участников: <span id="participants">'.$participants.'</span></h3>
<p><strong>Репозиторий: <a href="https://github.com/gropox/randomblockchain" target="_blank">https://github.com/gropox/randomblockchain</a></strong></p>
        <div>
    <label>Сигнатура первого указанного блока</label><br/>
    <textarea id="sig1" cols="100" rows="5"></textarea>
    </div>
    <div>
    <label>Сигнатура второго указанного блока</label><br/>
    <textarea id="sig2" cols="100" rows="5"></textarea>
	</div>
    
    <div>
        <br/><input type="button" onclick="calculate()" id="calculate" value="Вычислить счастливое число" /><br/><br/>
    </div>
    
    <div>
    <label>Хэш</label><br>
    <input type="text" id="hash" size="100" /><br>
    <label>Счастливое число</label><br>
    <input type="text" id="luckyNumber" size="10" />

	</div>
    

<script  type="text/javascript" >
blocksData('.$start_block.', '.$end_block.');
</script>
</div>';
} else {
return '<form action="'.$conf['siteUrl'].'golos/randomblockchain/" method="get">
<p><label for="block1">Первый блок (начальный): </label>
<input type="text" name="block1" value="" placeholder="Введите стартовый блок"></p>
<p><label for="block2">Второй блок, на основе которого (также как и на базе первого) будет производиться генерация случайного числа: </label>
<input type="text" name="block2" value="" placeholder="Введите второй блок"></p>
<p><label for="participants">Количество участников (максимальное число): </label>
<input type="text" name="participants" value="" placeholder="Введите число участников"></p>
<p><input type="submit" value="Сгенерировать"></p>
</form>';
}
?>