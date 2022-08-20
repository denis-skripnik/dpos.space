<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
$page = pageUrl();
$title_text = '';
if (isset($page[0])) $title_text .= $page[0].' | ';
if (isset($page[0]) && !isset($page[1])) {
  $title_text .= 'Страница блокчейна';
} else if (isset($page[0]) && isset($page[1])) {
  $title_text .= $data['title'];
} else if (!isset($page[0])) {
  $title_text = 'Главная';
}
?>

<!DOCTYPE html>
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if lt IE 9]><script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script><![endif]-->
	<title><?= $title_text; ?> | <?= $conf['siteName']; ?></title>
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
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=
GTM-W7BPJPZ"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<header class="header">
<div class="logo-container">
<?= (!pageUrl() ? '<img class="logo_image" src="'.$conf['siteUrl'].'template/images/logo.png" alt="'.$conf['siteName'].'">' : '<a href="'.$conf['siteUrl'].'"><img class="logo_image" src="'.$conf['siteUrl'].'template/images/logo.png" alt="'.$conf['siteName'].'"></a>'); ?>
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
    <div class="footer_row">
        <div  class="footer_item" >
           
              <p><a href="/viz/profiles/denis-skripnik" class="a-footer">Профиль в Viz</a></p>
              <p><a href="/minter/profiles/Mxf85ceccfe2112e88be58162c43f5ec959672ab54" class="a-footer">Адрес Minter кошелька</a></p>
              <p><a href="/decimal/profiles/dx18a46ny5gq7pjhejap8xaahmjwmzgwan92ag2wq" class="a-footer">Адрес Decimal кошелька</a></p>
              <p><a href="/golos/profiles/denis-skripnik" class="a-footer">Профиль в Golos.</a></p>
        </div> 

        <div  class="footer_item">
          <div  class="container margin-fix">
            <p class="p-footer"> © 2020 Dpos.space - Создал данный клиент незрячий программист <span id="creator_login">Денис Скрипник</span>.</p>
            <div class="profile">
              <a href="https://t.me/denis_skripnik" class="profile-social" target="_blank"><img src="<?= $conf['siteUrl']; ?>template/images/telegram.png" alt="Telegram" class="profile-social-item"> </a>
              <a href="https://vk.com/denis_skripnik" class="profile-social" target="_blank"><img src="<?= $conf['siteUrl']; ?>template/images/vk.png" alt="" class="profile-social-item"> </a>
              <a href="https://denis-skripnik.name/contact" class="profile-social" target="_blank"><img src="<?= $conf['siteUrl']; ?>template/images/personal_website.png" alt="Обратная связь" class="profile-social-item"> </a>
            </div> 
          </div> 
        </div>  

        <div  class="footer_item">
          <div id="ytWidget" align="right"></div>
          <script src="https://translate.yandex.net/website-widget/v1/widget.js?widgetId=ytWidget&pageLang=ru&widgetTheme=light&autoMode=true" type="text/javascript"></script>
        </div> 

    </div>


</footer>
</body>
</html>