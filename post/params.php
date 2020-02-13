<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'post') {
if(!isset($array_url[1] ) ){
$title = "Постингв блокчейны Steem, Golos и WhaleShares $title_domain";
        $meta_keywords = "steem, golos, WhaleShares, клиент, постинг, публикация постов";
        $meta_description = "Сайт, где можно опубликовать посты в Golos, Steem и WhaleShares";
        $h1 = "Публикация постов";
        $description = "<p>Здесь у вас будет возможность опубликовать ваш пост в Golos, Steem и WhaleShares, выполняя минимум действий.</p>";
} else if( isset($array_url[1] ) ){
        $title = "Постинг в блокчейн $chain_name $title_domain";
        $meta_keywords = "steem, golos, WhaleShares, клиент, постинг, публикация поста";
        $meta_description = "Сайт, где можно опубликовать посты в Golos, Steem и WhaleShares";
        $h1 = "Публикация постов";
        $description = "<p>Здесь у вас будет возможность опубликовать ваш пост в Golos, Steem и WhaleShares, выполняя минимум действий.</p>";
}
$footer_text = "Публиковать посты в " . ($chain_name ?? $chain_name ?? "Golos, Steem и WhaleShares.");
$Everywhere_script = '<link rel="stylesheet" href="https://dpos.space/post/static/simplemde.min.css">
<script src="https://dpos.space/post/static/simplemde.min.js"></script>
<script src="https://dpos.space/post/static/sjcl.min.js" type="text/javascript"></script>';

if (($chain ?? $chain ?? "") == 'steem') {
$chain_post = 'steem';
$ChainBrowserFiles = '<script src="https://dpos.space/post/static/steem.min.js"></script>';
} else if (($chain ?? $chain ?? "") == 'viz') {
        $chain_post = 'viz';
        $ChainBrowserFiles = '<script src="https://cdn.jsdelivr.net/npm/viz-js-lib@latest/dist/viz.min.js"></script>';
} else if (($chain ?? $chain ?? "") == 'WLS') {
        $chain_post = 'WLS';
        $ChainBrowserFiles = '<script src="https://cdn.jsdelivr.net/npm/wlsjs-staging@latest/dist/wlsjs.min.js"></script>';
} else if (($chain ?? $chain ?? "") == 'golos') {
$chain_post = 'golos';
$ChainBrowserFiles = '<script src="https://unpkg.com/golos-js@latest/dist/golos.min.js"></script>';
} else {
        $chain_post = '';
        $ChainBrowserFiles = '';
}
$custom_scripts = $ChainBrowserFiles.$Everywhere_script;
} // Конец условия для данного сервиса