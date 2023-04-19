<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
ob_start();

require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    global $conf;
    $permlink = pageUrl()[2];

    if (is_dir(__DIR__.'/pages/'.$permlink)) {
        $page_config = configs(__DIR__.'/pages/'.$permlink.'/config.json');
        $data = [];
        $data['title'] = $page_config['title'];
        $data['description'] = $page_config['description'];
        $data['content'] = $blockchain_snippet;
        $data['content'] .= require_once(__DIR__.'/pages/'.$permlink.'/content.php');
    if ($permlink === 'calc' && isset(pageUrl()[3])) {
        $data['title'] .= ' '.pageUrl()[3];
        $data['description'] .= '. Адрес кошелька: '.pageUrl()[3];
    } else     if ($permlink === 'bids' && isset(pageUrl()[3])) {
        $data['title'] .= ' '.pageUrl()[3];
        $data['description'] .= '. Дата: '.pageUrl()[3];
    } else     if ($permlink === 'loto' && isset(pageUrl()[3])) {
        $data['title'] .= ' '.pageUrl()[3];
        $data['description'] .= '. Дата: '.pageUrl()[3];
    }
    } else if ($permlink[0] === '?') {
        $page_config = configs(__DIR__.'/config.json');
        $data = [];
        $data['title'] = $page_config['title'];
        $data['description'] = $page_config['description'];
        $data['content'] = $blockchain_snippet;
        $data['content'] .= require_once(__DIR__.'/content.php');
    }
    return $data;
}
$data = generateAppPages($blockchain_snippet);
ob_end_flush();
    ?>