<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function pageUrl() {
    $chpu = $_SERVER['REQUEST_URI'];

/*
 проверяем, что бы в URL не было ничего, кроме символов
 алфавита (a-zA-Z), цифр (0-9), а также . / - _ #
 в противном случае - выдать ошибку 404
*/
setlocale(LC_ALL, "ru_RU.UTF-8");
 if (preg_match ("/([^a-zA-Z0-9а-яА-Я\.\/\-\_\?\&\=\#]u)/", $chpu)) {

   header("HTTP/1.0 404 Not Found");
   echo "Недопустимые символы в URL";
   exit;
 }
$url = preg_split ("/(\/|\.*$)/", $chpu,-1, PREG_SPLIT_NO_EMPTY);
return $url;
    }

    function dirScanner($dir) {
      $list = scandir($dir);
      if (!$list) return false;
      unset($list[0], $list[1]);
return $list;
    }

function inUrl2($url, $blockchain_scripts, $blockchain_styles, $blockchain_snippet) {
  global $conf;
  $data = configs(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/config.json');
  $data['scripts'] = '';
  $data['scripts'] .= $blockchain_scripts;
  if (is_dir(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js')) {
    $scripts = dirScanner(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js');
    foreach($scripts as $script) {
  $finde_files = strpos($script, '.css');
  $finde_no_load =   strpos($script, '_');
  if ($finde_files === false && $finde_no_load === false) {
    if ($script !== 'app.js') {
    $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/'.$script.'"></script>';
    }
  }
  }
  $search_script = array_search('app.js', $scripts);
  if ($search_script) {
    $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js"></script>';
  }
  }
  $data['styles'] = '';
  if (is_dir(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/css')) {
    $styles = dirScanner(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/css');
    $data['styles'] .= $blockchain_styles;
    foreach($styles as $style) {
      $finde_files = strpos($style, '.js');
      $finde_no_load =   strpos($style, '_');
      if ($finde_files === false && $finde_no_load === false) {
      $data['styles'] .= '
  <link href="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/css/'.$style.'" rel="stylesheet">';
      }  
  }
    }
    $data['content'] = $blockchain_snippet;
    $data['content'] .= require_once(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/content.php');
return $data;
  }

    function generatePage() {
global $conf;
      $url = pageUrl();
      $blockchain_scripts = '';
      $blockchain_styles = '';
$blockchain_snippet = '';
      if (!empty($url)) {
        if (count($url) >= 2) {
          if (is_dir(__DIR__.'/blockchains/'.$url[0].'/js')) {
      $scripts = dirScanner(__DIR__.'/blockchains/'.$url[0].'/js');
      foreach($scripts as $script) {
        $finde_files = strpos($script, '.css');
    $finde_no_load =   strpos($script, '_');
    if ($finde_files === false && $finde_no_load === false) {
      if ($script !== 'blockchain.js') {
      $blockchain_scripts .= '<script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/js/'.$script.'"></script>
    ';
      }  
  }
    }
    $search_script = array_search('blockchain.js', $scripts);
    if ($search_script) {
      $blockchain_scripts .= '
    <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/js/blockchain.js"></script>';
    }  
  }
    if (is_dir(__DIR__.'/blockchains/'.$url[0].'/css')) {
      $styles = dirScanner(__DIR__.'/blockchains/'.$url[0].'/css');
      foreach($styles as $style) {
        $finde_files = strpos($style, '.js');
        $finde_no_load =   strpos($style, '_');
        if ($finde_files === false && $finde_no_load === false) {
                    $blockchain_styles .= '<link href="'.$conf['siteUrl'].'blockchains/'.$url[0].'/css/'.$style.'" rel="stylesheet">
    ';
        }  
    }
      }

      if (file_exists(__DIR__.'/blockchains/'.$url[0].'/blockchain-snippet.html')) {
  $blockchain_snippet = file_get_contents(__DIR__.'/blockchains/'.$url[0].'/blockchain-snippet.html');
}
    }

  if (count($url) == 1 && file_exists(__DIR__.'/blockchains/'.$url[0].'/index.html')) {
$data = configs(__DIR__.'/blockchains/'.$url[0].'/config.json');
$data['content'] = $blockchain_snippet;
$data['content'] .= file_get_contents(__DIR__.'/blockchains/'.$url[0].'/content.html');
} else if (count($url) == 2 && file_exists(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/index.php')) {
  $data = inUrl2($url, $blockchain_scripts, $blockchain_styles, $blockchain_snippet);
} else if (count($url) >= 3) {
  require_once(__DIR__.'/blockchains/'.pageUrl()[0].'/apps/'.pageUrl()[1].'/index.php');
if (!isset($data)) {
  $data = inUrl2($url, $blockchain_scripts, $blockchain_styles, $blockchain_snippet);
}
  $data['scripts'] = '';
  $data['scripts'] .= $blockchain_scripts;
  if (is_dir(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js')) {
        $scripts = dirScanner(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js');
    foreach($scripts as $script) {
  $finde_files = strpos($script, '.css');
  $finde_no_load =   strpos($script, '_');
  if ($finde_files === false && $finde_no_load === false) {
    if ($script !== 'app.js') {
    $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/'.$script.'"></script>';
    }
  }
  }
  $search_script = array_search('app.js', $scripts);
  if ($search_script) {
    $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js"></script>';
  }
  }
  $data['styles'] = '';
  if (is_dir(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/css')) {
    $styles = dirScanner(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/css');
    $data['styles'] .= $blockchain_styles;
    foreach($styles as $style) {
      $finde_files = strpos($style, '.js');
      $finde_no_load =   strpos($style, '_');
      if ($finde_files === false && $finde_no_load === false) {
      $data['styles'] .= '
  <link href="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/css/'.$style.'" rel="stylesheet">';
      }  
  }
    }

}
} else {
  $data = configs(__DIR__.'/config.json');
  $data['content'] = file_get_contents(__DIR__.'/content.html');
}
return ($data ?? $data ?? "");
}

function configs($file) {
  $json = file_get_contents("$file");
$obj = json_decode($json, true);
return $obj;
}

function generateMenu() {
global $conf;
  $str = '';
  if (!pageUrl()) {
$blockchains = dirScanner(__DIR__.'/blockchains');
foreach ($blockchains as $blockchain) {
$blockchain_config = configs(__DIR__.'/blockchains/'.$blockchain.'/config.json');
  $str .= '<li><a href="'.$conf['siteUrl'].$blockchain.'">'.$blockchain_config['in_menu'].'</a></li>';
}
} else {
  if (is_dir(__DIR__.'/blockchains/'.pageUrl()[0].'/apps')) {
    $apps = dirScanner(__DIR__.'/blockchains/'.pageUrl()[0].'/apps');
  foreach ($apps as $app) {
  $app_config = configs(__DIR__.'/blockchains/'.pageUrl()[0].'/apps/'.$app.'/config.json');
    $str .= '<li><a href="'.$conf['siteUrl'].pageUrl()[0].'/'.$app.'">'.$app_config['in_menu'].'</a></li>';
  }
} else {
  $blockchains = dirScanner(__DIR__.'/blockchains');
  foreach ($blockchains as $blockchain) {
    $blockchain_config = configs(__DIR__.'/blockchains/'.$blockchain.'/config.json');
    $str .= '<li><a href="'.$conf['siteUrl'].$blockchain.'">'.$blockchain_config['in_menu'].'</a></li>';
  }
}
}
return $str;
}

function generateBreadCrumbs() {
$url = pageUrl();
global $conf;
global $data;
$str = '';
if (!empty($url)) {
$max_key = count($url) -1;
  $str .= '<li><a href="'.$conf['siteUrl'].'">Главная</a></li>
';
if ($max_key > 0) {
  $str .= '<li><a href="'.$conf['siteUrl'].$url[0].'">'.configs(__DIR__.'/blockchains/'.$url[0].'/config.json')['title'].'</a></li>
';
if ($max_key >= 2) {
  $str .= '<li><a href="'.$conf['siteUrl'].$url[0].'/'.$url[1].'">'.configs(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/config.json')['title'].'</a></li>
';
}
}
}
$str .= '<li>'.$data['title'].'</li>';
return $str;
}

function isJSON($string) {
  $json = json_decode($string, true);
  return is_string($string) && is_array($json) ? ['approve' => true, 'data' => $json] : ['approve' => false, 'data' => $string];
}

?>