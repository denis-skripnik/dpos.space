<?php
require_once 'functions.php';
function generateAppPages() {
    $type = pageUrl()[2];
    if (is_dir(__DIR__.'/pages/'.$type)) {
$data = configs(__DIR__.'/pages/'.$type.'/config.json');
$data['content'] = require_once(__DIR__.'/pages/'.$type.'/content.php');
} else {
    $data = configs(__DIR__.'/config.json');
$data['content'] = require_once(__DIR__.'/content.php');
}
return $data;
}
    $data = generateAppPages();
    ?>