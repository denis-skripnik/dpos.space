<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Список задач</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>';
$filter = array();
if (isset($_GET)) {
	$filter['task_creator'] = $_GET['task_creator'];
	$filter['task_name'] = urlencode($_GET['task_name']);
	$filter['user'] = urlencode((isset($_GET['mamber']) ? $_GET['mamber'] : ''));
}
$pagenum = 1;
$url = pageUrl();
$end_page_url = end($url);
if (isset($end_page_url) && is_numeric($end_page_url)) {
    $pagenum = end(pageUrl());
}
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=working_tasks&filter='.json_encode($filter, JSON_FORCE_OBJECT).'&page='.$pagenum);
$wt = json_decode($html, true);
if ($wt && isset($_GET['mamber'])) {
$content .= '<div class="wt_author"><h2>Добавить отчёт по ходу работы</h2>
<form class="form">
<p><label for="text">Введите текст отчёта:</label></p>
<p><textarea name="text" id="wt_content" placeholder="текст отчёта"></textarea></p>
<p><input type="button" value="Отправить" onclick="sendCustom(`working_tasks`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, text: this.form.text.value})"></p>
</form></div>
<h2>Ход работы по задаче "'.$_GET['task_name'].'", создатель которой <a href="'.$conf['siteUrl'].'viz/profiles/'.$_GET['task_creator'].'" target="_blank">'.$_GET['task_creator'].'</a>, автор: <a href="'.$conf['siteUrl'].'viz/profiles/'.$_GET['mamber'].'" target="_blank"><span id="wt_login">'.$_GET['mamber'].'</span></a></h2>
<p><strong><a  href="'.$conf['siteUrl'].'viz/awards/link/'.$_GET['mamber'].'/0/Награждение ход работы по задаче: '.$conf['siteUrl'].'viz/projects/working-tasks/?task_creator='.$_GET['task_creator'].'&task_name='.$_GET['task_name'].'&mamber='.$_GET['mamber'].'" target="_blank">Наградить</a></strong></p>
<table><thead><tr><th>Дата</th><th>Текст</th><th>действия</th></tr></thead><btoby>';
	foreach ($wt as $num => $work) {
$content .= '<tr><td>'.$work['date'].'</td>
<td>'.$work['text'].'</td>
<td class="wt_author">
<form class="form">
<p><textarea name="wt_text" placeholder="текст отчёта">'.$work['text'].'</textarea></p>
<p><input type="button" value="Изменить" onclick="sendCustom(`working_tasks`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, text: this.form.wt_text.value, date: `'.$work['date'].'`})"></p>
</form>
<p><strong><input type="button" value="Удалить" onclick="sendCustom(`delete_working_task`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, date: `'.$work['date'].'`})"></strong></p>
</td></tr>';
}
$content .= '</tbody></table>
<script>
if (viz_login === `'.$_GET['mamber'].'`) {
$(`.wt_author`).css(`display`, `block`);
} else {
	$(`.wt_author`).css(`display`, `none`);
}
	</script>';
} else if (!isset($_GET['mamber'])) {
	$content .= '<h2>Присоединиться к задаче "'.$_GET['task_name'].'"</h2>
<p><strong><input type="button" value="Присоединиться" onclick="sendCustom(`add_task_member`, {creator: `'.$_GET['task_creator'].'`, name: `'.$_GET['task_name'].'`});"></strong></p>
	';
} else if (isset($_GET) && !$wt && isset($_GET['mamber'])) {
	$filter = array();
	$filter['creator'] = $_GET['task_creator'];
    $filter['name'] = urlencode($_GET['task_name']);
    $tasks_html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=tasks&filter='.json_encode($filter, JSON_FORCE_OBJECT).'&page=1');
    $tasks = json_decode($tasks_html, true);
if ($tasks && count($tasks) > 0) {
	$content .= '<p style="display: none;" id="whitelist_users">'.implode($tasks[0]['mambers']).'</p>
<div id="add_wt"><h2>Добавить отчёт по ходу работы, задача: "'.$_GET['task_name'].'"</h2>
<form class="form">
<p><label for="text">Введите текст отчёта:</label></p>
<p><textarea name="text" id="wt_content" placeholder="текст отчёта"></textarea></p>
<p><input type="button" value="Отправить" onclick="sendCustom(`working_tasks`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, text: this.form.text.value})"></p>
</form></div>

<script>
if ($(`#whitelist_users`).html().indexOf(viz_login) > -1) {
$(`#add_wt`).css(`display`, `block`);
} else {
	$(`#add_wt`).css(`display`, `none`);
}
</script>';
}
}
return $content;
?>