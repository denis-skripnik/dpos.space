<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$content = '';
$pagenum = 1;
if (isset(pageUrl()[3])) {
    $pagenum = pageUrl()[3];
}
$html = file_get_contents('http://138.201.91.11:3000/golos-api?service=uia-top&token='.mb_strtolower(pageUrl()[2]).'&page='.$pagenum);
$top = json_decode($html, true);
$next_page = true;
if ($top && count($top) > 0) {
    $content = '<table><thead><tr>
<th>№</th><th>Логин</th><th>Суммарный баланс аккаунта</th><th>Основной баланс (ликвид)</th><th>TIP баланс (донаты)</th>
</tr></thead><tbody>';
foreach ($top as $key => $value) {
    $n = $key + 1;
    $content .= '<tr>
<td>'.$n.'</td>
<td><a href="'.$conf['siteUrl'].'golos/profiles/'.$value['login'].'" target="_blank">'.$value['login'].'</a></td>
<td>'.$value['summ_balance'].'</td>
<td>'.$value['main_balance'].'</td>
<td>'.$value['tip_balance'].'</td>
</tr>';
}
$content .= '</tbody></table>';
} else {
    $content = '<p>Данных на данной странице не найдено. Вернитесь на предыдущую.</p>
';
$next_page = false;
}
if ($top && count($top) < 100) {
    $next_page = false;
}
$content .= '</p>';
if ($pagenum > 1) {
    $content .= '<a href="'.$conf['siteUrl'].'golos/top/'.pageUrl()[2].'/'.($pagenum-1).'">Предыдущая</a> - ';
}
if ($next_page == true) {
    $content .= '<a href="'.$conf['siteUrl'].'golos/top/'.pageUrl()[2].'/'.($pagenum+1).'">Следующая</a></p>';
}

    return $content;
?>