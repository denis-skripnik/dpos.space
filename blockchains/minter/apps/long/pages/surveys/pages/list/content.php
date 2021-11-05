<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$page = [];
$page['content'] = '<p><span align="left">Список опросов</span> <span align="right"><a href="'.$conf['siteUrl'].'minter/long/surveys/create">Создание нового опроса</a></span></p>';
$html = file_get_contents('http://138.201.91.11:3852/smartfarm/surveys?type='.pageUrl()[3]);
$table = json_decode($html, true);
$page['content'] .= '<ul>';
foreach ($table as $survey) {
    $page['content'] .= '<li><a href="'.$conf['siteUrl'].'minter/long/surveys/voteing/'.$survey['id'].'" target="_blank">'.$survey['question'].'</a></li>
';
}
$page['content'] .= '</ul>';
return $page;
?>