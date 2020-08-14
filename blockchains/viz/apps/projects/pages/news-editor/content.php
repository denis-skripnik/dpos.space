<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Редактор новостей</h2>
<form>';
$filter = '{}';
	if (isset($_GET) && isset($_GET['project_creator']) && isset($_GET['project_name']) && isset($_GET['user']) && isset($_GET['date'])) {
		$filter = '{project_creator: "'.$_GET['project_creator'].'", project_name: "'.$_GET['project_name'].'", user: "'.$_GET['user'].'", date: "'.$_GET['date'].'"}';
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=news&filter='.$filter.'&page=1');
$news = json_decode($html, true);
if (isset($news) && count($news) > 0) {
	$el = $news[0];
$content .= '<div id="news_author"><h3>'.$el['title'].'</h3>
<ul><li>'.$el[date].'</li>
<li>Автор: <a href="'.$conf['siteUrl'].'viz/profiles/'.$el['user'].'" target="_blank"><span id="news_login">'.$el['user'].'</span></a></li></ul>
';
$fields = ['title' => 'Заголовок', 'description' => 'Описание', 'text' => 'Текст новости', 'image_link' => 'Изображение'];
foreach($fields as $name => $description) {
if ($name === 'description' || $name === 'text') {
    $content .= '<p><textarea name="'.$name.'" placeholder="'.$description.'">'.$el[$name].'</textarea></p>
';
} else {
    $content .= '<p><input type="text" name="'.$name.'" value="'.$el[$name].'" placeholder="'.$description.'"></p>
';
}
}
$content .= '<p><input type="button" value="Изменить" onclick="sendCustom(`news`, {project_creator: "'.$_GET['project_creator'].'", project_name: "'.$_GET['project_name'].'", user: "'.$_GET['user'].'", date: "'.$_GET['date'].'", title: this.form.title.value, description: this.form.description.value, text: this.form.text.value, image_link: this.form.image_link.value})"></p>
<h2>Удаление новости</h2>
<p><font color="red"><input type="button" value="Удалить новость" onclick="sendCustom(`delete_one_news`, {project_creator: "'.$_GET['project_creator'].'", project_name: "'.$_GET['project_name'].'", date: "'.$_GET['date'].'"})"></font></p>
</div>
<script>
if ($(`#news_login`).html() === viz_login) {
    $(`#news_author`).css(`display`, `block`);
    } else {
        $(`#news_author`).css(`display`, `none`);
    }
        </script>';
} else {
    $content .= '<p>Новость не найдена.</p>';
}
    } else if (isset($_GET) && isset($_GET['project_creator']) && isset($_GET['project_name']) && !isset($_GET['user']) && !isset($_GET['date'])) {
		$filter = '{creator: "'.$_GET['project_creator'].'", name: "'.$_GET['project_name'].'"}';
        $html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=projects&filter='.$filter.'&page='.$pagenum);
        $projects = json_decode($html, true);
if ($projects && count($projects) > 0) {
    $project = $projects[0];
    $users_white_list = implode(',', $project['command']).','.$project['creator'];
    $content .= '<p style="display: none;" id="users_whitelist">'.$users_white_list.'</p>
<div id="news_author"><h3>Создание новой новости</h3>';
    $fields = ['title' => 'Заголовок', 'description' => 'Описание', 'text' => 'Текст новости', 'image_link' => 'Изображение'];
    foreach($fields as $name => $description) {
    if ($name === 'description' || $name === 'text') {
        $content .= '<p><textarea name="'.$name.'" placeholder="'.$description.'"></textarea></p>
    ';
    } else {
        $content .= '<p><input type="text" name="'.$name.'" value="" placeholder="'.$description.'"></p>
    ';
    }
    }
    $content .= '<p><input type="button" value="Создать" onclick="sendCustom(`news`, {project_creator: "'.$_GET['project_creator'].'", project_name: "'.$_GET['project_name'].'", user: viz_login, title: this.form.title.value, description: this.form.description.value, text: this.form.text.value, image_link: this.form.image_link.value})"></p>
</div>
<script>
    if ($(`#users_whitelist`).html().indexOf(viz_login) > -1) {
        $(`#news_author`).css(`display`, `block`);
        } else {
            $(`#news_author`).css(`display`, `none`);
        }
            </script>';
}
	}
$content .= '</form>
</div>';
return $content;
?>