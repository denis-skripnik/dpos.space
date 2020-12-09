<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function transliteration($tag_en, $mode = 'torus') {
	$lang = [
		'ые' => 'yie',
		'щ' => 'shch',
		'ш' => 'sh',
		'ч' => 'ch',
		'ц' => 'cz',
		'й' => 'ij',
		'ё' => 'yo',
		'э' => 'ye',
		'ю' => 'yu',
		'я' => 'ya',
		'х' => 'kh',
		'ж' => 'zh',
		'а' => 'a',
		'б' => 'b',
		'в' => 'v',
		'г' => 'g',
		'д' => 'd',
		'е' => 'e',
		'з' => 'z',
		'и' => 'i',
		'к' => 'k',
		'л' => 'l',
		'м' => 'm',
		'н' => 'n',
		'о' => 'o',
		'п' => 'p',
		'р' => 'r',
		'с' => 's',
		'т' => 't',
		'у' => 'u',
		'ф' => 'f',
		'ъ' => 'xx',
		'ы' => 'y',
		'ь' => 'x',
	 //   'ґ' => 'g',
	//    'є' => 'e',
	 //   'і' => 'i',
	  //  'ї' => 'i'
	];
	$eng = array_flip($lang);
	if ($mode == 'torus') {
		if (substr($tag_en, 0, 4) != 'ru--') {
			return $tag_en;
		}
		$tag_en = substr($tag_en, 4);
		$str = $tag_en;
		foreach ($eng as $lFrom => $lTo) {
			$from = $lFrom;
			$to = $lTo;
			$str = str_replace($from, $to, $str);
			$str = str_replace(mb_strtoupper($from, 'utf-8'), mb_strtoupper($to, 'utf-8'), $str);
		}
		return $str;
	}
}


function archive($app_dir) {
	global $conf;
	$pathdir= $app_dir."/users/".pageUrl()[2]."/"; // путь к папке, файлы которой будем архивировать
	$nameArhive = $app_dir.'/archives/'.pageUrl()[2].'.zip'; //название архива
		$zip = new ZipArchive; // класс для работы с архивами
	if ($zip -> open($nameArhive, ZipArchive::CREATE) === TRUE){ // создаем архив, если все прошло удачно продолжаем
	$dir = opendir($pathdir); // открываем папку с файлами
	while( $file = readdir($dir)){ // перебираем все файлы из нашей папки
	if (is_file($pathdir.$file)){ // проверяем файл ли мы взяли из папки
	$zip -> addFile($pathdir.$file, $file); // и архивируем
	}
	}
	$zip -> close(); // закрываем архив.
	$content = '<p>Резервная копия успешно создана. Вы можете <a href="'.$conf['siteUrl'].'blockchains/steem/apps/backup/archives/'.pageUrl()[2].'.zip" target="_blank">скачать архив</a></p>
	<p>Либо вы можете скопировать адрес из поля ниже:
	<form class="form"><input type="url" name="download_url" value="'.$conf['siteUrl'].'blockchains/steem/apps/backup/archives/'.pageUrl()[2].'.zip"></form></p>';
	} else {
	die ('Произошла ошибка при создании архива');
	}
	return $content;
	}

function generator($app_dir) {
	//подключаем скрипт
require_once 'GetDiscussionsByLogin.php';

//создаём объект
$worker = new GetDiscussionsByLogin();

//получаем данные по логину
$discussions = $worker->execute(pageUrl()[2]);
$put1 = $app_dir.'/users/'.pageUrl()[2].'/';
if (!file_exists($put1)) {
$dir1 = mkdir($put1);
}
$put2 = $app_dir."/archives/";
if (!file_exists($put2)) {
$dir2 = mkdir($put2);
}
$resultcount = count($discussions);

for ($postnum = 0; $postnum < $resultcount; $postnum++) {
$class_content = $discussions[$postnum];

if (pageUrl()[3] == 'yes2') {
if ($class_content['author'] == pageUrl()[2]) {

// открываем файл, если файл не существует,
//делается попытка создать его
$filename = $put1."/".$postnum."_".$class_content['permlink'];
$fp = fopen($filename.".txt", "w");

// записываем в файл текст
fwrite($fp, "Заголовок: ".$class_content['title']."\r\n"."Текст:"."\r\n".$class_content['body']."\r\n"."Теги:"."\r\n");

$metadata = json_decode($class_content['json_metadata'], true);
if (!empty($metadata['tags'])) {
$tegi = $metadata['tags'];

$taging = '';
foreach($tegi AS $teg) {
$taging .= transliteration($teg, 'torus').' ';
}
fwrite($fp, $taging);
}
// закрываем
fclose($fp);
}
} else if (pageUrl()[3] == 'yes3') {
// открываем файл, если файл не существует,
//делается попытка создать его
$filename = $put1.'/'.$postnum."_".$class_content['permlink'];
$fp = fopen($filename.".txt", "w");
// записываем в файл текст
fwrite($fp, "Заголовок: ".$class_content['title']."\r\n"."Текст:"."\r\n".$class_content['body']."\r\n"."Теги:"."\r\n");

$metadata = json_decode($class_content['json_metadata'], true);
if (isset($metadata['tags'])) {
$tegi = $metadata['tags'];

$taging = '';
foreach($tegi AS $teg) {
$taging .= transliteration($teg, 'torus').' ';
}
fwrite($fp, $taging);
}
// закрываем
fclose($fp);
}
} // Конец цикла
$zipfile = $put2.'/'.pageUrl()[2].'.zip';
if (file_exists($zipfile)) {
unlink($zipfile);
$content = archive($app_dir);
}
else {
$content = archive($app_dir);
}
return $content;
}

function generate_html_text($markdown_text){
    $parsedown = new Parsedown();
    $parsedown->setBreaksEnabled(true);
    return $parsedown->text($markdown_text);
}

function html_archive($app_dir) {
	global $conf;
	$pathdir= $app_dir."/users/".pageUrl()[2]."/"; // путь к папке, файлы которой будем архивировать
	$nameArhive = $app_dir.'/archives/'.'html_'.pageUrl()[2].'.zip'; //название архива
	$zip = new ZipArchive; // класс для работы с архивами
	if ($zip -> open($nameArhive, ZipArchive::CREATE) === TRUE){ // создаем архив, если все прошло удачно продолжаем
	$dir = opendir($pathdir); // открываем папку с файлами
	while( $file = readdir($dir)){ // перебираем все файлы из нашей папки
	if (is_file($pathdir.$file)){ // проверяем файл ли мы взяли из папки
	$zip -> addFile($pathdir.$file, $file); // и архивируем
	}
	}
	$zip -> close(); // закрываем архив.
	$content = '<p>Резервная копия успешно создана. Вы можете <a href="'.$conf['siteUrl'].'blockchains/steem/apps/backup/archives/'.'html_'.pageUrl()[2].'.zip" target="_blank">скачать архив</a></p>
	<p>Либо вы можете скопировать адрес из поля ниже:
	<form class="form"><input type="url" name="download_url" value="'.$conf['siteUrl'].'steem/backup/archives/'.'html_'.pageUrl()[2].'.zip"></form></p>';
	} else {
	die ('Произошла ошибка при создании архива');
	}
return $content;
}

function html_generator($app_dir) {
	//подключаем скрипт
require_once 'GetDiscussionsByLogin.php';

//создаём объект
$worker = new GetDiscussionsByLogin();

//получаем данные по логину
$discussions = $worker->execute(pageUrl()[2]);

$put1 = $app_dir."/users/".pageUrl()[2].'/';
if (!file_exists($put1)) {
$dir1 = mkdir($put1);
}
$put2 = $app_dir."/archives/";
if (!file_exists($put2)) {
$dir2 = mkdir($put2);
}
$resultcount = count($discussions);
for ($postnum = 0; $postnum < $resultcount; $postnum++) {
$content = $discussions[$postnum];

if (pageUrl()[3] == 'yes2') {
if ($content['author'] == pageUrl()[2]) {
// открываем файл, если файл не существует,
//делается попытка создать его
$filename = $app_dir."/users/".pageUrl()[2]."/".$postnum."_".$content['permlink'];
$fp = fopen($filename.".html", "w");

$markdown_text = generate_html_text($content['body']);

// записываем в файл текст
fwrite($fp, "Заголовок: ".$content['title']."<br>"."Текст:"."<br>".$markdown_text."<br>"."Теги:"."<br>");

$metadata = json_decode($content['json_metadata'], true);
if (isset($metadata['tags'])) {
$tegi = $metadata['tags'];

$taging = '';
foreach($tegi AS $teg) {
$taging .= transliteration($teg, 'torus').' ';
}
	fwrite($fp, $taging);
}
// закрываем
fclose($fp);
}
} else if (pageUrl()[3] == 'yes3') {
// открываем файл, если файл не существует,
//делается попытка создать его
$filename = $app_dir."/users/".pageUrl()[2]."/".$postnum."_".$content['permlink'];
$fp = fopen($filename.".html", "w");

$markdown_text = generate_html_text($content['body']);

// записываем в файл текст
fwrite($fp, "Заголовок: ".$content['title']."<br>"."Текст:"."<br>".$markdown_text."<br>"."Теги:"."<br>");

$metadata = json_decode($content['json_metadata'], true);
if (isset($metadata['tags'])) {
$tegi = $metadata['tags'];

$taging = '';
foreach($tegi AS $teg) {
$taging .= transliteration($teg, 'torus').' ';
}
	fwrite($fp, $taging);
}
// закрываем
fclose($fp);
} else { }


} // Конец цикла

$zipfile = $app_dir.'/archives/'.'html_'.pageUrl()[2].'.zip';
if (file_exists($zipfile)) {
unlink($zipfile);
$result_msg = html_archive($app_dir); // Архивируем созданные файлы
}
else {
	$result_msg = html_archive($app_dir); // Архивируем созданные файлы
}
return $result_msg;
}

function fullRemove_ff($path,$t="1") {
    $rtrn="1";
    if (file_exists($path) && is_dir($path)) {
        $dirHandle = opendir($path);
        while (false !== ($file = readdir($dirHandle))) {
            if ($file!='.' && $file!='..') {
                $tmpPath=$path.'/'.$file;
                chmod($tmpPath, 0777);
                if (is_dir($tmpPath)) {
                    fullRemove_ff($tmpPath);
                } else {
                    if (file_exists($tmpPath)) {
                        unlink($tmpPath);
                    }
                }
            }
        }
        closedir($dirHandle);
        if ($t=="1") {
            if (file_exists($path)) {
                rmdir($path);
            }
        }
    } else {
        $rtrn="0";
    }
    return $rtrn;
}
?>