Add-Type -AssemblyName System.Drawing
$size = 180
$s = $size / 64.0  # svg-to-pixel scale
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r, $r, 180, 90)
  $p.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $p.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
  $p.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $p.CloseFigure()
  return $p
}
function New-Color([int]$r, [int]$gg, [int]$b) {
  return [System.Drawing.Color]::FromArgb(255, $r, $gg, $b)
}
$cream = New-Color 249 244 231
$red   = New-Color 158 61 51
$redBrush = New-Object System.Drawing.SolidBrush($red)
$creamBrush = New-Object System.Drawing.SolidBrush($cream)

# pre-computed coordinates (scale s = 2.8125)
$bgX = 2*$s;   $bgY = 2*$s;   $bgW = 60*$s; $bgH = 60*$s; $bgR = 13*$s
$frX = 8*$s;   $frY = 8*$s;   $frW = 48*$s; $frH = 48*$s; $frR = 8*$s;  $frPenW = 2.5*$s
$bkX = 19*$s;  $bkY = 15*$s;  $bkW = 26*$s; $bkH = 34*$s; $bkR = 3*$s
$bdX = 19*$s;  $bdY = 15*$s;  $bdW = 7*$s;  $bdH = 34*$s
$sqX = 23*$s;  $sqY = 15*$s;  $sqW = 3*$s;  $sqH = 34*$s
$stX = 21.5*$s; $stW = 2*$s;  $stH = 3.5*$s; $stR = 1*$s
$lnX = 30*$s;  $lnW = 11*$s;  $lnH = 2.6*$s; $lnR = 1.3*$s

# seal background gradient
$bgRect = New-Object System.Drawing.RectangleF($bgX, $bgY, $bgW, $bgH)
$bgPath = New-RoundRect $bgX $bgY $bgW $bgH $bgR
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, (New-Color 176 80 63), (New-Color 138 51 43), 45)
$g.FillPath($brush, $bgPath)

# inner frame
$framePen = New-Object System.Drawing.Pen($cream, $frPenW)
$framePath = New-RoundRect $frX $frY $frW $frH $frR
$g.DrawPath($framePen, $framePath)

# book body (cream)
$bookPath = New-RoundRect $bkX $bkY $bkW $bkH $bkR
$g.FillPath($creamBrush, $bookPath)

# binding strip (red, rounded left, squared right)
$bindPath = New-RoundRect $bdX $bdY $bdW $bdH $bkR
$g.FillPath($redBrush, $bindPath)
$g.FillRectangle($redBrush, $sqX, $sqY, $sqW, $sqH)

# stitches (cream)
foreach ($yy in @(21, 27, 33, 39)) {
  $sy = $yy*$s
  $st = New-RoundRect $stX $sy $stW $stH $stR
  $g.FillPath($creamBrush, $st)
}

# text lines (red)
foreach ($yy in @(22, 29, 36)) {
  $ly = $yy*$s
  $ln = New-RoundRect $lnX $ly $lnW $lnH $lnR
  $g.FillPath($redBrush, $ln)
}

$out = Join-Path $PWD "apple-touch-icon.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "generated: $out"
