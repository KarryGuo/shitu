$html = Get-Content "$env:TEMP\dcd_library.html" -Raw -Encoding UTF8
# 找到包含品牌数组的 JS 对象片段
$idx = $html.IndexOf('brand_list')
if ($idx -lt 0) { $idx = $html.IndexOf('brandList') }
if ($idx -lt 0) { $idx = $html.IndexOf('"logo"') }
Write-Output "anchor idx: $idx"
if ($idx -ge 0) {
  $start = [Math]::Max(0, $idx - 200)
  $snippet = $html.Substring($start, [Math]::Min(3000, $html.Length - $start))
  Write-Output $snippet
}
# 统计 logo URL 出现次数
$logos = [regex]::Matches($html, 'https://p\d*\.?dcarimg\.com[^"\\]+?\.(?:png|jpg|jpeg|webp)')
Write-Output "logo-ish urls: $($logos.Count)"
if ($logos.Count -gt 0) { $logos | Select-Object -First 5 | ForEach-Object { Write-Output "  $($_.Value)" } }
# 找品牌名模式
$m = [regex]::Matches($html, '"name":"([^"]{1,14})","logo"')
Write-Output "name+logo pairs: $($m.Count)"
