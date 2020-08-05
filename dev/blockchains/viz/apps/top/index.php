<?php
require_once 'functions.php';
function generateAppPages() {
    $token = pageUrl()[2];
    $token = mb_strtolower($token);
    $tokens = ['viz' => 'VIZ', 'shares' => 'соц. капиталу', 'delegated_shares' => 'делегированному другим соц. капиталу', 'received_shares' => 'полученному делегированием соц. капиталу', 'effective_shares' => 'эффективному соц. капиталу'];
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