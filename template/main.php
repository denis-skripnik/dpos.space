<?php if (!defined('NOTLOAD')) exit('No direct script access allowed'); ?>

<!DOCTYPE html>
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if lt IE 9]><script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script><![endif]-->
	<title><?= $data['title']; ?> | <?= $conf['siteName']; ?></title>
	<meta name="description" content="<?= $data['description']; ?>">
 <link href="<?= $conf['siteUrl']; ?>template/css/famaly-Rubik.css" rel="stylesheet">
  <link href="<?= $conf['siteUrl']; ?>template/css/normalize.css" rel="stylesheet">
<link href="<?= $conf['siteUrl']; ?>template/css/style.css" rel="stylesheet">
<link rel="icon" type="image/x-icon" href="<?= $conf['siteUrl']; ?>template/images/favicon.ico">
	<script type="text/javascript" src="<?= $conf['siteUrl']; ?>template/js/jquery.min.js"></script>
<script type="text/javascript" src="<?= $conf['siteUrl']; ?>template/js/garlic.min.js"></script>
<link rel="stylesheet" href="<?= $conf['siteUrl']; ?>template/css/jquery.fancybox.min.css" />
<script src="<?= $conf['siteUrl']; ?>template/js/jquery.fancybox.min.js"></script>
<?= ($data['scripts'] ?? $data['scripts'] ?? "") ?>
<?= ($data['styles'] ?? $data['styles'] ?? "") ?>
</head>

<body class="body">
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

<header class="header">
<div class="logo-container">
<?= (!pageUrl() ? '<img class="logo_image" src="'.$conf['siteUrl'].'template/images/logo.jpg" alt="'.$conf['siteName'].'">' : '<a href="'.$conf['siteUrl'].'"><img class="logo_image" src="'.$conf['siteUrl'].'template/images/logo.jpg" alt="'.$conf['siteName'].'"></a>'); ?>
</div>
    <ul class="nav-list hidden">
    <li class="nav-link"><a href="<?= $conf['siteUrl']; ?>" class="nav-item">ГЛАВНАЯ</a></li>
<?= ($data['menu'] ?? $data['menu'] ?? "") ?>
</ul>    
    <div class="tpl_hamburger show" id="sandwichmenu">
          <svg viewBox="0 0 800 600">
              <path d="M300,220 C300,220 520,220 540,220 C740,220 640,540 520,420 C440,340 300,200 300,200" class="top"></path>
              <path d="M300,320 L540,320" class="middle"></path>
              <path d="M300,210 C300,210 520,210 540,210 C740,210 640,530 520,410 C440,330 300,190 300,190" class="bottom" transform="translate(480, 320) scale(1, -1) translate(-480, -318) "></path>
          </svg>
  </div>
    </header>
    <div class="js_menu menu">
  <ul class="nav-list">
  <li class="nav-link"><a href="<?= $conf['siteUrl']; ?>" class="nav-item">Главная</a></li>
<?= ($data['menu'] ?? $data['menu'] ?? "") ?>
</ul>    
</div>
<script>
  $('#sandwichmenu').on('click', function(e) {
      e.preventDefault();
      $('#sandwichmenu').toggleClass("active");
  $('.js_menu').toggleClass("active");
  });
</script>
<main>
<div class="container margin-fix">
<ul class="list">
<?= ($data['breadCrumbs'] ?? $data['breadCrumbs'] ?? ""); ?>
</ul></div>
<div class="container margin-fix">
<h1 class="h1-main"><?= $data['title']; ?></h1>
<?= $data['content']; ?>
<?php if (isset(pageUrl()[0]) && pageUrl()[0] === 'viz') { ?>
    <div id="price_widget"></div>
<script>sendAjax('https://dpos.space/blockchains/viz/vizprice.php', 'price_widget');</script>
<?php } else if (isset(pageUrl()[0]) && pageUrl()[0] === 'golos') { ?>
    <hr>
    <script type="text/javascript" src="https://files.coinmarketcap.com/static/widget/currency.js"></script><div class="coinmarketcap-currency-widget" data-currencyid="4834" data-base="RUB" data-secondary="BTC" data-ticker="true" data-rank="true" data-marketcap="true" data-volume="false" data-statsticker="false" data-stats="USD"></div>
<?php } ?>
</div>
</main>

<footer class="footer">
  <p class="p-footer">© 2020 Dpos.space - Opensource проект для приложений, работающих с блокчейнами.</p>
  <p class="p-footer">Создал данный клиент незрячий программист <span id="creator_login">Денис Скрипник</span>.</p>
  <div class="profile">
    <a href="/viz/profiles/denis-skripnik" class="a-footer">профиль в Viz</a>
    <a href="/minter/profiles/Mxae30a08fae2cc95960c5055d1142fd676995e18b" class="a-footer">Адрес Minter кошелька</a>
    <a href="/golos/profiles/denis-skripnik" class="a-footer">профиль в Golos.</a>
  </div>
  <div class="profile">
    <a href="https://t.me/denis_skripnik" class="profile-social"><img src="<?= $conf['siteUrl']; ?>template/images/telegram.svg" alt="Telegram" width="30" height="30"> </a>
    <a href="https://vk.com/denis_skripnik" class="profile-social"><img src="<?= $conf['siteUrl']; ?>template/images/vk.svg" alt="" width="30" height="30"> </a>
    <a href="https://denis-skripnik.name/contacts" class="profile-social"><img src="<?= $conf['siteUrl']; ?>template/images/global.svg" alt="Обратная связь" width="30" height="30"> </a>
  </div>
</footer>
</body>
</html>