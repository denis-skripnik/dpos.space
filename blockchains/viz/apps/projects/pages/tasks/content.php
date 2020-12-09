<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th>Список задач</th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<h2>Фильтр</h2>
<form class="form" method = "post" action = "">
<input type = "hidden" name = "chain" value = "viz">
<input type = "hidden" name = "service" value = "projects">
<input type = "hidden" name = "page" value = "tasks">
<label for="status">Статус задачи:</label>
<select name="status">
    <option value="false" selected>Выберите статус задачи</option>
<option value="open">Открытые</option>
<option value="finished">Завершённые</option>
</select>
<input type = "submit" value = "Фильтровать"/>
</form>
';
$pagenum = 1;
$url = pageUrl();
$end_page_url = end($url);
if (isset($end_page_url) && is_numeric($end_page_url)) {
    $pagenum = end(pageUrl());
}
$filter = array();
	if (isset($url[3])) {
			if ($url[4] !== 'false') $filter['status'] = $url[4];
			}
	
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=tasks&filter='.json_encode($filter, JSON_FORCE_OBJECT).'&page='.$pagenum);
$tasks = json_decode($html, true);
if ($tasks && count($tasks) > 0) {
$fields = ['creator' => 'Создатель', 'name' => 'Название', 'description' => 'Описание', 'mambers' => 'Участники', 'status' => 'Статус'];
	$content .= '<table><thead><tr>
';
foreach ($fields as $field) {
$content .= '<th>'.$field.'</th>
';
	}
$content .= '<th>Действия</th>
</tr></thead><tbody>
';
	foreach ($tasks as $task) {
$content .= '<tr>';
$counter = 0;
foreach ($task as $key => $el) {
	if ($counter > 0) {
		if ($key === 'mambers') {
			$mambers = '';
			foreach ($el as $mamber) {
				$mambers .= '<a href="'.$conf['siteUrl'].'viz/projects/working-tasks/?task_creator='.$task['creator'].'&task_name='.$task['name'].'&mamber='.$mamber.'" target="_blank">'.$mamber.'</a>, ';
			}
			$mambers .= '<a href="'.$conf['siteUrl'].'viz/projects/working-tasks/?task_creator='.$task['creator'].'&task_name='.$task['name'].'" target="_blank">Присоединиться</a>';
			$content .= '<td>'.$mambers.'</td>';
		} else {
			$content .= '<td>'.$el.'</td>';
		}
	
	}
$counter++;
}
$content .= '<td><a  href="'.$conf['siteUrl'].'viz/projects/update-task/?creator='.$task['creator'].'&name='.$task['name'].'" target="_blank">Изменить задачу (только для автора)</a></td>
</tr>';
}
$content .= '</tbody></table>';
}
return $content;
?>