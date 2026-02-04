<?php if (!defined("NOTLOAD")) exit("No direct script access allowed");

function cmp_function_desc($a, $b) {
  $sa = isset($a["stake"]) ? (string)$a["stake"] : "0";
  $sb = isset($b["stake"]) ? (string)$b["stake"] : "0";
  // compare big integers as strings
  if (strlen($sa) === strlen($sb)) return strcmp($sb, $sa);
  return (strlen($sa) < strlen($sb)) ? 1 : -1;
}

function http_get_json($url) {
  $ctx = stream_context_create([
    "http" => [
      "timeout" => 12,
      "method" => "GET",
      "header" => "User-Agent: validators-list/1.0\r\nAccept: application/json\r\n"
    ]
  ]);

  $raw = @file_get_contents($url, false, $ctx);
  if ($raw === false) throw new Exception("HTTP request failed: " . $url);

  $json = json_decode($raw, true);
  if (!is_array($json)) throw new Exception("Invalid JSON: " . $url);

  return $json;
}

// Convert big integer string in wei-like units (1e18) to decimal string with limited precision
function wei18_to_del($weiStr, $precision = 3) {
  $s = preg_replace("/[^0-9]/", "", (string)$weiStr);
  if ($s === "") $s = "0";

  // Prefer bc math if available
  if (function_exists("bcdiv")) {
    $scale = max(18, $precision);
    $v = bcdiv($s, "1000000000000000000", $scale); // 1e18
    // trim to precision
    if ($precision >= 0) {
      if (strpos($v, ".") !== false) {
        list($i, $f) = explode(".", $v, 2);
        $f = substr($f . str_repeat("0", $precision), 0, $precision);
        $v = $i . ($precision > 0 ? "." . $f : "");
      } else {
        $v = $v . ($precision > 0 ? "." . str_repeat("0", $precision) : "");
      }
    }
    return $v;
  }

  // Fallback without BCMath: approximate using string slicing
  // integer part
  if (strlen($s) <= 18) {
    $intPart = "0";
    $fracRaw = str_pad($s, 18, "0", STR_PAD_LEFT);
  } else {
    $intPart = substr($s, 0, -18);
    $fracRaw = substr($s, -18);
  }

  if ($precision <= 0) return $intPart;

  $frac = substr($fracRaw, 0, $precision);
  return $intPart . "." . $frac;
}

function fetch_all_validators($baseUrl, $limit = 200) {
  $offset = 0;
  $all = [];
  $total = null;

  while (true) {
    $url = $baseUrl . "?limit=" . (int)$limit . "&offset=" . (int)$offset;
    $json = http_get_json($url);
    if (!isset($json["Ok"]) || $json["Ok"] !== true) break;
    if (!isset($json["Result"]) || !is_array($json["Result"])) break;

    $result = $json["Result"];

    if ($total === null && isset($result["count"])) $total = (int)$result["count"];
    $chunk = isset($result["validators"]) && is_array($result["validators"]) ? $result["validators"] : [];
    if (count($chunk) === 0) break;

    foreach ($chunk as $v) $all[] = $v;

    $offset += $limit;

    if ($offset > 20000) break;
    }
  return $all;
}

try {
  // Новый endpoint, который ты показал по факту
  $validatorsUrl = "https://api.decimalchain.com/api/v1/validators/validators";

  // Если у тебя есть прямой endpoint api.decimalchain.com, лучше перейти на него.
  // Но оставляю домен как в твоем примере, чтобы "строго как было".
  $all = fetch_all_validators($validatorsUrl, 200);

  $active = [];
  $candidates = [];

  foreach ($all as $v) {
    $kind = isset($v["kind"]) ? (string)$v["kind"] : "";
    if ($kind === "Approved") $active[] = $v;
    else $candidates[] = $v;
  }

  uasort($active, "cmp_function_desc");
  uasort($candidates, "cmp_function_desc");

  $num = [];
  $num["online"] = 0;
  $num["offline"] = 0;
  $num["candidate"] = 0;

  $validators = [];
  $validators[2] = "<h2><a name=\"2\">Активные валидаторы</a></h2>
<table><thead><tr><th>№ Статус</th>
<th>Адрес</th>
<th>Название</th>
<th>Stake</th>
<th>Комиссия</th>
<th>Пропущено блоков</th>
</tr></thead><tbody>";

  $validators[1] = "<h2><a name=\"1\">Кандидаты</a></h2>
<table><thead><tr><th>№ Статус</th>
<th>Адрес</th>
<th>Название</th>
<th>Stake</th>
<th>Комиссия</th>
<th>Пропущено блоков</th>
</tr></thead><tbody>";

  $renderRow = function($validator, &$num, $sectionIdx) use (&$validators) {
    $status = isset($validator["status"]) ? (string)$validator["status"] : "candidate";
    if (!isset($num[$status])) $num[$status] = 0;
    $num[$status]++;
    $address = isset($validator["evmAddress"]) ? (string)$validator["evmAddress"] : "";
    $moniker = isset($validator["moniker"]) ? (string)$validator["moniker"] : "";

    $stakeWei = isset($validator["stake"]) ? (string)$validator["stake"] : "0";
    $minsWei = isset($validator["mins"]) ? (string)$validator["mins"] : "0";

    $stake = wei18_to_del($stakeWei, 3);
    $mins = wei18_to_del($minsWei, 3);

    $feeRaw = isset($validator["fee"]) ? (string)$validator["fee"] : "0";
    $feePct = round(((float)$feeRaw) * 100, 2);

    $skipped = isset($validator["skippedBlocks"]) ? (int)$validator["skippedBlocks"] : 0;

    $id = "validator_" . $sectionIdx . "_" . $num[$status] . "_key";

    $validators[$sectionIdx] .= "<tr><td>".$num[$status]." ".$status."</td>
<td><input type=\"text\" readonly id=\"".$id."\" value=\"".$address."\"> (<input type=\"button\" onclick=\"copyText('".$id."');\" value=\"копировать\">)</td>";

    if ($moniker === "" || $moniker === $address) $validators[$sectionIdx] .= "<td></td>";
    else $validators[$sectionIdx] .= "<td>".$moniker."</td>";

    $validators[$sectionIdx] .= "<td>".$stake." DEL (Мин. ".$mins.")</td>
<td>".$feePct."%</td>
<td>".$skipped."</td>
</tr>";
  };

  foreach ($active as $v) $renderRow($v, $num, 2);
  foreach ($candidates as $v) $renderRow($v, $num, 1);

  $validators[1] .= "</tbody></table>
<p align=\"center\"><a href=\"#contents\">К оглавлению</a></p>";
  $validators[2] .= "</tbody></table>
<p align=\"center\"><a href=\"#contents\">К оглавлению</a></p>";

  $content = "<h2><a name=\"contents\">Оглавление</a></h2>
<ul><li><a href=\"#2\">Активные</a></li>
<li><a href=\"#1\">Кандидаты</a></li></ul>
".$validators[2]."
".$validators[1];

  return $content;

} catch (Exception $e) {
  return "<p>Список валидаторов не найден или ошибка соединения с API.</p>";
}
?>
