<!DOCTYPE html>
<html id="service_pages">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
	<!--[if lt IE 9]><script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script><![endif]-->
	<title><?php echo $title; ?></title>
	<meta name="keywords" content="<?php echo $meta_keywords; ?>">
	<meta name="description" content="<?php echo $meta_description; ?>">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <link href="<?php echo $siteurl; ?>template/css/famaly-Rubik.css" rel="stylesheet">
 <link href="<?php echo $siteurl; ?>template/css/normalize.css" rel="stylesheet">
<link href="<?php echo $siteurl; ?>template/css/style.min.css" rel="stylesheet">
<link rel="icon" type="image/x-icon" href="https://dpos.space/template/favicon.ico">
	<script type="text/javascript" src="<?= $siteurl ?>template/js/libs/jquery.min.js"></script>
  <script async type="text/javascript" src="<?= $siteurl ?>profiles/js/index.js"></script>
<?= ($custom_scripts ?? $custom_scripts ?? "") ?>
<script type="text/javascript" src="<?= $siteurl ?>template/js/libs/garlic.min.js"></script>
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
<?php

if (($array_url[0] ?? $array_url[0] ?? "") == 'tags') {

} else {
echo '<input type="button" id="chains1" value="Steem" />
<input type="button" id="chains2" value="Golos" />
<input type="button" id="chains3" value="Viz" />
<input type="button" id="chains4" value="WhaleShares" />';
}
?>
<h1><?php echo $h1; ?></h1>
<div><?php echo $description; ?></div>
	</header>
