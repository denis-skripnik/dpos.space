<h2>Введите в поле ниже логин любого пользователя <?php echo $chain_name; ?>:</h2>
<form method = "post" action = "">
  <input type = "hidden" name = "service" value = "<?php echo $array_url[0]; ?>">
  <label for = "user">Введите логин в <?php echo $chain_name; ?> без @:</label>
  <input type = "text" name = "user" value = "<?php echo $array_url[1]; ?>">
  <input type = "hidden" name = "chain" value = "<?php echo $chain; ?>">
  <input type = "submit" value = "узнать инфу"/>
</form>
<h2>Выберите интересующий вас пункт ниже, чтобы появилась нужная информация о пользователе</h2>
<div id = "tab_block">
  <ul id = "tabs">
        <li id = "tab1" class = "tab" onclick = "funcTab(1);">Информация об аккаунте</li>
    <li id = "tab2" class = "tab" onclick = "funcTab(2);">Переводы</li>
    <?php if ($chain != 'viz') { ?>
    <li id = "tab3" class = "tab" onclick = "funcTab(3);">Авторские награды</li>
<li id = "tab4" class = "tab" onclick = "funcTab(4);">Кураторские награды</li>
<?php } else { ?>
  <li id = "tab3" class = "tab" onclick = "funcTab(3);">Полученные награды</li>
<?php } ?>
<li id = "tab5" class = "tab" onclick = "funcTab(5);">Бенефициарские вознаграждения</li>
        <li id = "tab6" class = "tab" onclick = "funcTab(6);">Подписчики с информацией о каждом</li>
    <li id = "tab7" class = "tab" onclick = "funcTab(7);">Делегатство</li>
    <?php if ($chain != 'viz') { ?>
    <li id = "tab8" class = "tab" onclick = "funcTab(8);">Комментарии</li>
    <?php }
                        if ($chain == 'golos') { ?>
        <li id = "tab9" class = "tab" onclick = "funcTab(9);">Уведомления от @robot</li>
      <?php }
if ($chain != 'viz') { ?>
    <li id = "tab10" class = "tab" onclick = "funcTab(10);">Свежие посты</li>
    <li id = "tab11" class = "tab" onclick = "funcTab(11)">Посты, получившие выплаты</li>
<?php } ?>
  </ul>
  <div id = "tabs_content">
    <div class = "tab_content active" id = "tab_content1"></div>
    <div class = "tab_content" id = "tab_content2">
    </div>
    <div class = "tab_content" id = "tab_content3">
    </div>
    <div class = "tab_content" id = "tab_content4">
    </div>
    <div class = "tab_content" id = "tab_content5">
    </div>
    <div class = "tab_content" id = "tab_content6">
    </div>
    <div class = "tab_content" id = "tab_content7">
    </div>
    <div class = "tab_content" id = "tab_content8">
    </div>
    <div class = "tab_content" id = "tab_content9">
    </div>
    <div class = "tab_content" id = "tab_content10">
    </div>
    <div class = "tab_content" id = "tab_content11">
    </div>
	</div>
</div>
<script type = "text/javascript">
  var numberOfTab = localStorage.getItem('number');
  if (numberOfTab) {
    funcTab(numberOfTab);
  } else {
    localStorage.setItem('number', 1);
  }
  ;

  function funcTab(n) {
    var NTab = document.getElementsByClassName('tab').length;
    for (var i = 1; i < NTab + 1; i++) {
      if (i != n) {
        var tabElement = document.getElementById('tab' + i);
        var tabContentElement = document.getElementById('tab_content' + i);

        if (tabElement) {
          tabElement.className = 'tab';
        }
        if (tabContentElement) {
          tabContentElement.className = 'tab_content';
        }
      }
    }
    document.getElementById('tab' + n).className = 'tab active';
    document.getElementById('tab_content' + n).className = 'tab_content active';
    localStorage.setItem('number', n);
  }
</script>