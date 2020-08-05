<?php return '
<h2>Страницы сервиса</h2>
<table><tr><th>Воркеры</th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'golos/manage/profile">Профиль</a></th><th><a href="'.$conf['siteUrl'].'golos/manage/subscribes">Подписки</a></th>
</tr></table>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Фонд комитета <span id="committee_fund"></span></h2>
<p align="center"><a data-fancybox data-src="#create_committee_request" href="javascript:;">Создать заявку</a></p>
<div style="display: none;" id="create_committee_request">
<h4 class="modal-title">Создание заявки воркера в комитет</h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
<p><label for="request_url">Url заявки: 
<input type="url" name="request_url" placeholder="https://golos.id/@author/permlink"></label></p>
<p><label for="request_account">Аккаунт исполнителя (получатель токенов): 
<input type="text" name="request_account" value="" placeholder="Введите аккаунт"></label></p>
<p><label for="request_min_amount">Минимальная сумма токенов: 
    <input type="number" name="request_min_amount" min="0" value="" placeholder="Минимальная сумма токенов" title="Используйте числовой формат" pattern="^[0-9]+$"></label></p>
    <p><label for="request_max_amount">Максимальная сумма токенов: 
        <input type="number" name="request_max_amount" value="" placeholder="Максимальная сумма токенов" title="Используйте числовой формат" pattern="^[0-9]+$"></label></p>
<p><label for="create_request_token">Токен: 
<select name="create_request_token">
<option value="GOLOS">GOLOS</option>
<option value="GBG">GBG</option>
</select></label></p>
        <p><label for="request_days">Длительность заявки в днях: 
            <input type="text" name="request_days" value="5" data-fixed="request_days"> <input type="range" name="request_days" data-fixed="request_days" value="5" min="5" max="30"></p>
        <p><label for="create_request_vest_reward">Перевод выплаты в Силу Голоса
<input type="checkbox" name="create_request_vest_reward"></label></p>
            <p><input type="button" id="create_request_now" value="Создать"></p>
</form>
</div>

<div style="display: none;" id="committee_request">
<h3 class="modal-title">Заявка: <span id="committee_request_title"></span></h3>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<div id="request_content">
<h4>Информация о заявке</h4>
<ul><li>Статус: <span id="request_status"></span></li>
<li>Создал заявку <span id="request_creator"></span>, а получит токены <span id="request_worker"></span></li>
<li>Ссылка о заявке: <span id="request_link"></span></li>
<li>Минимальная сумма удовлетворения заявки: <span id="request_min"></span>, а максимальная - <span id="request_max"></span></li>
<li>Время начала заявки: <span id="request_start_time"></span>, а окончания - <span id="request_end_time"></span> (<span id="request_duration"></span> дней)</li>
<li>Перевод выплаты в СГ: <span id="request_vest_reward"></span></li>
<li id="if_status45">Выплачено <span id="request_payout_amount"></span></li>
<li id="if_status4">Осталось выплатить <span id="request_remain_payout_amount"></span></li>
</ul>
<div id="if_request_status_created">
<h4>Голосование по заявке</h4>
<form>
<input type="hidden" name="vote_request_author" value="">
<input type="hidden" name="vote_request_permlink" value="">
<p><label for="request_percent">Процент от максимальной суммы заявки: 
    <input type="text" name="request_percent" value=100" data-fixed="request_percent"> <input type="range" name="request_percent" data-fixed="request_percent" value="100" min="-100" max="100"></p>
<p><input type="button" id="submit_request_vote" value="Голосовать"></p>
    </form>
</div>
<h4>Список голосов (топ 100)</h4>
<ol id="request_votes"></ol>
</div>
</div>

<h2 class="tt" onclick="spoiler(`committee_list_created`); return false">Голосование</h2>
<div id="committee_list_created" class="terms">
<table><thead><tr><th>Заявка</th><th>автор</th><th>воркер</th><th>Статус</th><th>Дата завершения голосования</th></tr></thead><tbody id="committee_requests_created"></tbody></table>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_payment`); return false">Выплачиваются</h2>
<div id="committee_list_payment" class="terms" style="display: none;">
<table><thead><tr><th>Заявка</th><th>автор</th><th>воркер</th><th>Статус</th><th>Дата завершения голосования</th></tr></thead><tbody id="committee_requests_payment"></tbody></table>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_payment_complete`); return false">Заявки, по которым прошли выплаты</h2>
<div id="committee_list_payment_complete" class="terms" style="display: none;">
<table><thead><tr><th>Заявка</th><th>автор</th><th>воркер</th><th>Статус</th><th>Дата завершения голосования</th></tr></thead><tbody id="committee_requests_payment_complete"></tbody></table>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_closed_by_author`); return false">Отменённые автором</h2>
<div id="committee_list_closed_by_author" class="terms" style="display: none;">
<table><thead><tr><th>Заявка</th><th>автор</th><th>воркер</th><th>Статус</th><th>Дата завершения голосования</th></tr></thead><tbody id="committee_requests_closed_by_author"></tbody></table>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_closed_by_expiration`); return false">Отменённые по времени (не набрали % для прохода)</h2>
<div id="committee_list_closed_by_expiration" class="terms" style="display: none;">
<table><thead><tr><th>Заявка</th><th>автор</th><th>воркер</th><th>Статус</th><th>Дата завершения голосования</th></tr></thead><tbody id="committee_requests_closed_by_expiration"></tbody></table>
</div>
<h2 class="tt" onclick="spoiler(`committee_list_closed_by_voters`); return false">Отменённые по голосам (заминусовали)</h2>
<div id="committee_list_closed_by_voters" class="terms" style="display: none;">
<table><thead><tr><th>Заявка</th><th>автор</th><th>воркер</th><th>Статус</th><th>Дата завершения голосования</th></tr></thead><tbody id="committee_requests_closed_by_voters"></tbody></table>
</div>

</div>
<script src="'.$conf['siteUrl'].'blockchains/golos/apps/manage/pages/workers/footer.js"></script>
'; ?>