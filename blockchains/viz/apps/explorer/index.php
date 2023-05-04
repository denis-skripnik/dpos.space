<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
ob_start();

require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    global $conf;
    $page = pageUrl()[2];

    if (is_dir(__DIR__.'/pages/'.$page) && isset(pageUrl()[3])) {
        $datas = pageUrl()[3];
            $page_config = configs(__DIR__.'/pages/'.$page.'/config.json');
        $data = [];
        $data['title'] = $page_config['title'].$datas;
        $data['description'] = $page_config['description'].$datas;
        $data['content'] = $blockchain_snippet;
        $data['content'] .= require_once(__DIR__.'/pages/'.$page.'/content.php');
    } else {
        $data = [];
        $data['title'] = 'Redirecting...';
        $data['description'] = 'Redirecting...';
        $data['content'] = $blockchain_snippet;
        if (is_numeric($page)) {
            header( "Refresh: 1; URL=" .$conf['siteUrl'] . 'viz/explorer/block/'.$page);
        } else if (strlen($page) === 40 && is_float(HexDec($page))) {
            header( "Refresh: 1; URL=".$conf['siteUrl'] . 'viz/explorer/tx/'.$page);
        }
    }
    return $data;
}
$data = generateAppPages($blockchain_snippet);
ob_end_flush();
    ?>