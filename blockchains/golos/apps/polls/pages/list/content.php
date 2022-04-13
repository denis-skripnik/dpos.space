<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$page = [];
$page['content'] = '<p><span align="left">Список опросов</span> <span align="right"><a href="'.$conf['siteUrl'].'golos/polls/create">Создание нового опроса</a></span></p>';
$html = file_get_contents('http://178.20.43.121:3000/golos-api?service=votes&type=list');
$table = json_decode($html, true);
$page['content'] .= '<ul>';
foreach ($table as $poll) {
    $page['content'] .= '<li><a href="'.$conf['siteUrl'].'golos/polls/voteing/'.$poll['permlink'].'" target="_blank">'.$poll['question'].'</a></li>
';
}
$page['content'] .= '</ul>';
return $page;
?>