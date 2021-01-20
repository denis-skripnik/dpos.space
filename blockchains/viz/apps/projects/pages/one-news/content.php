<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$content = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'viz/projects/tasks">Список задач</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/catalog">Каталог проектов</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/add">Добавить проект</a></th>
<th><a href="'.$conf['siteUrl'].'viz/projects/new-task">Добавить задачу</a></th>
</tr></table>';
$filter = array();
	if (isset($_GET)) {
		$filter['project_creator'] = $_GET['project_creator'];
		$filter['project_name'] = urlencode($_GET['project_name']);
		$filter['user'] = $_GET['user'];
		$filter['date'] = $_GET['date'];
	}
$html = file_get_contents('http://138.201.91.11:3100/viz-api?service=viz-projects&type=news&filter='.json_encode($filter, JSON_FORCE_OBJECT).'&page=1');
$news = json_decode($html, true);
if (isset($news) && count($news) > 0) {
	$el = $news[0];
$content .= '<h2>'.$el['title'].'</h2>
<p><a href="'.$conf['siteUrl'].'viz/projects/news/?project_creator='.$_GET['project_creator'].'&project_name='.$_GET['project_name'].'" target="_blank">к списку</a>, <a href="'.$conf['siteUrl'].'viz/projects/news-editor/?project_creator='.$_GET['project_creator'].'&project_name='.$_GET['project_name'].'&user='.$_GET['user'].'&date='.$_GET['date'].'" target="_blank">изменить</a></p>
<ul><li>'.$el['date'].'</li>
<li>Автор: <a href="'.$conf['siteUrl'].'viz/profiles/'.$el['user'].'" target="_blank">'.$el['user'].'</a></li>
<li><a  href="'.$conf['siteUrl'].'viz/awards/link/'.$el['user'].'/0/Награждение за новость '.$conf['siteUrl'].'viz/projects/one-news/?project_creator='.$_GET['project_creator'].'&project_name='.$_GET['project_name'].'&user='.$el['user'].'&date='.$_GET['date'].'" target="_blank">Наградить</a></li></ul>
<article>'.$el['text'].'</article>';
	} else {
		$content .= '<p>Новость не найдена.</p>';
	}
return $content;
?>