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
<table><tr><th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'">Основное</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/transfers">Переводы средств</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/shares">Соц. капитал</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/dao">ДАО</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/awards">Отправленные награды</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/receive-awards">Полученные награды</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/benefactor-awards">Бенефициарские</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/accounts">Аккаунты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/subscriptions">Платные подписки</a></th>
<th><a href="'.$conf['siteUrl'].'viz/profiles/'.$user.'/witness">Делегат</a></th>
</tr></table>
<p align="center"><strong><a data-fancybox data-type="ajax" data-src="'.$conf['siteUrl'].'blockchains/viz/apps/profiles/award_modal/ajax.php?target='.$user.'&pageUrl='.$conf['siteUrl'].'viz/profiles/'.$user.'" href="javascript:;">Наградить пользователя</a></strong></p>
<p id="change_profile_link" align="center"><strong><a href="'.$conf['siteUrl'].'viz/manage/profile" target="_blank">Изменить профиль</a></strong></p>
<script>
let url = document.location.pathname;
if (url.indexOf(viz_login) > -1) {
$(`#change_profile_link`).css(`display`, `block`);
    } else {
        $(`#change_profile_link`).css(`display`, `none`);
    }
        </script>';
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
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/transfers.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
$data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/transfers.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'shares') {
    $data['title'] .= ' - Соц. капитал';
    $data['description'] .= ' - Соц. капитал';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/shares.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/shares.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'awards') {
    $data['title'] .= ' - История наград';
    $data['description'] .= ' - История наград';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/awards.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/awards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'receive-awards') {
    $data['title'] .= ' - Полученные награды';
    $data['description'] .= ' - переводы Полученные награды';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/receive_awards.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/receive_awards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'benefactor-awards') {
    $data['title'] .= ' - бенефициарские';
    $data['description'] .= ' - Бенефициарские';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/benefactor_awards.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/benefactor_awards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'dao') {
    $data['title'] .= ' - ДАО';
    $data['description'] .= ' - ДАО';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/dao.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/accounts.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/accounts.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'subscriptions') {
    $data['title'] .= ' - Платные подписки';
    $data['description'] .= ' - Платные подписки';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/viz/apps/profiles/page/subscriptions.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/subscriptions.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'witness') {
    $data['title'] .= ' - Делегат';
    $data['description'] .= ' - Делегат';
    $data['content'] = $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/witness.php');
}

}
return $data;
}
$data = generateAppPages($blockchain_snippet);
    ?>