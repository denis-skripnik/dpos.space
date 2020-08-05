<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$page = [];
$page['content'] = '<script src="'.$conf['siteUrl'].'blockchains/golos/apps/polls/pages/create/page.js"></script>
<p><span align="left">Создание опроса</span> <span align="right"><a href="'.$conf['siteUrl'].'golos/polls/list">Список</a></span></p>
<form>
<p><label for="login">Логин создателя опроса:</label>
<input type="text" name="login" id="sender" value="" placeholder="Введите логин создателя опроса"></p>
<p><label for="q">Вопрос:</label>
    <input type="text" name="q" id="question" value="" placeholder="Вопрос"></p>
    <p><lable for="a">Варианты ответа:</label>
<input name="a" id="answer" placeholder="Введите ответ" type="text" ></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
    <div id="out"></div>
<p><label for="end_date">Дата и время окончания опроса:</label>
<input type="datetime-local" name="end_date" id="datetime" placeholder="Дата и времяокончания опроса"></p>
<p><label for="consider">Учитывать при расчёте результатов СГ: </label>
<select name="consider" id="vote_consider" placeholder="Учитывать при расчёте результатов СГ">
    <option value="0">Личную</option>
    <option value="1">Личную + прокси</option>
    <option value="2">Как при апвотах</option>
</select></p>
<p><label for="service">При помощи чего создавать опрос. Если вы авторизованы <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a> с указанием активного ключа, будет выбран вариант dpos.space (создание опроса при помощи данного сайта): </label>
<select name="service" id="clients" placeholder="При помощи чего создать опрос">
<option value="sign">Писарь</option>
    <option value="golos_id">golos.id</option>
    </select></p>
<p><button type="button" onclick="submitPoll(this.form.login.value, this.form.q.value, this.form.end_date.value, this.form.consider.value, this.form.service.value)">Создать</button></p>
</form>';
return $page;
?>