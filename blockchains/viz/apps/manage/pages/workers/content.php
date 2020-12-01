<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Воркеры</th>
<th><a href="'.$conf['siteUrl'].'viz/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/create-account">Создать аккаунт/субаккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/many-invites">Множество инвайтов (чеков)</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/multisig">Мультисиг</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Фонд комитета <span id="committee_fund"></span></h2>
<p align="center"><a data-fancybox data-src="#create_committee_request" href="javascript:;">Создать заявку</a></p>
<div style="display: none;" id="create_committee_request">
<h4 class="modal-title">Создание заявки воркера в комитет</h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
<p><label for="request_url">Url заявки: 
<input type="url" name="request_url" placeholder="https://"></label></p>
<p><label for="request_account">Аккаунт исполнителя (получатель токенов): 
<input type="text" name="request_account" value="" placeholder="Введите аккаунт"></label></p>
<p><label for="request_min_amount">Минимальная сумма токенов: 
    <input type="number" name="request_min_amount" min="0" value="" placeholder="Минимальная сумма токенов" title="Используйте числовой формат" pattern="^[0-9]+$"></label></p>
    <p><label for="request_max_amount">Максимальная сумма токенов: 
        <input type="number" name="request_max_amount" value="" placeholder="Максимальная сумма токенов" title="Используйте числовой формат" max="500000" pattern="^[0-9]+$"></label></p>
        <p><label for="request_days">Длительность заявки в днях: 
            <input type="text" name="request_days" value="5" data-fixed="request_days"> <input type="range" name="request_days" data-fixed="request_days" value="5" min="5" max="30"></p>
        <p><input type="button" id="create_request_now" value="Создать"></p>
</form>
</div>

<div style="display: none;" id="committee_request">
<h3 class="modal-title">Заявка №<span id="committee_request_id"></span></h3>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<div id="request_content">
<h4>Информация о заявке</h4>
<ul><li>Статус: <span id="request_status"></span></li>
<li>Создал заявку <span id="request_creator"></span>, а получит токены <span id="request_worker"></span></li>
<li>Ссылка о заявке: <span id="request_link"></span></li>
<li>Минимальная сумма удовлетворения заявки: <span id="request_min"></span>, а максимальная - <span id="request_max"></span></li>
<li>Время начала заявки: <span id="request_start_time"></span>, а окончания - <span id="request_end_time"></span> (<span id="request_duration"></span> дней)</li>
<li id="if_status_12345">Время принятия решения: <span id="request_conclusion_time"></span></li>
<li id="if_status345">Согласованная сумма <span id="request_conclusion_payout_amount"></span></li>
<li id="if_status45">Выплачено <span id="request_payout_amount"></span></li>
<li id="if_status4">Осталось выплатить <span id="request_remain_payout_amount"></span>, время последней выплаты: <span id="request_last_payout_time"></span></li>
</ul>
<div id="if_request_status_0">
<h4>Голосование по заявке</h4>
<form>
<input type="hidden" name="vote_request_id" value="">
<p><label for="request_percent">Процент от максимальной суммы заявки: 
    <input type="text" name="request_percent" value=100" data-fixed="request_percent"> <input type="range" name="request_percent" data-fixed="request_percent" value="100" min="-100" max="100"></p>
<p><input type="button" id="submit_request_vote" value="Голосовать"></p>
    </form>
</div>
<h4>Список голосов</h4>
<ul id="request_votes"></ul>
</div>
</div>

<h2 class="tt" onclick="spoiler(`committee_list_0`); return false">Ожидающие рассмотрения</h2>
<div id="committee_list_0" class="terms">
<ul id="committee_requests_0"></ul>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_1`); return false">Отменённые создателем</h2>
<div id="committee_list_1" class="terms" style="display: none;">
<ul id="committee_requests_1"></ul>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_2`); return false">Отказ (недостаток голосов)</h2>
<div id="committee_list_2" class="terms" style="display: none;">
<ul id="committee_requests_2"></ul>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_3`); return false">Отказ (итоговая сумма вне диапазона)</h2>
<div id="committee_list_3" class="terms" style="display: none;">
<ul id="committee_requests_3"></ul>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_4`); return false">Принята (идут выплаты)</h2>
<div id="committee_list_4" class="terms" style="display: none;">
<ul id="committee_requests_4"></ul>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_5`); return false">Завершённые</h2>
<div id="committee_list_5" class="terms" style="display: none;">
<ul id="committee_requests_5"></ul>
</div>

</div>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/manage/pages/workers/footer.js"></script>
'; ?>