<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
if (pageUrl()[4]) {
$page = [];
$page['content'] = '<script src="'.$conf['siteUrl'].'blockchains/minter/apps/long/pages/surveys/pages/voteing/page.js"></script>
<p><span align="left">Голосование</span> <span align="center"><a href="'.$conf['siteUrl'].'minter/long/surveys/results/'.pageUrl()[4].'">Предварительные или окончательные результаты</a></span> <span align="right"><a href="'.$conf['siteUrl'].'minter/long/surveys/list">Список опросов</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3852/smartfarm/surveys?type=voteing&id='.pageUrl()[4]);
if (pageUrl()[4] && $html) {
$table = json_decode($html, true);
$page['title'] = $table['question'];
$page['description'] = $table['question'];

$answers = $table['answers'];
if ($answers && $table['end_date'] > gmmktime()) {
    $d = new DateTime();
    $d->setTimestamp($table['end_date']);
    
    // или createFromFormat с форматом U
    $d = DateTime::createFromFormat('U', $table['end_date']);
    $page['content'] .= '<hr>
    <h2>Вопрос: '.$table['question'].' от <a href="/minter/profiles/'.$table['address'].'" target="_blank">'.$table['address'].'</a></h2>
    <h3>Дата и время завершения: '.$d->format('d.m.Y H:i:s').' GMT</h3>
    <p><strong>Если вы авторизовались <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">здесь</a> и являетесь провайдером в пуле <a href="https://chainik.io/pool/BIP/LONG" target="_blank">BIP/LONG</a>, сможете проголосовать.</strong></p>
<div id="is_provider">
<p>Вы также можете отправить транзакцию вручную на адрес <span id="send_to_address">Mx01029d73e128e2f53ff1fcc2d52a423283ad9439</span> (<input type="button" id="copy_address" value="Копировать">)<br>
В Сумма: 100 LONG;<br>
В сообщении указать:<br>
<strong>ls '.$url[4].' {НОМЕР_ВАРИАНТА_СО_СТРАНИЦЫ_РЕЗУЛЬТАТОВ}<br>
Например, ls '.$url[4].' 0</strong></p>
<form class="form">
<hr>
<p><label for="answers">Выберите вариант ответа:</label></p>
<hr>';
foreach ($answers as $num => $answer) {
    $page['content'] .= '<p><input type="radio" name="answers" id="voteing" value="'.$num.'" placeholder="'.$answer.'"> '.$answer.'</p>';
}
$page['content'] .= '</p>
<hr>
<p><button type="button" onclick="submitVoteing(`'.pageUrl()[4].'`, this.form.answers.value)">Голосовать</button></p>
</form></div>';
} else if ($table['end_date'] <= gmmktime()) {
    $page['content'] .= '<p>Опрос закончен.</p>';
}
} else {
    $page['content'] .= '<p>Такого опроса нет.</p>';
}
return $page;
}
?>