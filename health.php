<?php
declare(strict_types=1);

// Keep this endpoint dependency-free. Deployment platforms use it to prove
// Apache + PHP are serving HTTP; database readiness is intentionally checked
// elsewhere so a cold database cannot turn a healthy web container into HTTP 500.
http_response_code(200);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

echo '{"status":"ok","app":"Great Solomon Manpower Services Inc. Core Transaction 4","php":"'.PHP_VERSION.'","timestamp":"'.date('c').'"}';
