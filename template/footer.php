<footer class="footer">
    <p class="footer_text"><?php echo "dpos.space/".($array_url[0] ?? $array_url[0] ?? "")." - это сайт, позволяющий $footer_text"; ?></p>
<p class="footer_text">Создал данный клиент незрячий программист <a href="https://<?php echo ($client ?? $client ?? "golos.io"); ?>/@denis-skripnik" target="_blank"><span id="creator_login">denis-skripnik</span></a>.</p>
<p class="footer_text">Создатель сервиса также является делегатом на Голосе и VIZ. Просьба проголосовать за <strong>denis-skripnik</strong> тут: <a href="https://golos.io/~witnesses" target="_blank">https://golos.io/~witnesses</a> и тут: <a href="https://viz.world/witnesses/denis-skripnik/" target="_blank">https://viz.world/witnesses/denis-skripnik/</a></p>
<?php
if ( isset($_SESSION['user_name']) and isset($_SESSION['chain_name']) ){
echo '<blockquote>«Флотилия Мегагальян» просит неравнодушных оказать Денису посильную поддержку.</blockquote>
<p align="center"><button id="userButton">Скопировать логин автора сервисов</button></p>
<p align="center">Перейти к вашему кошельку:</p>
<ul><li><a href="https://golos.io/@'.$_SESSION['user_name'].'/transfers" target="_blank">Golos</a></li>
<li><a href="https://steemit.com/@'.$_SESSION['user_name'].'/transfers" target="_blank">Steemit</a></li>
<li><a href="https://waleshares.io/@'.$_SESSION['user_name'].'/transfers" target="_blank">Whaleshares</a></li>
<li><a href="https://viz.world/wallet/" target="_blank">Viz</a></li></ul>';
echo "<script>
//цепляем событие на onclick кнопки
var button = document.getElementById('userButton');
button.addEventListener('click', function () {
  //нашли наш контейнер
  var ta = document.getElementById('creator_login'); 
  //производим его выделение
  var range = document.createRange();
  range.selectNode(ta); 
  window.getSelection().addRange(range); 
 
  //пытаемся скопировать текст в буфер обмена
  try { 
    document.execCommand('copy'); 
  } catch(err) { 
    console.log('Can`t copy, boss'); 
  } 
  //очистим выделение текста, чтобы пользователь не парился
  window.getSelection().removeAllRanges();
});
</script>";
}
?>
</footer>

</div>
</body></html>