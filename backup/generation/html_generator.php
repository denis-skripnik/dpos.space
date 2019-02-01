<?php

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

//подключаем скрипт
require_once 'GetDiscussionsByLogin.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';

//создаём объект
$worker = new GetDiscussionsByLogin();

//получаем данные по логину
$discussions = $worker->execute($_POST['WLS_login']);

require_once($_SERVER['DOCUMENT_ROOT'].'/backup/generation/vendor/autoload.php');

function generate_html_text($markdown_text){
    $parsedown = new Parsedown();
    $parsedown->setBreaksEnabled(true);
    return $parsedown->text($markdown_text);
}

function make_image_from_inline_code($text){
    
}


$put1 = $_SERVER['DOCUMENT_ROOT']."/backup/users/".$_POST['WLS_login'].'/';
if (!file_exists($put1)) {
$dir1 = mkdir($put1);
}
$put2 = $_SERVER['DOCUMENT_ROOT']."/backup/users/".$_POST['WLS_login']."/".$chain.'/';
if (!file_exists($put2)) {
$dir2 = mkdir($put2);
}
$put3 = $_SERVER['DOCUMENT_ROOT']."/backup/archives/";
if (!file_exists($put3)) {
$dir3 = mkdir($put3);
}
$resultcount = count($discussions);
for ($postnum = 0; $postnum < $resultcount; $postnum++) {
$content = $discussions[$postnum];

if ($_POST['reblogs'] == 'yes2') {
if ($content['author'] == $_POST['WLS_login']) {
// открываем файл, если файл не существует,
//делается попытка создать его
$filename = $_SERVER['DOCUMENT_ROOT']."/backup/users/".$_POST['WLS_login']."/".$chain.'/'.$postnum."_".$content['permlink'];
$fp = fopen($filename.".html", "w");

$markdown_text = generate_html_text($content['body']);

// записываем в файл текст
fwrite($fp, "Заголовок: ".$content['title']."<br>"."Текст:"."<br>".$markdown_text."<br>"."Теги:"."<br>");

$metadata = json_decode($content['json_metadata'], true);
$tegi = $metadata['tags'];

$taging = '';
foreach($tegi AS $teg) {
if ($chain == 'WLS' or $chain == 'golos') {
$taging .= transliteration($teg, 'torus').' ';
} else if ($chain == 'steem') {
$taging .= $teg.' ';
}
}
	fwrite($fp, $taging);

// закрываем
fclose($fp);
}
} else if ($_POST['reblogs'] == 'yes3') {
// открываем файл, если файл не существует,
//делается попытка создать его
$filename = $_SERVER['DOCUMENT_ROOT']."/backup/users/".$_POST['WLS_login']."/".$chain.'/'.$postnum."_".$content['permlink'];
$fp = fopen($filename.".html", "w");

$markdown_text = generate_html_text($content['body']);

// записываем в файл текст
fwrite($fp, "Заголовок: ".$content['title']."<br>"."Текст:"."<br>".$markdown_text."<br>"."Теги:"."<br>");

$metadata = json_decode($content['json_metadata'], true);
$tegi = $metadata['tags'];

$taging = '';
foreach($tegi AS $teg) {
if ($chain == 'WLS' or $chain == 'golos') {
$taging .= transliteration($teg, 'torus').' ';
} else if ($chain == 'steem') {
$taging .= $teg.' ';
}
}
	fwrite($fp, $taging);

// закрываем
fclose($fp);
} else { }


} // Конец цикла

$zipfile = $_SERVER['DOCUMENT_ROOT'].'/backup/archives/'.$chain.'_html_'.$_POST['WLS_login'].'.zip';
if (file_exists($zipfile)) {
unlink($zipfile);
require_once($_SERVER['DOCUMENT_ROOT'].'/backup/generation/html_archive.php'); // Архивируем созданные файлы
}
else {
require_once($_SERVER['DOCUMENT_ROOT'].'/backup/generation/html_archive.php'); // Архивируем созданные файлы
}
?>