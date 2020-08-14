<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Список задач</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>';
$filter = '{}';
if (isset($_GET)) {
	$filter = '{task_creator: "'.$_GET['task_creator'].'", task_name: "'.$_GET['task_name'].'"}';
}
$pagenum = 1;
$url = pageUrl();
$end_page_url = end($url);
if (isset($end_page_url) && is_numeric($end_page_url)) {
    $pagenum = end(pageUrl());
}
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=working_tasks&filter='.$filter.'&page='.$pagenum);
$wt = json_decode($html, true);
if ($wt) {
$content .= '<h2>Добавить отчёт по ходу работы</h2>
<form>
<p>label for="text">Введите текст отчёта:</label></p>
<p><textarea name="text" id="wt_content"></textarea></p>
<p><input type="button" value="Отправить" onclick="sendCustom(`working_tasks`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, text: `${document.getElementById(\'wt_conntent\').value}`})"></p>
</form>
<h2>Ход работы по задаче "'.$wt['task_name'].'", создатель которой <a href="'.$conf['siteUrl'].'viz/profiles/'.$wt['task_creator'].'" target="_blank">'.$wt['task_creator'].'</a>, автор: <a href="'.$conf['siteUrl'].'viz/profiles/'.$wt['user'].'" target="_blank"><span id="wt_login">'.$wt['user'].'</span></a></h2>
	<table><thead><tr><th>Дата</th><th>Текст</th></tr></thead><btoby>';
	foreach ($wt as $num => $work) {
$content .= '<tr><td>'.$work['date'].'</td>
<td>'.$work['text'].'</td></tr>
<div class="wt_author">
<h2>Изменить</h2>
<form>
<p>label for="wt_text">Введите текст отчёта:</label></p>
<p><textarea name="wt_text">'.$work['text'].'</textarea></p>
<p><input type="button" value="Изменить" onclick="sendCustom(`working_tasks`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, text: `${this.form.wt_text.value}`, date: `'.$work['date'].'`})"></p>
</form>
<h2>Удалить</h2>
<p><strong><input type="button" value="Удалить" onclick="sendCustom(`delete_working_task`, {task_creator: `'.$_GET['task_creator'].'`, task_name: `'.$_GET['task_name'].'`, date: `'.$work['date'].'`})"></strong></p>
</div>';
}
$content .= '</tbody></table>
<script>
if ($(`#wt_login`).html() === viz_login) {
$(`#wt_author`).css(`display`, `block`);
} else {
	$(`#wt_author`).css(`display`, `none`);
}
	</script>';
} else if (!isset($_GET['mamber'])) {
	$content .= '<h2>Присоединиться к задаче "'.$_GET['task_name'].'"</h2>
<p><strong><input type="button" value="Присоединиться" onclick="sendCustom(`add_task_member`, {creator: `'.$_GET['task_creator'].'`, name: `'.$_GET['task_name'].'`});"></strong></p>
	';
}
return $content;
?>