<?php

// Формирование price-feed для GOLOS относительно BTS из альтернативных источников

// изменили сайт, в связи с тем, что на cryptocharts после 10.05.2022 курс BTS не отслеживается
$p=getPage("https://pokur.su/bts/rub/1/"); // курс BTS-RUB
$t=explode("bitshares в рублях на сегодня составляет", $p);
$t=explode(" ", $t[1]);
$bts=(float)str_replace(",", ".", $t[1]);

$p=getPage("https://ticker.rudex.org/api/v1/ticker"); // курс GOLOS-BTS
$obj=json_decode($p);

$time=time();
$count=0;

while (true) { // торги по золоту выставляются не за каждый день (выходные и др.) поэтому берём за последнюю имеющуюся дату
  $d=date("d/m/Y", $time);
  $req="http://www.cbr.ru/scripts/xml_metall.asp?date_req1=".$d."&date_req2=".$d;
  $p=getPage($req); // курс GOLD-RUB
  $count++;
  $t=explode("<Sell>", $p);
  $t=explode("</Sell>", $t[1]);
  if (isset($t) && $t[0]<>0 || $count>14) {
      break;
  } else {
      $time=$time-24*60*60;
  }
}

$golos=$bts * (float)$obj->GLS_BTS->last_price; // стоимость GOLOS в битшарах умножаем на курс битшар к рублю - получаем стоимость GOLOS в рублях
$gold=(float)str_replace(",", ".", $t[0])/1000; // стоимость милиграмма золота в рублях

$feed=round($golos/$gold, 3); // соотношение GOLOS/GBG

$obj='{"GOLOS":'.$golos.', "GOLD":'.$gold.', "DATEG":"'.$d.'", "FEED":'.$feed.'}';

echo $obj;
// (с) https://github.com/jackvote
?>
