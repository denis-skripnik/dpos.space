<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Выберите страницу</h2>
<table><tr><th><a href="'.$conf['siteUrl'].'golos/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/workers">Заявки воркеров</a></th><th><a href="'.$conf['siteUrl'].'golos/manage/subscribes">Подписки</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/create-account">Создать аккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/multisig">Мультисиг</a></th>
</tr></table>
<h2>Управление блокчейном и профилем</h2>
<h3>Профиль</h3>
<ul><li>Возможность изменения своего имени, аватарки, обложки, сайта</li>
<li>Указания аккаунтов в соцсетях и e-mail;</li>
<li>Возможность указания страны и города, пола и дня рождения</li></ul>
<h3>Управление блокчейном - делегаты</h3>
<p>Это пользователи, которые подписывают блоки и получают за это вознаграждение. Пользователи, которые устанавливают параметры сети.</p>
<p>Голосование - это ответственный процесс, т.к. от них зависит многое. Но если вы не желаете париться с выбором делегатов, сможете установить какой-то аккаунт в качестве прокси.</p>
<h3>Управление блокчейном - воркеры</h3>
<p>Для развития блокчейна (разработки, маркетинга и т.п.) нужны люди, которые этим готовы заниматься. Голосование за их заявки - это тоже довольно важное дело.</p>
'; ?>