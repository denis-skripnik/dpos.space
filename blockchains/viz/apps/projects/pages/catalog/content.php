<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th>Каталог</th>
<th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Задачи</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<h2>Фильтр</h2>
<form method = "post" action = "">
<input type = "hidden" name = "chain" value = "viz">
<input type = "hidden" name = "service" value = "projects">
<input type = "hidden" name = "page" value = "catalog">
<input type = "hidden" name = "type_variant" value = "type">
<label for="type">Тип проекта:</label>
<select name="type">
    <option value="false" selected>Выберите тип проекта</option>
';
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=types');
$types = json_decode($html, true);
if ($types && count($types) > 0) {
	foreach($type as $types) {
		$content .= '<option value="'.$type.'">'.$type.'</option>';
	}
}
$content .= '</select>
<input type = "hidden" name = "category_variant" value = "category">
<label for="category">Категория проекта:</label>
<select name="category">
    <option value="false" selected>Выберите категорию проекта</option>
';
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=categories');
$categories = json_decode($html, true);
if ($categories && count($categories) > 0) {
	foreach($categories as $category) {
		$content .= '<option value="'.$category.'">'.$category.'</option>';
	}
}
$content .= '</select>
<input type = "hidden" name = "dev_status_variant" value = "dev-status">
<label for="dev_status">Выберите статус задачи:</label>
<select name="dev_status">
    <option value="false" selected>Выберите статус разработки проекта</option>
<option value="test">Тестовая версия</option>
<option value="stable">Стабильная версия</option>
</select>
<input type = "submit" value = "узнать инфу"/>
</form>
';
$pagenum = 1;
$url = pageUrl();
$end_page_url = end($url);
if (isset($end_page_url) && is_numeric($end_page_url)) {
    $pagenum = end(pageUrl());
}
$filter = '{}';
if (isset($url[3])) {
	$filter = '{';
		if ($url[4] !== 'false') $filter .= 'type: "'.$url[4].'", ';
		if ($url[6] !== 'false') $filter .= 'category: "'.$url[6].'", ';
		if ($url[8] !== 'false') $filter .= 'dev_status: "'.$url[8].'"';
		$filter .= '}';
		}
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=projects&filter='.$filter.'&page='.$pagenum);
$projects = json_decode($html, true);
if ($projects && count($projects) > 0) {
	$fields = ['creator' => 'Создатель', 'name' => 'Название', 'description' => 'Описание', 'image_link' => 'Изображение', 'type' => 'Тип', 'category' => 'Категория', 'dev_status' => 'Статус разработки', 'command' => 'Команда', 'site' => 'Сайт', 'github' => 'Github'];
	$content .= '<table><thead><tr>
';
foreach ($fields as $field) {
$content .= '<th>'.$field.'</th>
';
	}
$content .= '<th>Действия</th>
</tr></thead><tbody>
';
	foreach ($projects as $project) {
$content .= '<tr>';
foreach ($project as $key => $el) {
	if ($key === 'command') {
		$content .= '<td>'.implode($el).'</td>';
	} else {
		$content .= '<td>'.$el.'</td>';
	}
}
$content .= '<td><a  href="'.$conf['siteUrl'].'viz/projects/update-project/?creator='.$project['creator'].'&name='.$project['name'].'" target="_blank">Изменить проект (только для автора)</a></td>
</tr>';
}
$content .= '</tbody></table>';
}
return $content;
?>