<?php
session_start();
require_once 'eng-ru.php';

require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

use GrapheneNodeClient\Commands\Single;
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByCreatedCommand;
use GrapheneNodeClient\Connectors\WebSocket\GolosWSConnector;

$commandQuery = new CommandQueryData();

$commandQuery->setParams([
    [
        'limit' => 100,
    ]
]);

$connector = new GolosWSConnector();

$command = new GetDiscussionsByCreatedCommand($connector);

$result = $command->execute(
    $commandQuery
);

require_once 'db.php';

//Формируем тестовый запрос:
$query = "SELECT * FROM tags WHERE id > 0";
//Делаем запрос к БД, результат запроса пишем в $result:
//теперь в $res результат поиска
$db_result = $db->query($query);

//Преобразуем то, что отдала нам база в нормальный массив PHP $data:
$data = $db_result->fetchAll(PDO::FETCH_ASSOC);
$tags_bd = array_map( function($el) {return $el['name'];}, $data);

$uniqueTags = [];
for ($num = 0; $num <=99; $num++) {
$metadata = json_decode($result['result'][$num]['json_metadata'], true);
$tegi = $metadata['tags'];
$uniqueTags = array_merge( $uniqueTags, $tegi);
}
$unictags = array_unique($uniqueTags);
foreach ($unictags as $teg) {
if (!in_array($teg, $tags_bd)) {
$commandQuery->setParams([
    [
        'limit' => 100,
'select_tags'    => [$teg], //list of tags to include, posts without these tags are filtered
    ]
]);
$result2 = $command->execute(
    $commandQuery
);
$ret = $result2['result'];
$numposts = count($ret);
$taging = transliteration_ru($teg, 'torus');
if ($teg == $taging) {

} else {
$query17 = "INSERT INTO tags SET name='".$teg."', posts=".$numposts;
$result17 = $db->exec($query17);
}
} // Закончен foreach
}
?>