<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$page['content'] = '<script src="'.$conf['siteUrl'].'blockchains/minter/apps/long/pages/surveys/pages/create/page.js"></script>
<p><span align="left">Создание опроса</span> <span align="right"><a href="'.$conf['siteUrl'].'minter/long/surveys/list">Список</a></span></p>
<form class="form">
<p><label for="q">Вопрос:</label>
    <input type="text" name="q" id="question" value="" placeholder="Вопрос"></p>
    <p><lable for="a">Варианты ответа:</label>
<input name="a" id="answer" placeholder="Введите ответ" type="text" ></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
    <div id="out"></div>
<p><button type="button" onclick="submitSurvey(this.form.q.value)">Создать</button></p>
</form>';
return $page;
?>