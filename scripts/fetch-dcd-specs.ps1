# Batch-fetch Dongchedi series spec lists WITH year-group structure preserved.
# car_list data layout: [year-group row(type 1137), trim rows..., year-group row, trim rows...]
param(
  [string]$OutFile = "$env:TEMP\dcd_specs.json"
)
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
$series = Get-Content "$env:TEMP\dcd_all_series.json" -Raw | ConvertFrom-Json
$result = @()
$n = 0
foreach ($s in $series) {
  $n++
  $u = "https://www.dongchedi.com/motor/pc/car/series/car_list?aid=1839&app_name=auto_web_pc&series_id=$($s.series_id)"
  $tmp = "$env:TEMP\dcd_spec_one.json"
  curl.exe -s --max-time 15 $u -A $ua -H "Referer: https://www.dongchedi.com/" -o $tmp
  $raw = Get-Content $tmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
  if (-not $raw -or $raw.Length -lt 50) { continue }
  try { $j = $raw | ConvertFrom-Json } catch { continue }

  # group trims under their year (group row name like "2026款-星愿" -> year 2026)
  $years = @()
  $curYear = ''
  $trimsByYear = [ordered]@{}
  foreach ($tab in $j.data.tab_list) {
    foreach ($item in $tab.data) {
      if ($item.type -eq '1137') {
        if ($item.info.name -match '^(\d{4})') {
          $curYear = $Matches[1]
          $years += $curYear
          if (-not $trimsByYear.Contains($curYear)) { $trimsByYear[$curYear] = @() }
        }
      } else {
        $nm = $item.info.car_name
        if ($nm -and $curYear) { $trimsByYear[$curYear] += $nm }
      }
    }
  }
  $groups = @()
  foreach ($k in $trimsByYear.Keys) {
    $groups += @{ y = $k; t = $trimsByYear[$k] }
  }
  $result += @{ sid = $s.series_id; brand = $s.brand_name; series = $s.series_name; groups = $groups }
  if ($n % 40 -eq 0) {
    Write-Output "[$n/$($series.Count)] $($s.brand_name)/$($s.series_name) -> yearGroups:$($groups.Count)"
    $result | ConvertTo-Json -Depth 5 -Compress | Out-File $OutFile -Encoding UTF8
  }
  Start-Sleep -Milliseconds 250
}
$result | ConvertTo-Json -Depth 5 -Compress | Out-File $OutFile -Encoding UTF8
Write-Output "DONE: $($result.Count) series -> $OutFile"
