<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
if (isset(pageUrl()[3])) {
global $conf;
$page = [];
$page['content'] = '<script src="'.$conf['siteUrl'].'blockchains/golos/apps/polls/pages/voteing/page.js"></script>
<p><span align="left">Голосование</span> <span align="center"><a href="'.$conf['siteUrl'].'golos/polls/results/'.pageUrl()[3].'">Предварительные или окончательные результаты</a></span> <span align="right"><a href="'.$conf['siteUrl'].'golos/polls/list">Список опросов</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3000/golos-api?service=votes&type=voteing&permlink='.pageUrl()[3]);
if (pageUrl()[3] && $html) {
$table = json_decode($html, true);
$answers = $table['answers'];
if ($answers && $table['end_date'] > gmmktime()) {
    $d = new DateTime();
    $d->setTimestamp($table['end_date']);
    
    // или createFromFormat с форматом U
    $d = DateTime::createFromFormat('U', $table['end_date']);
    $page['content'] .= '<hr>
    <h2>Вопрос: '.$table['question'].'</h2>
    <h3>Дата и время завершения: '.$d->format('d.m.Y H:i:s').' GMT</h3>
    <p><strong>Если вы авторизовались <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a> с указанием логина и постинг ключа, сможете проголосовать, не выходя с этого сайта.</strong></p>
    <form>
<p><label for="sender">Голосующий:</label></p>
<p><input type="text" name="sender" value="" placeholder="логин голосующего"></p>
<hr>
<p><label for="answers">Выберите вариант ответа:</label></p>
<hr>';
foreach ($answers as $num => $answer) {
    $page['content'] .= '<p><input type="radio" name="answers" id="voteing" value="'.$num.'" placeholder="'.$answer.'"> '.$answer.'</p>';
}
$page['content'] .= '</p>
<hr>
<p><button type="button" onclick="submitVoteing(`'.pageUrl()[3].'`, this.form.sender.value, this.form.answers.value)">Голосовать</button></p>
</form>';
} else if ($table['end_date'] <= gmmktime()) {
    $page['content'] .= '<p>Опрос закончен.</p>';
}
} else {
    $page['content'] .= '<p>Такого опроса нет.</p>';
}
$page['title'] = $table['question'];
$page['description'] = $table['question'];
return $page;
}
?>