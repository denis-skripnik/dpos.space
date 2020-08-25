<?php if (!defined('NOTLOAD')) exit('No direct script access allowed'); ?>

<!DOCTYPE html>
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
	<!--[if lt IE 9]><script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script><![endif]-->
	<title><?= $data['title']; ?> | <?= $conf['siteName']; ?></title>
	<meta name="description" content="<?= $data['description']; ?>">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <link href="<?= $conf['siteUrl']; ?>template/css/famaly-Rubik.css" rel="stylesheet">
 <link href="<?= $conf['siteUrl']; ?>template/css/normalize.css" rel="stylesheet">
<link href="<?= $conf['siteUrl']; ?>template/css/style.min.css" rel="stylesheet">
<link rel="icon" type="image/x-icon" href="<?= $conf['siteUrl']; ?>template/images/favicon.ico">
	<script type="text/javascript" src="<?= $conf['siteUrl']; ?>template/js/jquery.min.js"></script>
<script type="text/javascript" src="<?= $conf['siteUrl']; ?>template/js/garlic.min.js"></script>
<link rel="stylesheet" href="<?= $conf['siteUrl']; ?>template/css/jquery.fancybox.min.css" />
<script src="<?= $conf['siteUrl']; ?>template/js/jquery.fancybox.min.js"></script>
<?= ($data['scripts'] ?? $data['scripts'] ?? "") ?>
<?= ($data['styles'] ?? $data['styles'] ?? "") ?>
</head>

<body>
<!-- Yandex.Metrika counter -->
<script type="text/javascript" >
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(54190501, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/54190501" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
<div class="wrapper">

	<header class="header">
<div align="center"><?= (!pageUrl() ? '<img src="'.$conf['siteUrl'].'template/images/logo.jpg" alt="'.$conf['siteName'].'">' : '<a href="'.$conf['siteUrl'].'"><img src="'.$conf['siteUrl'].'template/images/logo.jpg" alt="'.$conf['siteName'].'"></a>'); ?>
</div>
    <div><?= $conf['siteDescription']; ?></div>
    </header>
    <nav id="menu">
<ul><li><a href="<?= $conf['siteUrl']; ?>">Главная</a></li>
<?= ($data['menu'] ?? $data['menu'] ?? "") ?>
</ul></nav>
<main class="content">
<div id="bread_crumbs"><ul><?= ($data['breadCrumbs'] ?? $data['breadCrumbs'] ?? ""); ?>
</ul></div>
<h1><?= $data['title']; ?></h1>
<?= $data['content']; ?>
<?php if (isset(pageUrl()[0]) && pageUrl()[0] === 'viz') { ?>
    <div id="price_widget"></div>
<script>sendAjax('https://dpos.space/blockchains/viz/vizprice.php', 'price_widget');</script>
<?php } ?>
</main>
<footer class="footer">
    <p class="footer_text">© 2020 Dpos.space - Opensource проект для приложений, работающих с блокчейнами.</p>
<p class="footer_text">Создал данный клиент незрячий программист <span id="creator_login">Денис Скрипник</span>.  <a href="/viz/profiles/denis-skripnik" target="_blank">профиль в Viz</a>, <a href="/golos/profiles/denis-skripnik" target="_blank">профиль в Golos</a>.</p>
<h4>Контакты</h4>
<ul><li>Telegram <a href="https://t.me/denis_skripnik" target="_blank">@denis_skripnik</a></li>
<li>Вконтакте <a href="https://vk.com/denis_skripnik" target="_blank">@denis_skripnik</a></li>
<li>Обратная связь <a href="https://denis-skripnik.name/contact" target="_blank">Написать</a></li>
</footer>

</div>
</body></html>