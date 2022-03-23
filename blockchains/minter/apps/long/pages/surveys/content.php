<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$url = pageUrl();
if (!isset($url[3])) {
    return '<h2>Меню</h2>
    <ul><li><a href="'.$conf['siteUrl'].'minter/long/surveys/create">Создать новый</a></li>
    <li><a href="'.$conf['siteUrl'].'minter/long/surveys/list">Список</a></li></ul>
    ';
} else {
    if (is_dir(__DIR__.'/pages/'.$url[3])) {
        $page_config = configs(__DIR__.'/pages/'.$url[3].'/config.json');
        $data = [];
        $content_file = require_once(__DIR__.'/pages/'.$url[3].'/content.php');
        $data['content'] = $blockchain_snippet;
        $data['content'] .= $content_file['content'];
        if ($url[3] == 'results' || $url[3] == 'voteing') {
            $data['title'] = $page_config['title'].$content_file['title'];
            $data['description'] = $page_config['description'].$content_file['description'];
        } else {
        $data['title'] = $page_config['title'];
        $data['description'] = $page_config['description'];
        }
        }
        }
?>