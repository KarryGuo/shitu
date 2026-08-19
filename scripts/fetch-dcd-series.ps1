param(
  [string]$Month = '202607',
  [string]$OutFile = "$env:TEMP\dcd_all_series.json"
)
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
$all = @()
$offset = 0
$count = 100
$page = 0
while ($true) {
  $u = "https://www.dongchedi.com/motor/pc/car/rank_data?aid=1839&app_name=auto_web_pc&city_name=%E5%8C%97%E4%BA%AC&count=$count&offset=$offset&month=$Month&new_energy_type=&rank_data_type=11&brand_id=&price=&manufacturer=&series_type=&nation=0"
  $tmp = "$env:TEMP\dcd_page.json"
  curl.exe -s --max-time 25 $u -H "User-Agent: $ua" -H "Referer: https://www.dongchedi.com/" -o $tmp
  $raw = Get-Content $tmp -Raw -Encoding UTF8
  if (-not $raw) { Write-Output "page $page empty, stop"; break }
  $j = $raw | ConvertFrom-Json
  $list = $j.data.list
  if (-not $list -or $list.Count -eq 0) { Write-Output "page $page no list, stop"; break }
  $all += $list
  $page++
  Write-Output "page $page offset $offset got $($list.Count) total $($all.Count) has_more $($j.data.paging.has_more)"
  if (-not $j.data.paging.has_more) { break }
  $offset += $count
  Start-Sleep -Milliseconds 400
  if ($page -ge 40) { Write-Output "safety stop at 40 pages"; break }
}
$all | ConvertTo-Json -Depth 6 -Compress | Out-File $OutFile -Encoding UTF8
Write-Output "SAVED $($all.Count) series -> $OutFile"
# 品牌聚合统计
$brands = $all | Group-Object brand_name | Sort-Object Count -Descending
Write-Output "BRANDS: $($brands.Count)"
$brands | Select-Object -First 15 | ForEach-Object { Write-Output "  $($_.Name): $($_.Count)" }
