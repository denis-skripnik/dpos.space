<?php
ini_set('session.gc_maxlifetime', 120000009600);
ini_set('session.cookie_lifetime', 120000009600);
@session_start();
if ( isset($_SESSION['key']) and $_SESSION['key'] == 'fmggln'){
echo '<h1>История логов с фильтрацией по датам. <a href="https://flotilia.dpos.space" target="_blank">Перейти к форме</a></h1>
<form method="post" action="">
<p><label for="start_date">Первая дата: </label>
<input type="date" name="start_date" value="" required></p>
<p><label for="end_date">Вторая дата</label>
<input type="date" name="end_date" value="" required></p>
<p align="center"><input type="submit" value="Фильтр"></p>
</form>';

function listdir_by_date($path){
        
	$dir = opendir($path);
        $list = array();
        while($file = readdir($dir)){
            if ($file != '.' && $file != '..' && $file[strlen($file)-1] != '~' ){
                $ctime2 = filectime( $path . $file );
$ctime = date("Y-m-d\\TH:i:s", $ctime2);
				$list[$ctime] = $file;
            }
        }
        closedir($dir);
        krsort($list); // используя методы krsort и ksort можем влиять на порядок сортировки
        return $list;	
    }

$files = listdir_by_date($_SERVER['DOCUMENT_ROOT'].'/logs/');

echo "<h2>Список логов</h2>
<table><tr><th>Дата и время создания</th>
<th>Имя файла со ссылкой</th></tr>";
foreach ($files as $file_key => $file_value) {
$date_explode = explode("T", $file_key);//Разбивает строку в массив, создает элемент после символа T
$date_exp = $date_explode[0];
if ($date_exp ==($_POST['start_date'] ?? $_POST['start_date'] ?? "")) {
echo "<tr><td>$file_key</td>
<td><a href='https://flotilia.dpos.space/logs/$file_value' target='_blank'>$file_value</a></td></tr>";
} else if ($date_exp ==($_POST['end_date'] ?? $_POST['end_date'] ?? "")) {
echo "<tr><td>$file_key</td>
<td><a href='https://flotilia.dpos.space/logs/$file_value' target='_blank'>$file_value</a></td></tr>";
}

}
echo "</table>";
} else {
require $_SERVER['DOCUMENT_ROOT'].'/login.php';
}