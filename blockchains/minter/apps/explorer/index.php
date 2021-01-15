<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
ob_start();

require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    global $conf;
    $page = pageUrl()[2];
$datas = pageUrl()[3];

    if (is_dir(__DIR__.'/pages/'.$page) && isset($datas)) {
            $page_config = configs(__DIR__.'/pages/'.$page.'/config.json');
        $data = [];
        $data['title'] = $page_config['title'].$datas;
        $data['description'] = $page_config['description'].$datas;
        $data['content'] = $blockchain_snippet;
        $data['content'] .= require_once(__DIR__.'/pages/'.$page.'/content.php');
    } else {
        if (is_numeric($page)) {
            header( "Refresh: 1; URL=" .$conf['siteUrl'] . 'minter/explorer/block/'.$page);
        } else if (is_float(HexDec($page))) {
            header( "Refresh: 1; URL=".$conf['siteUrl'] . 'minter/explorer/tx/'.$page);
        }
    }
    return $data;
}
$data = generateAppPages($blockchain_snippet);
ob_end_flush();
    ?>