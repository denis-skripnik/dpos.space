<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'cyber/accounts" target="_blank">здесь</a></p></div>                        
                        <div id="seed_page">
<p>Эта страница предназначена для получения данных об аккаунте: приватного ключа и адреса. Это нужно для импортирования в другие кошельки, например, Кеплер.</p>
<p><strong>Не показывайте страницу посторонним.</strong></p>
                        <ul><li>Адрес:<br>
<span id="address"></span></li>
<li>Приватный ключ:<br>
<span id="private_key"></span></li></ul>
                        </div>
'; ?>