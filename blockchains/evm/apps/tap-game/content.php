<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '
<div>
    <h2>TapGame</h2>

    <!-- Форма для установки реферального кода -->
    <form id="refCodeForm">
        <p><label for="ref_code">Введите код приглашения (Ref Code):</label><br>
        <input type="number" id="ref_code"></p>
        <p><button type="button" onclick="setRefCode()">Установить Ref Code</button></p>
    </form>
<div id="myRefCode"></div>
    <!-- Кнопка для выполнения действия "Тапнуть" -->
    <p><button type="button" onclick="setTap()">Тапнуть (setTap)</button></p>

    <!-- Форма для покупки буста -->
    <form>
        <p><label for="boost_id">Выберите Boost для покупки:</label><br>
        <select id="boost_id">
            <option value="1">Boost 1 - Увеличивает поинты за тап на 0.1</option>
            <option value="2">Boost 2 - Получение поинтов при простое</option>
        </select></p>
        <p><button type="button" onclick="setBoost()">Купить Boost</button></p>
    </form>

    <!-- Кнопки для просмотра поинтов, бустов и топа игроков -->
    <p><button type="button" onclick="getPoints()">Показать мои поинты (getPoints)</button></p>
    <p><button type="button" onclick="getBoosts()">Показать мои Boosts (getBoosts)</button></p>
    <p><button type="button" onclick="getTop()">Топ игроков (getTop)</button></p>

    <!-- Блок для вывода результатов -->
    <div><b>Результат:</b> <pre id="resultLog"></pre></div>
</div>
<h2>Для вопросов и обсуждения</h2>

<p><strong><a href="https://t.me/blind_dev_chat" target="_blank">@blind_dev_chat в Telegram</a></strong></p>
<h2>Донат</h2>
<p>0xaeac266a4533CB0B4255eA2922f997353a18B2E8</p>

<h2>Автор</h2>
<p>Незрячий разработчик Денис Скрипник. Канал: <a href="https://t.me/blind_dev" target="_blank">@blind_dev</a><br>';
?>