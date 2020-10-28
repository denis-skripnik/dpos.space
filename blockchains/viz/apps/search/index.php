<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages() {
    $type = pageUrl()[2];
if ($type === 'add-link') {
    if (is_dir(__DIR__.'/pages/add')) {
        $page_config = configs(__DIR__.'/pages/add/config.json');
        $data = [];
        $data['title'] = $page_config['title'];
        $data['description'] = $page_config['description'];
        $data['content'] = require_once(__DIR__.'/pages/add/content.php');
        }
} else {
    $query = urldecode(pageUrl()[3]);
$types = ['full_search' => 'Поиск с точным совпадением', 'unfull_search' => 'Поиск по анкорам'];
$page_numtext = 'страница 1';
if (isset(pageUrl()[4])) {
$page_numtext = 'страница '.pageUrl()[4];
}
    if (is_dir(__DIR__.'/pages/other')) {
$page_config = configs(__DIR__.'/pages/other/config.json');
$data = [];
$data['title'] = $page_config['title'].' '.$types[$type].' | '.$query.' | '.$page_numtext;
$data['description'] = $page_config['description'].' '.$types[$type].'. Запрос: '.$query.'. '.$page_numtext;
$data['content'] = require_once(__DIR__.'/pages/other/search.php');
}
}    
return $data;
}
    $data = generateAppPages();
    ?>