<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages() {
    $token = pageUrl()[2];
    $token = mb_strtolower($token);
    $tokens = ['viz' => 'VIZ', 'shares' => 'соц. капиталу', 'delegated_shares' => 'делегированному другим соц. капиталу', 'received_shares' => 'полученному делегированием соц. капиталу', 'effective_shares' => 'эффективному соц. капиталу', 'vesting_withdraw_rate' => 'Выводимому соц. капиталу'];
    $page_numtext = 'страница 1';
    if (isset(pageUrl()[3])) {
$page_numtext = 'страница '.pageUrl()[3];
    }
    if (is_dir(__DIR__.'/pages') && isset($tokens[$token])) {
$page_config = configs(__DIR__.'/pages/config.json');
$data = [];
$data['title'] = $page_config['title'].' '.$tokens[$token].' | '.$page_numtext;
$data['description'] = $page_config['description'].' '.$tokens[$token];
$data['content'] = require_once(__DIR__.'/pages/top.php');
} else {
    $data = get404Page();
}
    return $data;
}
    $data = generateAppPages();
    ?>