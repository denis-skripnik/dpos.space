<?php
require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    $type = pageUrl()[2];
    if (is_dir(__DIR__.'/pages/'.$type)) {
$page_config = configs(__DIR__.'/pages/'.$type.'/config.json');
$data = [];
$content_file = require_once(__DIR__.'/pages/'.$type.'/content.php');
$data['content'] = $blockchain_snippet;
$data['content'] .= $content_file['content'];
if ($type == 'results' || $type == 'voteing') {
    $data['title'] = $page_config['title'].$content_file['title'];
    $data['description'] = $page_config['description'].$content_file['description'];
} else {
$data['title'] = $page_config['title'];
$data['description'] = $page_config['description'];
}
}
    return $data;
}
    $data = generateAppPages($blockchain_snippet);
    ?>