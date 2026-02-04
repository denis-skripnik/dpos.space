<?php
/**
 * UIA deposit-address endpoint with structured errors.
 *
 * Query:
 *   ?asset=YMTRX&login=denis-skripnik
 *
 * Response (always JSON):
 *   {"ok":true,"address":"...","memo":"..."}
 *   {"ok":false,"error":{"code":"...","message":"...","status":502}}
 *
 * Notes:
 * - Uses blockchain metadata (database_api.get_assets) to find deposit.to_api
 * - Fetches the upstream address server-side (avoids CORS)
 * - SSRF-protected without hardcoding gateway domains
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/helpers.php';

use GrapheneNodeClient\Commands\CommandQueryData;
use GrapheneNodeClient\Commands\Single\GetAssetsCommand;

// PHP 7.x polyfills
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool {
        if ($needle === '') return true;
        return strpos($haystack, $needle) === 0;
    }
}
if (!function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool {
        if ($needle === '') return true;
        $len = strlen($needle);
        return $len === 0 ? true : (substr($haystack, -$len) === $needle);
    }
}

function respond(array $payload): void {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function err(string $code, string $message, array $extra = []): void {
    respond(array_merge([
        'ok' => false,
        'error' => array_merge([
            'code' => $code,
            'message' => $message,
        ], $extra),
    ]));
}

function ok(string $address, string $memo = ''): void {
    $out = ['ok' => true, 'address' => $address];
    if ($memo !== '') $out['memo'] = $memo;
    respond($out);
}

function safeJsonDecode(string $s): array {
    $s = trim($s);
    if ($s === '') return [];
    $d = json_decode($s, true);
    return is_array($d) ? $d : [];
}

// ---------------------- SSRF protection helpers ----------------------

function isForbiddenIpv4(string $ip): bool {
    $long = ip2long($ip);
    if ($long === false) return true;

    $ranges = [
        ['0.0.0.0',     '0.255.255.255'],     // 0/8
        ['10.0.0.0',    '10.255.255.255'],    // private
        ['100.64.0.0',  '100.127.255.255'],   // CGNAT
        ['127.0.0.0',   '127.255.255.255'],   // loopback
        ['169.254.0.0', '169.254.255.255'],   // link-local
        ['172.16.0.0',  '172.31.255.255'],    // private
        ['192.168.0.0', '192.168.255.255'],   // private
        ['224.0.0.0',   '239.255.255.255'],   // multicast
        ['240.0.0.0',   '255.255.255.255'],   // reserved
    ];

    foreach ($ranges as $r) {
        $a = ip2long($r[0]);
        $b = ip2long($r[1]);
        if ($a !== false && $b !== false && $long >= $a && $long <= $b) return true;
    }
    return false;
}

function isForbiddenIp(string $ip): bool {
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) return isForbiddenIpv4($ip);

    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $lower = strtolower($ip);
        if ($lower === '::1') return true; // loopback
        // ULA fc00::/7
        if (str_starts_with($lower, 'fc') || str_starts_with($lower, 'fd')) return true;
        // link-local fe80::/10 (coarse)
        if (str_starts_with($lower, 'fe8') || str_starts_with($lower, 'fe9') || str_starts_with($lower, 'fea') || str_starts_with($lower, 'feb')) return true;
        return false;
    }

    return true;
}

function chooseSafeIpv4(string $host): ?string {
    $ips = gethostbynamel($host);
    if (!is_array($ips) || count($ips) === 0) return null;

    foreach ($ips as $ip) {
        if (!is_string($ip) || $ip === '') continue;
        if (!isForbiddenIp($ip)) return $ip;
    }
    return null;
}

/**
 * Fetch upstream JSON safely and return only allowed keys:
 * - address (required)
 * - memo (optional) OR tag (mapped to memo)
 *
 * Returns:
 *   ['ok'=>true,'address'=>...,'memo'=>...]
 *   ['ok'=>false,'error'=>['code'=>...,'message'=>...,'status'=>...]]
 */
function safeFetchAddress(string $url): array {
    $parts = parse_url($url);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return ['ok' => false, 'error' => ['code' => 'bad_url', 'message' => 'Bad to_api URL']];
    }

    $scheme = strtolower((string)$parts['scheme']);
    $host = (string)$parts['host'];

    if ($scheme !== 'https') {
        return ['ok' => false, 'error' => ['code' => 'scheme_not_allowed', 'message' => 'Only https is allowed']];
    }
    if (isset($parts['user']) || isset($parts['pass'])) {
        return ['ok' => false, 'error' => ['code' => 'auth_not_allowed', 'message' => 'URL auth is not allowed']];
    }

    $port = isset($parts['port']) ? (int)$parts['port'] : 443;
    if ($port !== 443) {
        return ['ok' => false, 'error' => ['code' => 'port_not_allowed', 'message' => 'Only port 443 is allowed']];
    }

    // Optional extra guard: disallow our own domain
    $hostLower = strtolower($host);
    if ($hostLower === 'dpos.space' || str_ends_with($hostLower, '.dpos.space')) {
        return ['ok' => false, 'error' => ['code' => 'blocked_self_domain', 'message' => 'Blocked by security policy']];
    }

    $ip = chooseSafeIpv4($host);
    if ($ip === null) {
        return ['ok' => false, 'error' => ['code' => 'dns_failed', 'message' => 'DNS resolve failed or blocked']];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false, // no redirects
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'uia-deposit-proxy',
        CURLOPT_LOW_SPEED_LIMIT => 1,
        CURLOPT_LOW_SPEED_TIME => 10,
        // Pin resolved IP to reduce DNS rebinding risk
        CURLOPT_RESOLVE => [$host . ':443:' . $ip],
    ]);

    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $cerr = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($body === false) {
        return [
            'ok' => false,
            'error' => [
                'code' => 'upstream_curl',
                'message' => 'Gateway request failed',
                'status' => 0,
                'curl_errno' => $errno,
            ],
        ];
    }

    if ($status < 200 || $status >= 300) {
        return [
            'ok' => false,
            'error' => [
                'code' => 'upstream_http',
                'message' => 'Gateway responded with error',
                'status' => $status,
            ],
        ];
    }

    $data = json_decode((string)$body, true);
    if (!is_array($data)) {
        return [
            'ok' => false,
            'error' => [
                'code' => 'upstream_nonjson',
                'message' => 'Gateway returned non-JSON',
                'status' => $status,
            ],
        ];
    }

    $address = $data['address'] ?? null;
    if (!is_string($address) || trim($address) === '') {
        return [
            'ok' => false,
            'error' => [
                'code' => 'upstream_no_address',
                'message' => 'Gateway did not return address',
                'status' => $status,
            ],
        ];
    }

    $memo = $data['memo'] ?? $data['tag'] ?? '';
    $memo = is_string($memo) ? trim($memo) : '';

    $out = ['ok' => true, 'address' => trim($address)];
    if ($memo !== '') $out['memo'] = $memo;
    return $out;
}

// ---------------------- Main endpoint logic ----------------------

$asset = isset($_GET['asset']) ? strtoupper(trim((string)$_GET['asset'])) : '';
$login = isset($_GET['login']) ? trim((string)$_GET['login']) : '';

if ($asset === '' || $login === '') err('bad_request', 'Missing asset or login');

// Symbol validation: 2..16 chars, A-Z0-9 only
if (!preg_match('/^[A-Z0-9]{2,16}$/', $asset)) err('bad_asset', 'Bad asset symbol');

// Username validation (soft): keep it permissive
if (strlen($login) < 3 || strlen($login) > 32) err('bad_login', 'Bad login');

try {
    $connector_class = CONNECTORS_MAP['golos'] ?? null;
    if (!$connector_class || !is_string($connector_class)) err('config_error', 'Connector is not configured');

    $connector = new $connector_class();

    $commandQuery = new CommandQueryData();

    // database_api.get_assets(creator, symbols, from, limit, sort) - without query
    $command_data = [
        '0' => '',               // creator
        '1' => [$asset],         // symbols
        '2' => '',               // from
        '3' => 1,                // limit
        '4' => 'by_symbol_name', // sort
    ];
    $commandQuery->setParams($command_data);

    $command = new GetAssetsCommand($connector);
    $res = $command->execute($commandQuery);

    if (!is_array($res) || !isset($res['result'][0]) || !is_array($res['result'][0])) {
        err('asset_not_found', 'Asset not found');
    }

    $assetObj = $res['result'][0];
    $metaStr = (isset($assetObj['json_metadata']) && is_string($assetObj['json_metadata'])) ? $assetObj['json_metadata'] : '';
    $meta = safeJsonDecode($metaStr);

    if (!isset($meta['deposit']) || !is_array($meta['deposit'])) {
        err('no_deposit_meta', 'No deposit metadata');
    }

    $deposit = $meta['deposit'];

    if (isset($deposit['unavailable']) && $deposit['unavailable'] === true) {
        err('deposit_unavailable', 'Deposit is unavailable');
    }

    $toType = isset($deposit['to_type']) ? (string)$deposit['to_type'] : '';
    if ($toType !== 'api') {
        err('unsupported_to_type', 'Deposit is not API-based');
    }

    $toApi = isset($deposit['to_api']) ? (string)$deposit['to_api'] : '';
    if ($toApi === '') err('no_to_api', 'Missing to_api');

    $url = str_replace('<account>', rawurlencode($login), $toApi);

    $f = safeFetchAddress($url);
    if (!isset($f['ok']) || $f['ok'] !== true) {
        // pass through structured upstream error
        $e = $f['error'] ?? ['code' => 'unknown', 'message' => 'Unknown error'];
        err((string)($e['code'] ?? 'unknown'), (string)($e['message'] ?? 'Unknown error'), $e);
    }

    $address = (string)$f['address'];
    $memo = isset($f['memo']) ? (string)$f['memo'] : '';
    ok($address, $memo);

} catch (Throwable $e) {
    err('rpc_failed', 'Blockchain request failed');
}
