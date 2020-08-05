<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages() {
    $token = pageUrl()[2];
    $token = mb_strtolower($token);
    $tokens = ['golos' => 'GOLOS', 'gbg' => 'GBG', 'gp' => 'СГ', 'delegated_gp' => 'делегированной другим СГ', 'received_gp' => 'полученной делегированием СГ', 'effective_gp' => 'эффективной СГ', 'reputation' => 'репутации'];
    $page_numtext = 'страница 1';
    if (isset(pageUrl()[3])) {
$page_numtext = 'страница '.pageUrl()[3];
    }
    if (is_dir(__DIR__.'/pages')) {
$page_config = configs(__DIR__.'/pages/config.json');
$data = [];
$data['title'] = $page_config['title'].' '.$tokens[$token].' | '.$page_numtext;
$data['description'] = $page_config['description'].' '.$tokens[$token];
$data['content'] = require_once(__DIR__.'/pages/top.php');
}
    return $data;
}
    $data = generateAppPages();
    ?>