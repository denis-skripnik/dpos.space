<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
require_once 'functions.php';
function generateAppPages($blockchain_snippet) {
    global $conf;
    $user = pageUrl()[2];
    $user = str_replace('@', '', $user);
    if (is_dir(__DIR__.'/page')) {
$page_config = configs(__DIR__.'/page/config.json');
$data = [];
$data['title'] = $page_config['title'].' '.$user;
$data['description'] = $page_config['description'].' '.$user;
$pages = '<h2>Страницы сервиса</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'">Основное</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/transfers">Переводы средств</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/hp">Hive Power</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/dao">ДАО</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/author-rewards">Авторские награды</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/curation-rewards">Кураторские награды</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/benefactor-rewards">Бенефициарские</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/accounts">Аккаунты</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/new-posts">Новые посты</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/old-posts">Получившие выплаты посты</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/feed">Посты подписчиков</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/comments">Комментарии</a></th>
<th><a href="'.$conf['siteUrl'].'hive/profiles/'.$user.'/witness">Делегат</a></th>
</tr></table>';
if (!isset(pageUrl()[3])) {
$data['title'] .= ' - основное';
$data['description'] .= ' - основное';
$data['content'] = $blockchain_snippet;
$data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/userinfo.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'transfers') {
    $data['title'] .= ' - Переводы средств';
    $data['description'] .= ' - переводы средств';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/transfers.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
$data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/transfers.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'hp') {
    $data['title'] .= ' - HP';
    $data['description'] .= ' - HP';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/hp.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/hp.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'donates') {
    $data['title'] .= ' - Донаты';
    $data['description'] .= ' - Донаты';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/donates.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/donates.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'author-rewards') {
    $data['title'] .= ' - Авторские награды';
    $data['description'] .= ' - Авторские награды';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/author_rewards.php`, `ajax_content`, `Следующие 5`, `Предыдущие 5`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/author_rewards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'curation-rewards') {
    $data['title'] .= ' - Кураторские награды';
    $data['description'] .= ' - переводы Кураторские награды';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/curation_rewards.php`, `ajax_content`, `Следующие 5`, `Предыдущие 5`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/curation_rewards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'benefactor-rewards') {
    $data['title'] .= ' - бенефициарские';
    $data['description'] .= ' - Бенефициарские';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/benefactor_rewards.php`, `ajax_content`, `Следующие 5`, `Предыдущие 5`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/benefactor_rewards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'dao') {
    $data['title'] .= ' - ДАО';
    $data['description'] .= ' - ДАО';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/dao.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/dao.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'accounts') {
    $data['title'] .= ' - Аккаунты';
    $data['description'] .= ' - Аккаунты';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/accounts.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/accounts.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'witness') {
    $data['title'] .= ' - Делегат';
    $data['description'] .= ' - Делегат';
    $data['content'] = $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/witness.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'new-posts') {
    $data['title'] .= ' - Новые посты';
    $data['description'] .= ' - Новые посты';
    $data['content'] = $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/blog-posts.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'old-posts') {
    $data['title'] .= ' - Посты, получившие выплаты';
    $data['description'] .= ' - Посты, получившие выплаты';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/posts_with_payment.php`, `ajax_content`, `Следующие 20`, `Предыдущие 20`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/posts_with_payment.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'comments') {
    $data['title'] .= ' - Комментарии';
    $data['description'] .= ' - Комментарии';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/comments.php`, `ajax_content`, `Следующие 20`, `Предыдущие 20`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/comments.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'feed') {
    $data['title'] .= ' - Лента постов подписчиков';
    $data['description'] .= ' - Лента постов подписчиков';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/hive/apps/profiles/page/feed.php`, `ajax_content`, `Следующие 50`, `Предыдущие 50`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/feed.php');
}

}
return $data;
}
$data = generateAppPages($blockchain_snippet);
    ?>