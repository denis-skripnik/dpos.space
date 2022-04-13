<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$type = pageUrl()[2];
$query = pageUrl()[3];
$content = '<p><span align="left"><a href="'.$conf['siteUrl'].'viz/search">Найти ещё</a></span> <a href="'.$conf['siteUrl'].'viz/search/add-link">добавить ссылку</a></span></p>';
$pagenum = 1;
if (isset(pageUrl()[4])) {
    $pagenum = pageUrl()[4];
}
$html = file_get_contents('http://178.20.43.121:3100/viz-api?service=links&type='.$type.'&query='.$query.'&page='.$pagenum);
$results = json_decode($html, true);
if ($results && count($results) > 0) {
$content .= '<h2>Результаты поиска</h2>
<ul>
';
foreach ($results as $res) {
    if (strpos($res['link'], 'viz://') !== false) $res['link'] = 'https://hackathon-on-internet-freedom.github.io/Free-Speech-Project/dapp.html#'.$res['link'];
        if (strpos($res['link'], 'ipfs://') !== false) $res['link'] = 'https://ipfs.io/ipfs/'.substr($res['link'], 7);
        $content .= '<li><h3><a href="'.$res['link'].'" target="_blank">'.(isset($res['keyword']) ? $res['keyword'] : $res['link']).'</a></h3>
    <p>Относится к ';
$in_links = '';
    foreach ($res['inlinks'] as $in_link) {
        if (strpos($in_link, 'viz://') !== false) $in_link = 'https://hackathon-on-internet-freedom.github.io/Free-Speech-Project/dapp.html#'.$in_link;
            if (strpos($in_link, 'ipfs://') !== false) $in_link = 'https://ipfs.io/ipfs/'.substr($in_link, 7);
        $in_links .= '<a href="'.$in_link.'" target="_blank">'.$in_link.'</a>, ';
}
$in_links = substr($in_links, 0, -2);
$content .= $in_links.'</p>
</li>';
}
$content .= '</ul>';
} else {
    $content = '<p>Данных на данной странице не найдено. Вернитесь на предыдущую.</p>
';
}
$content .= '</p>';
if ($pagenum > 1) {
    $content .= '<a href="'.$conf['siteUrl'].'viz/search/'.pageUrl()[2].'/'.pageUrl()[3].'/'.($pagenum-1).'">Предыдущая</a> - ';
}
$content .= '<a href="'.$conf['siteUrl'].'viz/search/'.pageUrl()[2].'/'.pageUrl()[3].'/'.($pagenum+1).'">Следующая</a></p>';
return $content;
?>