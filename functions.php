<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function pageUrl() {
    $chpu = $_SERVER['REQUEST_URI'];

/*
 проверяем, что бы в URL не было ничего, кроме символов
 алфавита (a-zA-Z), цифр (0-9), а также . / - _ #
 в противном случае - выдать ошибку 404
*/
setlocale(LC_ALL, "ru_RU.UTF-8");
setlocale(LC_NUMERIC, 'en_US.UTF8');
if (preg_match ("/([^a-zA-Z0-9а-яА-Я\.\/\-\_\?\&\=\#]u)/", $chpu)) {

   header("HTTP/1.0 404 Not Found");
   echo "Недопустимые символы в URL";
   exit;
 }
$url = preg_split ("/(\/|\?|\.*$)/", $chpu,-1, PREG_SPLIT_NO_EMPTY);
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
    $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js/'.$script);
      $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/'.$script.'?ver='.$version.'"></script>';
    }
  }
  }
  $search_script = array_search('app.js', $scripts);
  if ($search_script) {
    $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js');
    if (strpos($url[1], 'import') !== false) {
  $data['scripts'] .= '
  <script type="module" src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js?ver='.$version.'"></script>';
} else {
  $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js?ver='.$version.'"></script>';
}
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
        $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/css/'.$style);
        $data['styles'] .= '
  <link href="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/css/'.$style.'?ver='.$version.'" rel="stylesheet">';
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
        if (count($url) >= 1) {
          if (is_dir(__DIR__.'/blockchains/'.$url[0].'/js')) {
      $scripts = dirScanner(__DIR__.'/blockchains/'.$url[0].'/js');
      foreach($scripts as $script) {
        $finde_files = strpos($script, '.css');
    $finde_no_load =   strpos($script, '_');
    if ($finde_files === false && $finde_no_load === false) {
      if ($script !== 'blockchain.js') {
        $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/js/'.$script);
        $blockchain_scripts .= '<script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/js/'.$script.'?ver='.$version.'"></script>
    ';
      }  
  }
    }
    $search_script = array_search('blockchain.js', $scripts);
    if ($search_script) {
      $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/js/blockchain.js');
      $blockchain_scripts .= '
    <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/js/blockchain.js?ver='.$version.'"></script>';
    }  
  }
    if (is_dir(__DIR__.'/blockchains/'.$url[0].'/css')) {
      $styles = dirScanner(__DIR__.'/blockchains/'.$url[0].'/css');
      foreach($styles as $style) {
        $finde_files = strpos($style, '.js');
        $finde_no_load =   strpos($style, '_');
        if ($finde_files === false && $finde_no_load === false) {
          $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/css/'.$style);
          $blockchain_styles .= '<link href="'.$conf['siteUrl'].'blockchains/'.$url[0].'/css/'.$style.'?ver='.$version.'" rel="stylesheet">
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
$data['scripts'] = $blockchain_scripts;
$data['content'] = $blockchain_snippet;
$data['content'] .= file_get_contents(__DIR__.'/blockchains/'.$url[0].'/content.html');
} else if (count($url) == 2 && file_exists(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/index.php')) {
  $data = inUrl2($url, $blockchain_scripts, $blockchain_styles, $blockchain_snippet);
} else if (count($url) >= 3 && file_exists(__DIR__.'/blockchains/'.pageUrl()[0].'/apps/'.pageUrl()[1].'/index.php')) {
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
      $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js/'.$script);
      $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/'.$script.'?ver='.$version.'"></script>';
    }
  }
  }
  $search_script = array_search('app.js', $scripts);
  if ($search_script) {
    $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js');
    $data['scripts'] .= '
  <script src="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/js/app.js?ver='.$version.'"></script>';
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
        $version = filemtime(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/css/'.$style);
        $data['styles'] .= '
  <link href="'.$conf['siteUrl'].'blockchains/'.$url[0].'/apps/'.$url[1].'/css/'.$style.'?ver='.$version.'" rel="stylesheet">';
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
  $file = file_get_contents(__DIR__.'/menu.json');
$menu = json_decode($file, TRUE);
$str = '';
if (!pageUrl()) {
  foreach ($menu as $key => $val) {
    if (!isset($val['name'])) continue;
    $val['name'] = mb_strtoupper($val['name']);
    $str .= '<li class="nav-link"><a href="'.$conf['siteUrl'].$key.'" class="nav-item">'.$val['name'].'</a></li>';
  }
} else if (isset($menu[pageUrl()[0]])) {
  $services = $menu[pageUrl()[0]]['services'];
foreach ($services as $key => $val) {
  if ($key == 'no_category' || $key == '') {
    foreach ($val as $permlink => $ankor) {
      $ankor = mb_strtoupper($ankor);
      if ($permlink != 'name') {
        $str .= '<li class="nav-link"><a href="'.$conf['siteUrl'].pageUrl()[0].'/'.$permlink.'" class="nav-item">'.$ankor.'</a></li>';
      } // if not no_category name
    } // foreach no_category services
  } // if no_category
else {
  $val['name'] = mb_strtoupper($val['name']);
  $str .= '<li class="nav-link"><a class="nav-item" onclick="spoiler(`'.$key.'`, `subMenu`); return false;">'.$val['name'].'</a>
<ul class="nav-list subMenu" id="'.$key.'" style="display: none;">
';
  foreach ($val as $permlink => $ankor) {
    $ankor = mb_strtoupper($ankor);
    if ($permlink != 'name') {
      $str .= '<li class="nav-link1"><a href="'.$conf['siteUrl'].pageUrl()[0].'/'.$permlink.'" class="nav-item">'.$ankor.'</a></li>';
    } // if not category name
  } // foreach category services
$str .= '</ul></li>';
}
} // end foreach services
} // end if app
return $str;
}

function generateBreadCrumbs() {
$url = pageUrl();
global $conf;
global $data;
$str = '';
if (!empty($url)) {
$max_key = count($url) -1;
  $str .= '<li class="list-link"><a href="'.$conf['siteUrl'].'" class="list-item">Главная</a></li>
';
if ($max_key > 0) {
  $str .= '<li class="list-link"><a href="'.$conf['siteUrl'].$url[0].'" class="list-item">'.configs(__DIR__.'/blockchains/'.$url[0].'/config.json')['title'].'</a></li>
';
if ($max_key >= 2) {
  $str .= '<li class="list-link"><a href="'.$conf['siteUrl'].$url[0].'/'.$url[1].'" class="list-item">'.configs(__DIR__.'/blockchains/'.$url[0].'/apps/'.$url[1].'/config.json')['title'].'</a></li>
';
}
}
}
$str .= '<li class="active-link">'.$data['title'].'</li>';
return $str;
}

function isJSON($string) {
  $json = json_decode($string, true);
  return is_string($string) && is_array($json) ? ['approve' => true, 'data' => $json] : ['approve' => false, 'data' => $string];
}

function to_menu($blockchain, $permlink, $ankor, $category = 'no_category') {
  if ($blockchain !== '' && $blockchain !== '/' && is_dir(__DIR__.'/blockchains/'.$blockchain)) {
  $file = file_get_contents(__DIR__.'/menu.json');
  $taskList = json_decode($file, TRUE);
unset($file);
if ($blockchain == $permlink) {
  $taskList[$blockchain]['name'] = $ankor;
} else {
  $categories = ['no_category' => '', 'reytings' => 'Рейтинги', 'tools' => 'Инструменты', 'info' => 'Информация', 'games' => 'Игры'];
  $taskList[$blockchain]['services'][$category]['name'] = $categories[$category];
  $taskList[$blockchain]['services'][$category][$permlink] = $ankor;
}
file_put_contents(__DIR__.'/menu.json', json_encode($taskList, JSON_UNESCAPED_UNICODE));
unset($taskList);
}
}

function get404Page() {
  global $conf;
  header("HTTP/1.0 404 Not Found");
  $data = [];
  $data['title'] = 'Ошибка 404: страница не существует';
  $data['description'] = 'Вы попали на несуществующую страницу. Возможно ошиблись с url - проверьте.';
  $data['menu'] = generateMenu();
  $data['content'] = '<h2>Вероятно, вы ошиблись адресом страницы или данные были удалены.</h2>
<p>Проверьте url или перейдите на главную.</p>';
return $data;
}

function getPage($url) {
  $cache_url = 'caches/'.urlencode(basename($url));
  if (strpos($url, 'coingecko') !== false && strpos($url, '/markets') !== false) {
    $parameters = explode('?', $url)[1];
    $param = explode('&', $parameters);
    $vs_currency = explode('=', $param[0])[1];
    $symbol = explode('=', $param[1])[1];
    $cache_url = 'caches/markets-'.$vs_currency.'-'.$symbol;
  } else if (strpos($url, 'coingecko') !== false && strpos($url, '/ohlc') !== false) {
    $coin = explode('/', $url)[6];
    $vs_currency_with = explode('?vs_currency=', $url)[1];
    $vs_currency = explode('&days=', $vs_currency_with)[0];  
      $cache_url = 'caches/ohlc-'.$coin.'_'.$vs_currency;
  } else if (substr_count($url, '.') === 3) {
    $service = explode('/', $url)[3];
    if (strpos('?', $service) !== false) {
      [$name, $params] = explode('?', $service);
      $params = str_replace('&', '-', $params);
      $params = str_replace('=', '', $params);
      $cache_url = 'caches/'.$name.'-'.$params;
    } else {
      $cache_url = 'caches/'.$service;
    }
    }

  $cache_file = $cache_url.'.cache';
  if(file_exists($cache_file)) {
  if (strpos($url, 'cbr.ru') !== false && time() - filemtime($cache_file) > 43200) {
    $cache = file_get_contents($url);
    $t=explode("<Sell>", $cache);
    $t=explode("</Sell>", $t[1]);
    $count = count($t);
    if (isset($t) && $t[0]<>0 || $count > 14) {
      return;
    } else {
      file_put_contents($cache_file, $cache);
    }
  } else if (strpos($url, 'golos-api?service=top') !== false && time() - filemtime($cache_file) > 1800) {
      $cache = file_get_contents($url);
      file_put_contents($cache_file, $cache);
  } else if(time() - filemtime($cache_file) > 60) {
       // too old , re-fetch
       $cache = file_get_contents($url);
       file_put_contents($cache_file, $cache);
      } else {
      $cache = file_get_contents($cache_url.'.cache');
    }
  } else {
    // no cache, create one
    $cache = file_get_contents($url);
    file_put_contents($cache_file, $cache);
  }
return $cache;
}
?>