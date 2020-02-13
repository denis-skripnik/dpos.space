<?php
if (isset($_POST['g-recaptcha-response'])) $captcha_response = $_POST['g-recaptcha-response'];
else die('На форме нет капчи! Обратитесь к администратору!');

$url = 'https://www.google.com/recaptcha/api/siteverify';
$params = [
    'secret' => '6LfW7pQUAAAAAIg3txj2F_9tjhvWr8UNQfn9ze7x',
    'response' => $captcha_response,
    'remoteip' => $_SERVER['REMOTE_ADDR']
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

$response = curl_exec($ch);
if(!empty($response)) $decoded_response = json_decode($response);

$success = false;

if ($decoded_response && $decoded_response->success)
{
    $success = $decoded_response->success;
    $to = "scadens@yandex.ru";
    $tema = "Заявка на добавление обменного шлюза";
    $message = "Блокчейн: ".$_POST['chain']."<br>
    Логин: ".$_POST['login']."<br>";
    $headers = 'MIME-Version: 1.0'."\r\n";
    $headers .= 'Content-type: text/html; charset=utf-8'."\r\n";
    $send = mail($to, $tema, $message, $headers); //отправляет получателю на емайл значения переменных
    if ($send == 1) {
    echo '<p><strong>Успешно: заявка отправлена. После проверки ваш шлюз будет добавлен. Время реакции до 3 суток.</strong></p>';
}
}