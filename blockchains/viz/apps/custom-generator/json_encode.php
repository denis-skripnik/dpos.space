<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
unset($_POST['viz_json_operation_name']);
echo json_encode($_POST);