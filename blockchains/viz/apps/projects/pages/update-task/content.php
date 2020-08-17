<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Обновите данные по задаче</h2>
<form>';
$$filter = '{creator: "'.$_GET['creator'].'", name: "'.$_GET['name'].'"}';
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=tasks&filter='.$filter.'&page=1');
$tasks = json_decode($html, true);
if ($tasks && count($tasks) > 0) {
$task = $tasks[0];
$content .= '<p><a id="moderation_link" href="'.$conf['siteUrl'].'viz/projects/admin?type=task&creator='.$_GET['creator'].'&name='.$_GET['name'].'" target="_blank">Модерировать</a></p>
<div id="task_author"><h3>Автор: <a href="'.$conf['siteUrl'].'viz/profiles/'.$task['creator'].'" target="_blank"><span id="task_login">'.$task['creator'].'</span></a></h3>';
$fields = ['name' => 'Название', 'description' => 'Описание', 'mambers' => 'Участники', 'status' => 'Статус'];
foreach($fields as $name => $description) {
if ($name === 'status') {
    $content .= '<p><select name="status" placeholder="Статус задачи">
        <option value="" disabled selected>Выберите статус задачи</option>';
if ($task['status'] === 'open') {
    $content .= '<option value="open" selected>Открыта</option>';
} else {
    $content .= '<option value="open">Открыта</option>';
}
if ($task['status'] === 'finished') {
    $content .= '<option value="finished" selected>Завершена</option>';
} else {
    $content .= '<option value="finished">Завершена</option>';
}
$content .= '</select></p>
';
} else if ($name === 'mambers') {
    $content .= '<p><input type="text" name="'.$name.' value="'.implode(',', $task[$name]).'" placeholder="'.$description.'"></p>
';
} else {
    $content .= '<p><input type="text" name="'.$name.'" value="'.$task[$name].'" placeholder="'.$description.'"></p>
';
}
}
$content .= '<p><input type="button" value="Изменить" onclick="sendCustom(`update_task`, {creator: `'.$task['creator'].'`, name: `'.$task['name'].'`, new_name: this.form.name.value, description: this.form.description.value, mambers: this.form.mambers.value.split(`,`), status: this.form.status.value})"></p>
</div>
<script>
if ($(`#task_login`).html() === viz_login) {
    $(`#task_author`).css(`display`, `block`);
    } else {
        $(`#task_author`).css(`display`, `none`);
    }
    if (viz_login === `viz-projects`) {
        $(`#moderation_link`).css(`display`, `inline`);
            } else {
                $(`#moderation_link`).css(`display`, `none`);
            }    
    </script>';
} else {
    $content .= '<p>Задача не найдена.</p>';
}
$content .= '</form>
</div>';
return $content;
?>