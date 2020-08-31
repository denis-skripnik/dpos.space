<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Список задач</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>
<h2>Список новостей';
$filter = array();
	if (isset($_GET)) {
		$content .= ' (<a href="'.$conf['siteUrl'].'viz/projects/news-editor/?project_creator='.$_GET['project_creator'].'&project_name='.$_GET['project_name'].'" target="_blank">добавить</a>)';
		$filter['project_creator'] = $_GET['project_creator'];
		$filter['project_name'] = urlencode($_GET['project_name']);
	}
$content .= '</h2>
<table><thead><tr><th>Заголовок</th>
<th>Дата</th>
<th>Автор</th>
<th>Описание</th>
<th>Действия</th></tr></thead><tbody>';
$pagenum = 1;
$url = pageUrl();
$end_page_url = end($url);
if (isset($end_page_url) && is_numeric($end_page_url)) {
    $pagenum = end(pageUrl());
}
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=news&filter='.json_encode($filter, JSON_FORCE_OBJECT).'&page='.$pagenum);
$news = json_decode($html, true);
if (isset($news) && count($news) > 0) {
	foreach ($news as $num => $el) {
$content .= '<tr><td>'.$el['title'].'</td>
<td>'.$el['date'].'</td>
<td><a href="'.$conf['siteUrl'].'viz/profiles/'.$el['user'].'" target="_blank">'.$el['user'].'</a></td>
<td>'.$el['description'].'</td>
<td><a href="'.$conf['siteUrl'].'viz/projects/one-news/?project_creator='.$el['project_creator'].'&project_name='.$el['project_name'].'&user='.$el['user'].'&date='.$el['date'].'" target="_blank">Читать</a>, <a  href="'.$conf['siteUrl'].'viz/projects/news-editor/?project_creator='.$el['project_creator'].'&project_name='.$el['project_name'].'&user='.$el['user'].'&date='.$el['date'].'" target="_blank">Изменить новость (только для автора)</a></td>';
}
}
$content .= '</tbody></table>';
return $content;
?>