<?php
require_once 'eng-ru.php';
require_once 'ru-eng.php';

require_once 'db.php';

//Формируем тестовый запрос:
$query = "SELECT * FROM tags WHERE id > 0";
//Делаем запрос к БД, результат запроса пишем в $result:
//теперь в $res результат поиска
$db_result = $db->query($query);

//Преобразуем то, что отдала нам база в нормальный массив PHP $data:
$data = $db_result->fetchAll(PDO::FETCH_ASSOC);
krsort($data);

$tags_bd = array_map( function($el) {return $el['name'];}, $data);

$counter = count($data);
echo '<h3>Всего тегов: '.$counter.' (Отображаются сначала недавно добавленные)</h3>';
if( isset($_GET['client']) ){ // проверяем существование элемента
if ($_GET['client'] == 'golosio') {
echo '<table><tr><th>Название тега</th><th>Количество постов в новом</th><th>Транслит (В Английской раскладке)</th></tr>';
foreach ($data as $dating) {
$taging = transliteration_ru($dating['name'], 'torus');
$tagiru = transliteration_eng($dating['name'], 'torus');
echo '<tr>
        <td><a href="https://golos.io/created/'.$dating['name'].'" target="_blank">'.$taging.'</a></td>';
if ($dating['posts'] ==100) {
		echo '<td>>100</td>';
} else {
echo '<td>'.$dating['posts'].'</td>';
}
echo '<td>'.$tagiru.'</td>';
	echo '</tr>';
}
echo '</table>';
}
if ($_GET['client'] == 'goldvoice') {
echo '<table><tr><th>Название тега</th><th>Количество постов в новом</th><th>Транслит (В Английской раскладке)</th></tr>';
foreach ($data as $dating) {
$taging = transliteration_ru($dating['name'], 'torus');
$tagiru = transliteration_eng($dating['name'], 'torus');
echo '<tr>
        <td><a href="https://goldvoice.club/tags/'.$dating['name'].'" target="_blank">'.$taging.'</a></td>';
if ($dating['posts'] ==100) {
		echo '<td>>100</td>';
} else {
echo '<td>'.$dating['posts'].'</td>';
}
	echo '</tr>';
}
echo '</table>';
}
} else {
echo '<table><tr><th>Название тега</th><th>Количество постов в новом</th><th>Транслит (В Английской раскладке)</th></tr>';
foreach ($data as $dating) {
$taging = transliteration_ru($dating['name'], 'torus');
$tagiru = transliteration_eng($dating['name'], 'torus');
echo '<tr>
        <td><a href="https://golos.io/created/'.$dating['name'].'" target="_blank">'.$taging.'</a></td>';
if ($dating['posts'] ==100) {
		echo '<td>>100</td>';
} else {
echo '<td>'.$dating['posts'].'</td>';
}
echo '<td>'.$tagiru.'</td>';
	echo '</tr>';
}
echo '</table>';
}
?>