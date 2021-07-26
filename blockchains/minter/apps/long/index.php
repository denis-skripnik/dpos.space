<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
ob_start();

require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    global $conf;
    $page = pageUrl()[2];

    if (is_dir(__DIR__.'/pages/'.$page)) {
            $page_config = configs(__DIR__.'/pages/'.$page.'/config.json');
        $data = [];
        $data['title'] = $page_config['title'];
        $data['description'] = $page_config['description'];
        $data['content'] = $blockchain_snippet;
        $data['content'] .= require_once(__DIR__.'/pages/'.$page.'/content.php');
    }
    return $data;
}
$data = generateAppPages($blockchain_snippet);
ob_end_flush();
    ?>