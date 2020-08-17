<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th>Новая задача</th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<h2>Действия с типами и категориями</h2>
<form>
<p><input type="text" name="name" value="" placeholder="Введите название"></p>
<p><label for="who">Действия с чем выполняем:</label><br>
<select name="who">
<option value="add_category">Добавить категорию</option>
<option value="delete_category">Удалить категорию</option>
<option value="add_type">Добавить тип</option>
<option value="delete_type">Добавить тип</option>
</select></p>
<p><input type="button" value="Отправить" onclick="sendCustom(this.form.who.value, {name: this.form.name.value})"></p>
</form>
</div>
<script>
if (viz_login === `viz-projects`) {
$(`#active_page`).css(`display`, `block`);
} else {
    $(`#active_page`).css(`display`, `none`);
}
    </script>';
return $content;
?>