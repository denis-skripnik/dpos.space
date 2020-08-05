<!DOCTYPE html>
<html id="service_pages">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
	<!--[if lt IE 9]><script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script><![endif]-->
	<title>Ошибка 404: страница не существует</title>
	<meta name="description" content="Страница по указанному url не найдена.">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <link href="<?= $conf['siteUrl']; ?>template/css/famaly-Rubik.css" rel="stylesheet">
 <link href="<?= $conf['siteUrl']; ?>template/css/normalize.css" rel="stylesheet">
<link href="<?= $conf['siteUrl']; ?>template/css/style.min.css" rel="stylesheet">
<link rel="icon" type="image/x-icon" href="<?= $conf['siteUrl']; ?>template/images/favicon.ico">
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
<h1>Ошибка 404: страница не существует</h1>
<h2>Вероятно, вы ошиблись адресом страницы или данные были удалены.</h2>
<p>Проверьте url или перейдите на главную.</p>
</main>
<footer class="footer">
    <h2>Буду благодарен за донаты</h2>
    <p><iframe src="https://widget.donatepay.ru/widgets/page/a52d41b637e51e5dcc33ddeb44979dfe231e93a9d90d9c23a87a7a89f38d3455?widget_id=1368700" width="510" height="220" frameBorder="0"></iframe></p>
    <p class="footer_text">© 2020 Dpos.space - Opensource проект для приложений, работающих с блокчейнами.</p>
<p class="footer_text">Создал данный клиент незрячий программист <a href="/viz/profiles/denis-skripnik" target="_blank"><span id="creator_login">Денис Скрипник</span></a>.</p>
</footer>

</div>
</body></html>