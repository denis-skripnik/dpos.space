<?php
require_once 'functions.php';
function generateAppPages() {
    global $conf;
    $page = pageUrl()[2];
    if (is_dir(__DIR__.'/pages/'.$page)) {
$page_config = configs(__DIR__.'/pages/'.$page.'/config.json');
$data = $page_config;
$data['content'] = require_once(__DIR__.'/pages/'.$page.'/content.php');
} else {
    $data = get404Page();
}
    return $data;
}
    $data = generateAppPages();
    ?>