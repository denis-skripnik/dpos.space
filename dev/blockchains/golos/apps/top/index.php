<?php
require_once 'functions.php';
function generateAppPages() {
    $token = pageUrl()[2];
    $token = mb_strtolower($token);
    $tokens = ['golos' => 'GOLOS', 'gbg' => 'GBG', 'gp' => 'СГ', 'delegated_gp' => 'делегированной другим СГ', 'received_gp' => 'полученной делегированием СГ', 'effective_gp' => 'эффективной СГ'];
    if (is_dir(__DIR__.'/pages')) {
$page_config = configs(__DIR__.'/pages/config.json');
$data = [];
$data['title'] = $page_config['title'].' '.$tokens[$token];
$data['description'] = $page_config['description'].' '.$tokens[$token];
$data['content'] = require_once(__DIR__.'/pages/top.php');
}
    return $data;
}
    $data = generateAppPages();
    ?>