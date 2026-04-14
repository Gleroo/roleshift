# RoleShift Local Server — PowerShell HTTP Server
$port = 3000
$root = $PSScriptRoot

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  RoleShift running at http://localhost:$port" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".json" = "application/json"
  ".woff2"= "font/woff2"
}

try {
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $res  = $ctx.Response

    $urlPath = $req.Url.LocalPath
    if ($urlPath -eq "/") { $urlPath = "/index.html" }

    $filePath = Join-Path $root ($urlPath.TrimStart("/").Replace("/", "\"))

    if (Test-Path $filePath -PathType Leaf) {
      $ext  = [System.IO.Path]::GetExtension($filePath).ToLower()
      $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentType   = $mime
      $res.ContentLength64 = $bytes.Length
      $res.StatusCode    = 200
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $res.OutputStream.Write($body, 0, $body.Length)
    }

    $res.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
