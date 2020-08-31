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
<h2>Укажите информацию о задаче и отправьте в блокчейн</h2>
<p><strong><font color="red">ВНИМАНИЕ: стоимость добавления новой задачи 100 VIZ. Она будет переведена аккаунту viz-projects. Но если она окажется не спамом, наградим вас на сумму больше ста Viz.</font></strong></p>
<form>';
$fields = ['name' => 'Название', 'description' => 'Описание'];
foreach($fields as $name => $description) {
    $content .= '<p><input type="text" name="'.$name.'" value="" placeholder="'.$description.'"></p>';
}
$content .= '<p><input type="button" value="Добавить" onclick="sendTransfer(`task`, {name: this.form.name.value, description: this.form.description.value, mambers: [], status: `open`})"></p>
</form>
</div>';
return $content;
?>