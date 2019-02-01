<?php
define('FEED_LIMIT', 50);

require_once $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/params.php';
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

list ($service, $user, $chain) = $array_url;

$page = $_REQUEST['page'] ?? 1;
$start_author = $_REQUEST['start_author'] ?? false;
$start_permlink = $_REQUEST['start_permlink'] ?? false;

if ($chain === 'WLS' || $chain === 'steem') {
    if ($page == 1) {
        $options = [
            'limit' => 100,
            'tag' => $user,
        ];
    } else {
        $options = [
            'limit' => 100,
            'tag' => $user,
            'start_author' => $start_author,
            'start_permlink' => $start_permlink,
        ];
    }
} else {
    if ($page == 1) {
        $options = [
            'limit' => 100,
            'select_authors' => [$user],
        ];
    } else {
        $options = [
            'limit' => 100,
            'select_authors' => [$user],
            'start_author' => $start_author,
            'start_permlink' => $start_permlink,
        ];
    }
}

$connector_class = CONNECTORS_MAP[$chain];

$commandQuery = new CommandQueryData();
$data = [$options];
$commandQuery->setParams($data);
$connector = new $connector_class();
$command = new GetDiscussionsByFeedCommand($connector);
$res = $command->execute($commandQuery);
$result = $res['result'];

$rowCount = 0;

$start_author = null;
$start_permlink = null;

echo '<h2>Введите логин, чтобы увидеть ленту подписок пользователя</h2>';
require_once $_SERVER['DOCUMENT_ROOT'] . '/template/form_without_select.php';
echo '<h2>Посты:</h2>
<table start="'. ($page * 50 - 49) .'">
<tr><th>Название</th>
<th>Автор</th>
<th>Дата</th>
<th>Процент кураторам</th>
<th>Теги</th></tr>';
foreach ($result as $content) {
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
                break;
            }

            if ($chain == 'steem' or $chain == 'WLS') {
                $curators_share = $sum_weight / $content['total_vote_weight'] * 0.25 ?? 0;
                $curation_procent = round($curators_share*100, 2);
                } else if ($chain == 'viz') {
                  $curation_procent = round($content['curation_percent']/100, 2);
                } else if ($chain == 'golos') {
                  $curation_procent = round($content['curation_rewards_percent']/100, 2);
                }
            echo '<tr>
<td><a href="https://' . $client . '/' . $content['parent_permlink'] . '/@' . $content['author'] . '/' . $content['permlink'] . '" target="_blank">' . $content['title'] . '</a></td>
<td><a href="https://' . $client . '/@' . $content['author'] . '" target="_blank">@' . $content['author'] . '</a></td>
<td>'.$created.'</td>
<td>'.$curation_procent.'%</td>
<td>';
$tags_str = '';
foreach ($tegi as $teg) {
                $taging = transliteration($teg, 'torus');

                $tags_str .= '<a href="https://' . $client . '/created/' . $teg . '" target="_blank">' . $taging . '</a>, ';
            }
            $tags_str = substr($tags_str,0,-2);
            echo $tags_str;
            echo '</td></tr>';
        }
    }
} // Конец цикла
echo '</table>';

if (is_null($start_author)) {
    echo '<span>Последняя страница с данными</span>';
} else {
    $page++;
    require_once $_SERVER['DOCUMENT_ROOT'] . '/template/form_feed_next.php';
}
