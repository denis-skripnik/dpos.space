<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    global $conf;
    $page = pageUrl()[2];
    if (is_dir(__DIR__.'/pages/'.$page)) {
$page_config = configs(__DIR__.'/pages/'.$page.'/config.json');
$data = $page_config;
$data['content'] = $blockchain_snippet;
$data['content'] .= require_once(__DIR__.'/pages/'.$page.'/content.php');
} else {
    $page_config = configs(__DIR__.'/config.json');
    $data = $page_config;
    $data['content'] = $blockchain_snippet;
    $data['content'] .= require_once(__DIR__.'/content.php');
}
    return $data;
}
    $data = generateAppPages($blockchain_snippet);
    ?>