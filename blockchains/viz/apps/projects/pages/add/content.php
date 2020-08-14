<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th>Добавить проект</th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<h2>Укажите информацию о проекте и отправьте в блокчейн</h2>
<p><strong><font color="red">ВНИМАНИЕ: стоимость добавления проекта 100 VIZ. Она будет переведена аккаунту viz-projects. Но если проект окажется не спамом, наградим вас на сумму больше ста Viz.</font></strong></p>
<form>';
$fields = ['name' => 'Название', 'description' => 'Описание', 'image_link' => 'Изображение', 'type' => 'Тип', 'category' => 'Категория', 'dev_status' => 'Статус разработки', 'command' => 'Команда (логины через запятую)', 'site' => 'Сайт', 'github' => 'Github'];
foreach($fields as $name => $description) {
if ($name === 'type') {
    $content .= '<p><select name="type" placeholder="Тип проекта">
        <option value="" disabled selected>Выберите тип проекта</option>
    ';
    $html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=types');
    $types = json_decode($html, true);
    if ($types && count($types) > 0) {
        foreach($type as $types) {
            $content .= '<option value="'.$type.'">'.$type.'</option>';
        }
    }
    $content .= '</select></p>
';
} else if ($name === 'category') {
    $content .= '<p><select name="category" placeholder="Категория">
        <option value="" disabled selected>Выберите категорию проекта</option>
';
    $html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=categories');
    $categories = json_decode($html, true);
    if ($categories && count($categories) > 0) {
        foreach($categories as $category) {
            $content .= '<option value="'.$category.'">'.$category.'</option>';
        }
    }
    $content .= '</select></p>
';
} else if ($name === 'dev_status') {
    $content .= '<p><select name="dev_status" placeholder="Статус разработки">
        <option value="" disabled selected>Выберите статус разработки</option>
    <option value="test">Тестовая версия</option>
    <option value="stable">Стабильная версия</option>
    </select></p>
';
} else {
    $content .= '<p><input type="text" name="'.$name.'" value="" placeholder="'.$description.'"></p>
';
}
}
$content .= '<p><input type="button" value="Добавить" onclick="sendTransfer(`project`, {name: this.form.name.value, description: this.form.description.value, image_link: this.form.image_link.value, type: this.form.type.value, category: this.form.category.value, dev_status: this.form.dev_status.value, command: this.form.command.value.split(`,`), site: this.form.site.value, github: this.form.github.value})"></p>
</form>
</div>';
return $content;
?>