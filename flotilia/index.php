<?php
$_SERVER['DOCUMENT_ROOT'] = '/home/s/scadens/dpos.space/public_html/flotilia';


ini_set('session.gc_maxlifetime', 120000009600);
ini_set('session.cookie_lifetime', 120000009600);
@session_start();

function gp_sort($x, $y) {
    if ($x['golos_power'] < $y['golos_power']) {
        return true;
    } else if ($x['golos_power'] > $y['golos_power']) {
        return false;
    } else {
        return 0;
    }
}
?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8" />
	<!--[if lt IE 9]><script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script><![endif]-->
	<title>Флотилия</title>
	<meta name="keywords" content="" />
	<meta name="description" content="" />
	<link href="https://flotilia.dpos.space/style.css" rel="stylesheet">
  <script type="text/javascript" src="https://flotilia.dpos.space/js/jquery.min.js"></script>
  <script type="text/javascript" src="https://flotilia.dpos.space/js/garlic.min.js"></script>
</head>

<body>

<div class="wrapper">

	<main class="content">
<?php
if ( isset($_SESSION['key']) and $_SESSION['key'] == 'fmggln'){
echo '<h1>Сервис для подсчёта СГ участников Флотилии, составления их рейтинга и составления формата для бота. <A href="https://flotilia.dpos.space/log-viewer.php" target="_blank">Перейти к просмотру истории логов</a></h1>';
if( isset($_POST['timer'] ) ){ // проверяем существование элемента
  $timer = $_POST['timer'];
  $_SESSION['users_list'] = $tags;
}  
if( isset($_POST['tags'] ) ){ // проверяем существование элемента
$tags = $_POST['tags'];
$_SESSION['users_list'] = $tags;

$_SESSION['power90'] = ($_POST['power90'] ?? $_POST['power90'] ??0);
$_SESSION['power85'] = ($_POST['power85'] ?? $_POST['power85'] ?? "");
$_SESSION['power80'] = ($_POST['power80'] ?? $_POST['power80'] ?? "");
$_SESSION['power75'] = ($_POST['power75'] ?? $_POST['power75'] ?? "");
$_SESSION['power70'] = ($_POST['power70'] ?? $_POST['power70'] ?? "");
$_SESSION['power65'] = ($_POST['power65'] ?? $_POST['power65'] ?? "");
$_SESSION['power60'] = ($_POST['power60'] ?? $_POST['power60'] ?? "");
$_SESSION['power55'] = ($_POST['power55'] ?? $_POST['power55'] ?? "");
$_SESSION['power50'] = ($_POST['power50'] ?? $_POST['power50'] ?? "");
$_SESSION['power45'] = ($_POST['power45'] ?? $_POST['power45'] ?? "");
$_SESSION['power40'] = ($_POST['power40'] ?? $_POST['power40'] ?? "");
$_SESSION['power35'] = ($_POST['power35'] ?? $_POST['power35'] ?? "");
$_SESSION['power30'] = ($_POST['power30'] ?? $_POST['power30'] ?? "");
$_SESSION['power25'] = ($_POST['power25'] ?? $_POST['power25'] ?? "");
$_SESSION['power20'] = ($_POST['power20'] ?? $_POST['power20'] ?? "");
$_SESSION['power15'] = ($_POST['power15'] ?? $_POST['power15'] ?? "");
$_SESSION['power10'] = ($_POST['power10'] ?? $_POST['power10'] ?? "");
$_SESSION['power5'] = ($_POST['power5'] ?? $_POST['power5'] ?? "");
$_SESSION['filde_percent'] = ($_POST['filde_percent'] ?? $_POST['filde_percent'] ?? "");

$tag = explode(",", $tags);

echo '<a href="#1">Рейтинг по СГ</a>
<a href="#2">Общая СГ</a>
<a href="#3">Код для бота от @vik</a>
<a href="#4">Скачать лог</a>
<h2><a name="1">Рейтинг участников по СГ</a></h2>';

$users = '';
foreach ($tag as $k4 => $datas4) {
    $users .= $k4 . "=" . $datas4 . "&";
}
parse_str($users, $data[0]);
 
 require $_SERVER['DOCUMENT_ROOT'].'/snippets/get_account.php';
 require $_SERVER['DOCUMENT_ROOT'].'/snippets/get_dynamic_global_properties.php';
 require $_SERVER['DOCUMENT_ROOT'].'/snippets/get_config.php';
 $res = $command->execute($commandQuery); 

 $mass = $res['result'];

 $res3 = $command3->execute($commandQuery3); 

 $mass3 = $res3['result'];

 $config_res = $config_command->execute($config_commandQuery); 

 $config_mass = $config_res['result'];

 $tvfs = (float)$mass3['total_vesting_fund_steem'];
$tvsh = (float)$mass3['total_vesting_shares'];
  
  $steem_per_vests = 1000000 * $tvfs / $tvsh;
$arr_sp = array();
$arr_charge = array();
$line2 = '';
foreach ($mass as $datas) {
// Конвертация VESTS в STEEM POWER
$sp = $datas['vesting_shares'] / 1000000 * $steem_per_vests;
$delegated_sp = $datas['received_vesting_shares'] / 1000000 * $steem_per_vests;
$un_delegating_sp = $datas['delegated_vesting_shares'] / 1000000 * $steem_per_vests;
$delegating_sp = round($un_delegating_sp, 3);
 $gp = round(($sp ?? $sp ?? "")-($delegating_sp ?? $delegating_sp ?? "")+($delegated_sp ?? $delegated_sp ?? ""), 3);
 
 $last_vote_time = $datas['last_vote_time'];
$last_vote_time2 = strtotime($last_vote_time);
$last_vote_time1 = date('d.m.Y г. H:i:s', $last_vote_time2);
  
  $current_time = strtotime($mass3['time']) * 1000;
$last_vote_seconds = strtotime($last_vote_time) * 1000;

$fastpower = 10000/$config_mass['STEEMIT_VOTE_REGENERATION_SECONDS'];
$fast_power = round($fastpower, 5);

$volume_not = ($datas['voting_power']+(($current_time-$last_vote_seconds)/1000)*$fast_power)/100; //расчет текущей Voting Power
 $volume = round($volume_not, 2); // Округление до двух знаков после запятой
 
if ($volume>=100) {
$charge = min($volume, 100);
} else {
	$charge=$volume;
	}

$arr_sp[] = [
'name' => $datas['name'],
'golos_power'=> $gp,
'vote_date' => $last_vote_time1,
'account_power' => $charge
];
  }

  echo "<ol>";
$summ_sp = 0;
usort ($arr_sp, 'gp_sort');
$curator_power = '';
foreach($arr_sp as $key_one_sp => $one_sp) {
echo "<li>".$one_sp['name'].": ".$one_sp['golos_power']."<br>".$one_sp['vote_date'].", ".$one_sp['account_power']."%"."\r\n"."</li>";
$summ_sp += $one_sp['golos_power'];

if ($one_sp['name'] == 'belisey') {
$curator_power .= $one_sp['account_power'];
}

}
echo "</ol>";
echo "<h2><a name='2'>Общая сумма СГ:</a></h2>
<p align='center'><strong>".round($summ_sp, 3)."</strong></p>";

echo '<h2><a name="3">Составление формата списка участников для бота</a></h2>
<p><strong>Внимание: запятую в последней строчке с author надо удалить - она лишняя.</strong></p>';

// Рассчитываем минимальную батарейку, ниже которой будет 5%.
$curator_percent = ($curator_power/100)*$_SESSION['filde_percent']; // Рассчёт процента.
$CuratorVotePower = round($curator_power - $curator_percent, 2); // Рассчёт минимальной батарейки.

echo '<div id="cont1">['.'<br>';
foreach($arr_sp as $key_one_sp31 => $one_sp31) {

  if ($one_sp31['account_power'] < $CuratorVotePower) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":5, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power90']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":90, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power85']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":85, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power80']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":80, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power75']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":75, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power70']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":70, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power65']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":65, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power60']) {
echo '{"author":"'.$one_sp31['name'].'", "vote":60, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power55']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":55, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power50']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":50, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power45']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":45, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power40']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":40, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power35']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":35, "delay":'.$timer.'},'.'<br>';
} else if ($one_sp31['golos_power'] >=$_SESSION['power30']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":30, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power25']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":25, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power20']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":20, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power15']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":15, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power10']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":10, "delay":'.$timer.'},'.'<br>';
  } else if ($one_sp31['golos_power'] >=$_SESSION['power5']) {
  echo '{"author":"'.$one_sp31['name'].'", "vote":5, "delay":'.$timer.'},'.'<br>';
}
}
echo ']</div>
<button id="userButton1">Скопировать карту</button>';
echo "<script>
//цепляем событие на onclick кнопки
var button = document.getElementById('userButton1');
button.addEventListener('click', function () {
  //нашли наш контейнер
  var ta = document.getElementById('cont1'); 
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

// Лог:
$filename = $_SERVER['DOCUMENT_ROOT']."/logs/".date("d-m-Y-H-i-s");
$fp = fopen($filename.".txt", "w");

// записываем в файл текст
fwrite($fp, "Пользователи:"."\r\n".$_SESSION['users_list']."\r\n"."\r\n"."Минималка СГ при определённом проценте:"."\r\n"."\r\n"."90%: ".($_SESSION['power90'] ?? $_SESSION['power90'] ?? "")."\r\n"."85%: ".($_SESSION['power85'] ?? $_SESSION['power85'] ?? "")."\r\n"."80%: ".($_SESSION['power80'] ?? $_SESSION['power80'] ?? "")."\r\n"."75%: ".($_SESSION['power75'] ?? $_SESSION['power75'] ?? "")."\r\n"."70%: ".($_SESSION['power70'] ?? $_SESSION['power75'] ?? "")."\r\n"."65%: ".($_SESSION['power65'] ?? $_SESSION['power65'] ?? "")."\r\n"."60%: ".($_SESSION['power650'] ?? $_SESSION['power60'] ?? "")."\r\n"."55%: ".($_SESSION['power55'] ?? $_SESSION['power55'] ?? "")."\r\n"."50%: ".($_SESSION['power50'] ?? $_SESSION['power50'] ?? "")."\r\n"."45%: ".($_SESSION['power45'] ?? $_SESSION['power45'] ?? "")."\r\n"."40%: ".($_SESSION['power40'] ?? $_SESSION['power40'] ?? "")."\r\n"."35%: ".($_SESSION['power35'] ?? $_SESSION['power35'] ?? "")."\r\n"."30%: ".($_SESSION['power30'] ?? $_SESSION['power30'] ?? "")."\r\n"."25%: ".($_SESSION['power25'] ?? $_SESSION['power25'] ?? "")."\r\n"."20%: ".($_SESSION['power20'] ?? $_SESSION['power20'] ?? "")."\r\n"."15%: ".($_SESSION['power15'] ?? $_SESSION['power15'] ?? "")."\r\n"."10%: ".($_SESSION['power10'] ?? $_SESSION['power10'] ?? "")."\r\n"."5%: ".($_SESSION['power5'] ?? $_SESSION['power5'] ?? "")."\r\n");
fwrite($fp, "\r\n"."Процент минимальной батарейки, которая получит % апвота в соответствии с СГ: ".$_SESSION['filde_percent']."\r\n\r\n"."Рейтинг пользователей на момент создания лога:"."\r\n"."\r\n");

$teller = 1;
usort ($arr_sp, 'gp_sort');
foreach($arr_sp as $key_one_sp2 => $one_sp2) {
fwrite($fp, "$teller. ".$one_sp2['name'].": ".$one_sp2['golos_power']);
fwrite($fp, "\r\n".$one_sp2['vote_date'].", ".$one_sp2['account_power']."%"."\r\n");

$teller++;
}
// закрываем
fclose($fp);

echo "<h2><a name='4'>Лог файл сего момента</a></h2>
<p align='center'><a href='https://flotilia.dpos.space/logs/".date("d-m-Y-H-i-s").".txt' target='_blank'>Скачать файл ".date("d-m-Y-H-i-s").".txt</a></p>";
}
} else {
require $_SERVER['DOCUMENT_ROOT'].'/login.php';
}
?>

<h2>Отправка данных</h2>
<form method="post" action="" data-persist="garlic" data-domain="true" id="flot-form1" enctype="multipart/form-data">
<p><label for="timer">Отсрочка апвота: </label>
<input type="text" name="timer" id="uptime" value=""></p>
<p><label for="tags">Введите логины участников Флотилии через запятую, но без пробелов: </label>
<input type="text" name="tags" id="flot-list" value=""></p>
<p><label for="power90">Введите минимальную СГ для 90% апвота: </label>
<input type="text" name="power90" id="power90" value=""></p>
<p><label for="power85">Введите минимальную СГ для 85% апвота: </label>
<input type="text" name="power85" id="power85" value=""></p>
<p><label for="power80">Введите минимальную СГ для 80% апвота: </label>
<input type="text" name="power80" id="power80" value=""></p>
<p><label for="power75">Введите минимальную СГ для 75% апвота: </label>
<input type="text" name="power75" id="power75" value=""></p>
<p><label for="power70">Введите минимальную СГ для 70% апвота: </label>
<input type="text" name="power70" id="power70" value=""></p>
<p><label for="power65">Введите минимальную СГ для 65% апвота: </label>
<input type="text" name="power65" id="power65" value=""></p>
<p><label for="power60">Введите минимальную СГ для 60% апвота: </label>
<input type="text" name="power60" id="power60 value=""></p>
<p><label for="power55">Введите минимальную СГ для 55% апвота: </label>
<input type="text" name="power55" id="power55" value=""></p>
<p><label for="power50">Введите минимальную СГ для 50% апвота: </label>
<input type="text" name="power50" id="power50" value=""></p>
<p><label for="power45">Введите минимальную СГ для 45% апвота: </label>
<input type="text" name="power45" id="power45" value=""></p>
<p><label for="power40">Введите минимальную СГ для 40% апвота: </label>
<input type="text" name="power40" id="power40" value=""></p>
<p><label for="power35">Введите минимальную СГ для 35% апвота: </label>
<input type="text" name="power35" id="power35" value=""></p>
<p><label for="power30">Введите минимальную СГ для 30% апвота: </label>
<input type="text" name="power30" id="power30" value=""></p>
<p><label for="power25">Введите минимальную СГ для 25% апвота: </label>
<input type="text" name="power25" id="power25" value=""></p>
<p><label for="power20">Введите минимальную СГ для 20% апвота: </label>
<input type="text" name="power20" id="power20" value=""></p>
<p><label for="power15">Введите минимальную СГ для 15% апвота: </label>
<input type="text" name="power15" id="power15" value=""></p>
<p><label for="power10">Введите минимальную СГ для 10% апвота: </label>
<input type="text" name="power10" id="power10" value=""></p>
<p><label for="power5">Введите минимальную СГ для 5% апвота: </label>
<input type="text" name="power5" id="power5" value=""></p>
<p><label for="filde_percent">Введите процент отличия батарейки от текущей voteing_power куратора (Если батарейка участника будет меньше неё, получит 5% апвот Флотилии): </label>
<input type="text" name="filde_percent" id="filde_percent" value="">%</p>
<p><strong><button type="button" onclick="form.submit()" class="psend">Отправить данные</button></strong></p>
</form>
	</main><!-- .content -->
</div><!-- .wrapper -->

</body>
</html>
