<?php
define('FEED_LIMIT', 50);

require_once $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';
use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetDiscussionsByFeedCommand;

function transliteration($tag_en, $mode = 'torus')
{
    $lang = [
        'ые' => 'yie',
        'щ' => 'shch',
        'ш' => 'sh',
        'ч' => 'ch',
        'ц' => 'cz',
        'й' => 'ij',
        'ё' => 'yo',
        'э' => 'ye',
        'ю' => 'yu',
        'я' => 'ya',
        'х' => 'kh',
        'ж' => 'zh',
        'а' => 'a',
        'б' => 'b',
        'в' => 'v',
        'г' => 'g',
        'д' => 'd',
        'е' => 'e',
        'з' => 'z',
        'и' => 'i',
        'к' => 'k',
        'л' => 'l',
        'м' => 'm',
        'н' => 'n',
        'о' => 'o',
        'п' => 'p',
        'р' => 'r',
        'с' => 's',
        'т' => 't',
        'у' => 'u',
        'ф' => 'f',
        'ъ' => 'xx',
        'ы' => 'y',
        'ь' => 'x',
        //   'ґ' => 'g',
        //    'є' => 'e',
        //   'і' => 'i',
        //  'ї' => 'i'
    ];
    $eng = array_flip($lang);
    if ($mode == 'torus') {
        if (substr($tag_en, 0, 4) != 'ru--') {
            return $tag_en;
        }
        $tag_en = substr($tag_en, 4);
        $str = $tag_en;
        foreach ($eng as $lFrom => $lTo) {
            $from = $lFrom;
            $to = $lTo;
            $str = str_replace($from, $to, $str);
            $str = str_replace(mb_strtoupper($from, 'utf-8'), mb_strtoupper($to, 'utf-8'), $str);
        }
        return $str;
    }
}

if (!isset($user) && isset($_REQUEST['options']['user'])) { // проверяем существование элемента
    $user = $_REQUEST['options']['user'];
    } else if (!isset($user) && !isset($_REQUEST['options']['user'])) {
    return;
    }
    
    $site_url = '';
    if (isset($_REQUEST['options']['siteUrl'])) {
        $site_url = $_REQUEST['options']['siteUrl'];
    } else if (isset($conf['siteUrl'])) {
        $site_url = $conf['siteUrl'];
    }
    $isNotFirstPage = isset($_REQUEST['start']);
    if ($isNotFirstPage) {
        $start_author = $_REQUEST['start']['startAuthor'];
        $start_permlink = $_REQUEST['start']['startPermlink'];
        $options = [
            'limit' => 100,
            'tag' => $user,
            'start_author' => $start_author,
            'start_permlink' => $start_permlink,
        ];
    } else {
        $options = [
            'limit' => 100,
            'tag' => $user,
        ];
    }
    
$connector_class = CONNECTORS_MAP['steem'];

$commandQuery = new CommandQueryData();
$f_data = [$options];
$commandQuery->setParams($f_data);
$connector = new $connector_class();
$command = new GetDiscussionsByFeedCommand($connector);
$res = $command->execute($commandQuery);
$posts = $res['result'];

$result = [];
$result['content'] = '';
if (! $posts) {
    $result['content'] = '<p>Результатов нет. Возможно все подходящие операции в истории далеко или такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
    if (isset($_REQUEST['options']) || isset($_GET['options'])) {
        echo json_encode($result);
    return;
    } else {
    return $result['content'];
    }
}

$rowCount = 0;

$result['content'] .= '<div id="ajax_content"><h2>Посты и репосты подписок:</h2>
<table><tr>
<th>Дата</th>
<th>Название</th>
<th>Автор</th>
<th>Теги</th></tr>';
foreach ($posts as $content) {
    $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $created1 = $content['created'];
 $created2 = strtotime($created1);
$month2 = date('m', $created2);
$created = date('j', $created2).' '.$month[$month2].' '.date('Y г. H:i:s', $created2);
	$metadata = json_decode($content['json_metadata'], true);
    $tegi = $metadata['tags'];
    $filter_teg = array();

    if ($content['author'] !== 'now') {
        if (!count(array_intersect($tegi, $filter_teg))) {
            $rowCount++;

            if ($rowCount === FEED_LIMIT + 1) {
                $start_author = $content['author'];
                $start_permlink = $content['permlink'];
                $newStartAuthor = $start_author;
$newStartPermlink = $start_permlink;
                break;
            }

                  $result['content'] .= '<tr>
                  <td>'.$created.'</td>
                  <td><a href="https://steemit.com/' . $content['parent_permlink'] . '/@' . $content['author'] . '/' . $content['permlink'] . '" target="_blank">' . $content['title'] . '</a></td>
<td><a href="'.$site_url.'steem/profiles/' . $content['author'] . '" target="_blank">' . $content['author'] . '</a></td>
<td>';
$tags_str = '';
foreach ($tegi as $teg) {
                $taging = transliteration($teg, 'torus');

                $tags_str .= '<a href="https://steemit.com/created/' . $teg . '" target="_blank">' . $taging . '</a>, ';
            }
            $tags_str = substr($tags_str,0,-2);
            $result['content'] .= $tags_str.'</td></tr>';
        }
    }
} // Конец цикла
$result['nextIsExists'] = ! is_null($newStartAuthor);
if ($result['nextIsExists']) {
    $result['next'] = [
        'startAuthor' => $newStartAuthor,
        'startPermlink' => $newStartPermlink,
    ];
}

$result['content'] .= '</tr></table></div>';

if (isset($_REQUEST['options']) || isset($_GET['options'])) {
    echo json_encode($result);
} else {
return $result['content'];
}