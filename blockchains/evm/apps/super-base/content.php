<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '
<div>
  <h2>Добавить сообщение</h2>
  <form>
    <p><label for="amount">Сумма в SUPERBASE</label><br>
        <input type="number" min="1" id="amount" step="0.00000000000000000001"></p>
        <!-- Отображение баланса -->
    <div>
        <strong>Баланс SUPERBASE:</strong> <span id="maxBalance">0</span>
    </div>
        <p><label for="message">Текст сообщения</label><br>
        <textarea id="message"></textarea></p>
    <p>
      <input type="button" id="addMessage" value="Добавить">
    </p>
  </form>
</div>

<div>
  <h2>Ваши сообщения</h2>
  <table border="1"><thead>
    <tr>
      <th>Адрес</th>
      <th>Сумма</th>
      <th>IPFS-хеш</th>
      <th>Текст</th>
      </tr></thead>
    <tbody id="userMessagesTable"></tbody>
  </table>
</div>

<div>
  <h2>Сообщения всех пользователей</h2>
  <table border="1"><thead>
    <tr>
      <th>Адрес</th>
      <th>Сумма</th>
      <th>IPFS-хеш</th>
      <th>Текст</th>
    </tr></thead>
    <tbody id="allMessagesTable"></tbody>
  </table>
</div>';
?>