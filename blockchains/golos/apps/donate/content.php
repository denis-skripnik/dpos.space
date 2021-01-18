<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  global $conf;
    $url = pageUrl();
  $content = '<h2>Донат<span class="token"></span></h2>
<form action="/" method="post">
<input type="hidden" name="chain" value="golos">
<input type="hidden" name="service" value="donate">';
if (isset($url[2])) {
$content .= '<input type="hidden" name="user" value="'.$url[2].'">';
$data['title'] .= ' пользователю '.$url[2];  
} else {
    $content .= '<p><label for="user">Кому: <br>
<input type="text" name="user" value="" placeholder="Получатель доната"></label></p>';
  }
  if (isset($url[3])) {
    $content .= '<input type="hidden" name="token" value="'.$url[3].'">';
    } else {
        $content .= '<p><label for="token">Способ доната: <br>
<select name="token"></select></label></p>';
      }
if (isset($url[4])) {
  $content .= '<p><label for="amount">Сумма: <br>
  <input type="text" name="amount" value="'.$url[4].'" placeholder="Сумма доната"></label></p>';
$data['title'] .= ' на '.$url[4].' '.$url[3];
} else {
    $content .= '<p><label for="amount">Сумма: <br>
<input type="text" name="amount" value="" placeholder="Сумма доната"></label></p>';
  }
  $content .= '<p></strong><input type="submit" value="Отправить"></strong></p>
</form>';
if (isset($url[4])) {
  $content .= '<hr>
  <p><a href="'.$conf['siteUrl'].'golos/donate/'.$url[2].'">К выбору токена</a></p>
<div id="deposit_without_golos" style="display: none;"><hr>
  <h2>Донат без авторизации</h2>
  <ul><li>Кому: '.$url[2].'</li>
  <li>сумма: '.$url[4].' <span class="token"></li></ul>
  <div id="uia_diposit_data"></div>
  <hr></div>
<div id="auth_msg" style="display: none;"><hr>
<p>Если вы хотите отправить донат при помощи Golos blockchain, необходимо авторизоваться <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Донат при помощи Golos blockchain</h2>
<ul><li>Кому: '.$url[2].'</li>
<li>сумма: '.$url[4].' '.$url[3].'</li>
<li>TIP-баланс: <span id="tip_balance"></span></li></ul>
<p><strong><button type="button" id="donate_action">Отправить донат</button></strong></p>
</div>';
}
$content .= '<hr>
<h2>Ссылка на страницу</h2>
<p>Вы можете её использовать на сайте:</p>
<p><textarea readonly id="this_page_url"><a href="'.((!empty($_SERVER['HTTPS'])) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'].'" target="_blank">Донат</a></textarea>
<input type="button" onclick="copyText(`this_page_url`)" value="Копировать в буфер обмена"></p>
';
return $content;
?>