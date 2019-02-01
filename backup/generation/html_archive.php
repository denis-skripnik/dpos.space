<?php
$pathdir= $_SERVER['DOCUMENT_ROOT']."/backup/users/".$_POST['WLS_login']."/".$chain.'/'; // путь к папке, файлы которой будем архивировать
$nameArhive = $_SERVER['DOCUMENT_ROOT'].'/backup/archives/'.$chain.'_html_'.$_POST['WLS_login'].'.zip'; //название архива
$zip = new ZipArchive; // класс для работы с архивами
if ($zip -> open($nameArhive, ZipArchive::CREATE) === TRUE){ // создаем архив, если все прошло удачно продолжаем
$dir = opendir($pathdir); // открываем папку с файлами
while( $file = readdir($dir)){ // перебираем все файлы из нашей папки
if (is_file($pathdir.$file)){ // проверяем файл ли мы взяли из папки
$zip -> addFile($pathdir.$file, $file); // и архивируем
}
}
$zip -> close(); // закрываем архив.
echo '<p>Резервная копия успешно создана. Вы можете <a href="https://dpos.space/backup/archives/'.$chain.'_html_'.$_POST['WLS_login'].'.zip" target="_blank">скачать архив</a></p>
<p>Либо вы можете скопировать адрес из поля ниже:
<form><input type="url" name="download_url" value="https://dpos.space/backup/archives/'.$chain.'_html_'.$_POST['WLS_login'].'.zip"></form></p>';
} else {
die ('Произошла ошибка при создании архива');
}
?>