<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages() {
    global $conf;
    $delegation = pageUrl()[2];
    if (is_dir(__DIR__.'/'.$delegation)) {
$page_config = configs(__DIR__.'/'.$delegation.'/config.json');
$data = [];
$data['title'] = $page_config['title'];
$data['description'] = $page_config['description'];
$data['content'] = require_once(__DIR__.'/'.$delegation.'/content.php');
}
    return $data;
}
    $data = generateAppPages();
    ?>