# 拉取汽车之家车型库全部字母页（A-Z），解析品牌(含logo)+厂商+车系
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
$letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray()
$allBrands = @()

foreach ($L in $letters) {
  $tmp = "$env:TEMP\ah_$L.html"
  curl.exe -s --max-time 25 "https://www.autohome.com.cn/grade/carhtml/$L.html" -A $ua -o $tmp
  $raw = Get-Content $tmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
  if (-not $raw -or $raw.Length -lt 500) { Write-Output "$L -> empty"; continue }

  # 品牌块：<dl id="75" ...><dt><a href="...brand-75.html"><img ... src="//car2.autoimg.cn/....png"></a><div><a ...>比亚迪</a></div></dt>
  $brandMatches = [regex]::Matches($raw, '<dl id="(\d+)".*?<dt>.*?src="([^"]+)".*?<div><a[^>]*>([^<]+)</a></div></dt>(.*?)(?=<dl id=|$)', [System.Text.RegularExpressions.RegexOptions]::Singleline)

  $brandCount = 0
  foreach ($bm in $brandMatches) {
    $brandId = $bm.Groups[1].Value
    $logo = $bm.Groups[2].Value
    $brandName = $bm.Groups[3].Value.Trim()
    $body = $bm.Groups[4].Value

    # 车系条目：<li id="s7538"><h4><a ...>元UP</a></h4>
    $seriesMatches = [regex]::Matches($body, '<li id="s(\d+)">\s*<h4><a[^>]*>([^<]+)</a></h4>')
    $seriesList = @()
    foreach ($sm in $seriesMatches) {
      $seriesList += @{ id = $sm.Groups[1].Value; name = $sm.Groups[2].Value.Trim() }
    }
    if ($seriesList.Count -gt 0) {
      $allBrands += @{
        letter  = [string]$L
        id      = $brandId
        name    = $brandName
        logo    = $logo
        series  = $seriesList
      }
      $brandCount++
    }
  }
  Write-Output "$L -> brands: $brandCount"
  Start-Sleep -Milliseconds 300
}

$out = "$env:TEMP\ah_brands_all.json"
$allBrands | ConvertTo-Json -Depth 5 -Compress | Out-File $out -Encoding UTF8
$totalSeries = ($allBrands | ForEach-Object { $_.series.Count } | Measure-Object -Sum).Sum
Write-Output "SAVED $($allBrands.Count) brands / $totalSeries series -> $out"
