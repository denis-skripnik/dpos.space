<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages() {
    $app_dir = __DIR__;
    $user = pageUrl()[2];
    $user = str_replace('@', '', $user);
    if (is_dir(__DIR__.'/page')) {
$page_config = configs(__DIR__.'/page/config.json');
$data = [];
$data['title'] = $page_config['title'].' '.$user;
$data['description'] = $page_config['description'].' '.$user;
$data['menu'] = generateMenu();
$data['content'] = require_once(__DIR__.'/page/content.php');
}
    return $data;
}
    $data = generateAppPages();
?>