<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
if (isset($_GET) && isset($_GET['block1']) && isset($_GET['block2']) && isset($_GET['participants'])) {
    $data['title'] .= ' | Блоки '.$_GET['block1'].' и '.$_GET['block2'].', участников '.$_GET['participants'];
}
if (!empty($_GET)) {
$start_block = $_GET['block1'];
$end_block = $_GET['block2'];
$participants = $_GET['participants'];
$data_list = '';
if (isset($_GET['data_list'])) $data_list = $_GET['data_list'];
$start_link = '<a href="https://ropox.app/viz/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fviz.lexa.host%2Fws&blockNum='.$start_block.'" target="_blank">'.$start_block.'</a>';
$end_link = '<a href="https://ropox.app/viz/api/database_api/get_block?blockchain=Lex&ws=wss%3A%2F%2Fviz.lexa.host%2Fws&blockNum='.$end_block.'" target="_blank">'.$end_block.'</a>';
return '<div >
    <h1>Стартовый блок раунда '.$start_link.', блок последнего участника раунда '.$end_link.'</h1>
<h2><a href="https://golos.id/ru/@denis-skripnik/ru-generator-sluchaijnykh-chisel-na-baze-dannykh-iz-bch" target="_blank">Принцип генерации случайных чисел в этом посте</a></h2>
<h3> Участников: <span id="participants">'.$participants.'</span></h3>
<p><strong>Репозиторий: <a href="https://github.com/gropox/randomblockchain" target="_blank">https://github.com/gropox/randomblockchain</a></strong></p>
        <div>
        <input type="hidden" id="participants" value="'.$participants.'">
    <textarea style="display: none;" id="data_list">'.$data_list.'</textarea>
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
    <div id="resultMember"></div>
	</div>
    

<script  type="text/javascript" >
blocksData('.$start_block.', '.$end_block.');
</script>
</div>';
} else {
return '<form class="form" action="'.$conf['siteUrl'].'viz/randomblockchain/" method="get">
<p><label for="block1">Первый блок (начальный) (<a onclick="getLastBlocks()">Получить текущий и предыдущий блок</a>): </label>
<input type="text" name="block1" value="" placeholder="Введите стартовый блок"></p>
<p><label for="block2">Второй блок, на основе которого (также как и на базе первого) будет производиться генерация случайного числа: </label>
<input type="text" name="block2" value="" placeholder="Введите второй блок"></p>
<p><label for="participants">Количество участников (максимальное число): </label>
<input type="text" name="participants" value="" placeholder="Введите число участников"></p>
<p><label for="data_list">Список данных, указывайте каждый элемент с новой строки: </label>
<textarea name="data_list"></textarea></p>
<p><input type="submit" value="Сгенерировать"></p>
</form>';
}
?>