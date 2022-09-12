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
<p>Выберите страницу в выпадающем списке и нажмите на кнопку "открыть".</p>
<form class="form" method="post">
<input type="hidden" name="chain" value="golos">
<input type="hidden" name="service" value="profiles">
<input type="hidden" name="user" value="'.$user.'">
<p><label for="page">Страница:<br>
<select name="page">
<option value="">Основное</option>
<option value="transfers">Переводы средств</option>
<option value="gp">Сила Голоса</option>
<option value="dao">ДАО</option>
<option value="donates">Донаты</option>
<option value="author-rewards">Авторские награды</option>
<option value="curation-rewards">Кураторские награды</option>
<option value="benefactor-rewards">Бенефициарские награды</option>
<option value="mentioned">Упоминания</option>
<option value="votes">Апвоты и флаги</option>
<option value="reputation">Изменения репутации</option>
<option value="accounts">Аккаунты</option>
<option value="new-posts">Новые посты</option>
<option value="old-posts">Получившие выплаты посты</option>
<option value="feed">Посты подписок</option>
<option value="comments">Комментарии</option>
<option value="witness">Делегат</option>
<option value="orders">Ордера на dex</option>
</select></label></p>
<p><input type="submit" value="Открыть"></p>
</form>
<p align="center"><strong><a data-fancybox data-src="#donate_modal_content" href="javascript:;">Донат</a></strong></p>
';
$pages .= file_get_contents($conf['siteUrl'].'blockchains/golos/apps/profiles/donate.php');
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/transfers.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
$data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/transfers.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'gp') {
    $data['title'] .= ' - СГ';
    $data['description'] .= ' - Сила Голоса';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/gp.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/gp.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'donates') {
    $data['title'] .= ' - Донаты';
    $data['description'] .= ' - Донаты';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/donates.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/author_rewards.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/curation_rewards.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/benefactor_rewards.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/benefactor_rewards.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'mentioned') {
    $data['title'] .= ' - упоминания';
    $data['description'] .= ' - упоминания';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/comment_mention.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/comment_mention.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'votes') {
    $data['title'] .= ' - Апвоты и флаги';
    $data['description'] .= ' - Апвоты и флаги';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/votes.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/votes.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'reputation') {
    $data['title'] .= ' - Изменения репутации';
    $data['description'] .= ' - Изменения репутации';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/reputation.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/reputation.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'dao') {
    $data['title'] .= ' - ДАО';
    $data['description'] .= ' - ДАО';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/dao.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/accounts.php`, `transfers_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/posts_with_payment.php`, `ajax_content`, `Следующие 20`, `Предыдущие 20`)(START_MODE)
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
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/comments.php`, `ajax_content`, `Следующие 20`, `Предыдущие 20`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/comments.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'feed') {
    $data['title'] .= ' - Лента постов подписок';
    $data['description'] .= ' - Лента постов подписок';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/feed.php`, `ajax_content`, `Следующие 50`, `Предыдущие 50`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/feed.php');
} else if (isset(pageUrl()[3]) && pageUrl()[3] == 'orders') {
    $data['title'] .= ' - ордера на dex';
    $data['description'] .= ' - ордера на dex';
    $data['content'] = '<script>
    ajax_options.user = `'.$user.'`;
    ajax_options.siteUrl = `'.$conf['siteUrl'].'`;
    getLoad(`'.$conf['siteUrl'].'blockchains/golos/apps/profiles/page/orders.php`, `ajax_content`, `Следующие 10`, `Предыдущие 10`)(START_MODE)
    </script>';
    $data['content'] .= $blockchain_snippet;
    $data['content'] .= $pages;
$data['content'] .= require_once(__DIR__.'/page/orders.php');
}

}
return $data;
}
$data = generateAppPages($blockchain_snippet);
    ?>