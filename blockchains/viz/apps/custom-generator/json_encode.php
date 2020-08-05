<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
echo json_encode($_POST);