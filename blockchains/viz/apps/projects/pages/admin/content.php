<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th>Новая задача</th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">';
if (isset($_GET) && isset($_GET['type']) && isset($_GET['creator']) && isset($_GET['name'])) {
    $type_text = '';
    if ($_GET['type'] === 'project') $type_text = 'проекта';
    if ($_GET['type'] === 'task') $type_text = 'задачи';
    $content .= '<h2>Удаление '.$type_text.'</h2>
<form>
<p><input type="checkbox" required placeholder="Я уверен, что хочу модерировать"></p>
<p><input type="button" value="Модерировать" onclick="sendCustom(`moderation`, {type: `'.$_GET['type'].'`, creator: `'.$_GET['creator'].'`, name: `'.$_GET['name'].'`})"></p>
    </form>';
} else {
    $content .= '<h2>Действия с типами и категориями</h2>
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
    </form>';
}
$content .= '</div>
<script>
if (viz_login === `viz-projects`) {
$(`#active_page`).css(`display`, `block`);
} else {
    $(`#active_page`).css(`display`, `none`);
}
    </script>';
return $content;
?>