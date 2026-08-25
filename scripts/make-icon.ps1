# 物色集 apple-touch-icon 生成脚本（零依赖，System.Drawing 手绘）
# 图标：雁字（icons/wild-geese.svg，2026 定稿）。改图标时同步重写本脚本。
# 用法：在仓库根目录执行  powershell -File scripts\make-icon.ps1

Add-Type -AssemblyName System.Drawing
$size = 180
$S = $size / 64.0   # svg-to-pixel scale
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

function New-C([int]$r, [int]$gg, [int]$b, [int]$a = 255) {
  return [System.Drawing.Color]::FromArgb($a, $r, $gg, $b)
}
function Fill-Ellipse([float]$cx, [float]$cy, [float]$rx, [float]$ry, [System.Drawing.Color]$c) {
  $b = New-Object System.Drawing.SolidBrush($c)
  $g.FillEllipse($b, ($cx-$rx)*$S, ($cy-$ry)*$S, 2*$rx*$S, 2*$ry*$S)
  $b.Dispose()
}

# ---- 夜空：月光青蓝渐层（4 站点） ----
$skyRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$sky = New-Object System.Drawing.Drawing2D.LinearGradientBrush($skyRect, [System.Drawing.Color]::Black, [System.Drawing.Color]::White, 90)
$blend = New-Object System.Drawing.Drawing2D.ColorBlend
$blend.Colors = [System.Drawing.Color[]]@(
  (New-C  58  88 118),   # 3A5876
  (New-C  90 122 146),   # 5A7A92
  (New-C 167 180 172),   # A7B4AC
  (New-C 218 196 156)    # DAC49C
)
$blend.Positions = [float[]]@(0, 0.52, 0.8, 1)
$sky.InterpolationColors = $blend
$g.FillRectangle($sky, 0, 0, $size, $size)
$sky.Dispose()

# ---- 满月与清辉 ----
Fill-Ellipse 44 20 24 24 (New-C 247 239 218 18)
Fill-Ellipse 44 20 19 19 (New-C 247 239 218 28)
Fill-Ellipse 44 20 13 13 (New-C 240 228 188)          # F0E4BC 底
Fill-Ellipse 38.4 16.1 10.5 10.5 (New-C 253 249 236)  # FDF9EC 亮心

# ---- 早星两点 ----
Fill-Ellipse  8  8 0.9 0.9 (New-C 242 235 214 153)
Fill-Ellipse 15 16 0.75 0.75 (New-C 242 235 214 115)

# ---- 天际余光（叠椭圆拟模糊） ----
Fill-Ellipse 18 51 30 5.8 (New-C 237 217 172 12)
Fill-Ellipse 18 51 28 4.5 (New-C 237 217 172 16)
Fill-Ellipse 18 51 24 3.4 (New-C 237 217 172 20)

# ---- 雁阵成「人」字：二次贝化三次绘制 ----
$goosePen = New-Object System.Drawing.Pen((New-C 28 39 51), (1.4*$S))
$goosePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$goosePen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
function Draw-Goose([float]$cx, [float]$cy, [float]$k) {
  $p0 = New-Object System.Drawing.PointF((($cx-3.4*$k)*$script:S), (($cy+0.9*$k)*$script:S))
  $p2 = New-Object System.Drawing.PointF(($cx*$script:S), (($cy+0.3*$k)*$script:S))
  $p3 = New-Object System.Drawing.PointF((($cx+3.4*$k)*$script:S), (($cy+0.9*$k)*$script:S))
  $q1 = New-Object System.Drawing.PointF((($cx-1.3*$k)*$script:S), (($cy-1.3*$k)*$script:S))
  $q2 = New-Object System.Drawing.PointF((($cx+1.3*$k)*$script:S), (($cy-1.3*$k)*$script:S))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  # 第一笔: p0 -Q(q1)- p2
  $c1 = New-Object System.Drawing.PointF(($p0.X + ($q1.X-$p0.X)*2/3), ($p0.Y + ($q1.Y-$p0.Y)*2/3))
  $c2 = New-Object System.Drawing.PointF(($p2.X + ($q1.X-$p2.X)*2/3), ($p2.Y + ($q1.Y-$p2.Y)*2/3))
  $path.AddBezier($p0, $c1, $c2, $p2)
  # 第二笔: p2 -Q(q2)- p3
  $c3 = New-Object System.Drawing.PointF(($p2.X + ($q2.X-$p2.X)*2/3), ($p2.Y + ($q2.Y-$p2.Y)*2/3))
  $c4 = New-Object System.Drawing.PointF(($p3.X + ($q2.X-$p3.X)*2/3), ($p3.Y + ($q2.Y-$p3.Y)*2/3))
  $path.AddBezier($p2, $c3, $c4, $p3)
  $script:g.DrawPath($goosePen, $path)
  $path.Dispose()
}
Draw-Goose 16   22   1.25
Draw-Goose 25   25.5 1.05
Draw-Goose 36   28   0.92
Draw-Goose 44   31   0.78
Draw-Goose 51.5 34.5 0.62
$goosePen.Dispose()

# ---- 西楼一角，檐角高挑 ----
$roof = New-Object System.Drawing.SolidBrush((New-C 24 35 46))  # 18232E
function P([float]$x, [float]$y) {
  return New-Object System.Drawing.PointF(($x*$script:S), ($y*$script:S))
}
$pMain = New-Object System.Drawing.Drawing2D.GraphicsPath
$pMain.AddLines([System.Drawing.PointF[]]@((P 0 64), (P 0 53.5)))
$pMain.AddBezier((P 0 53.5), (P 7 52.6), (P 13.4 50.4), (P 18 46.6))
$pMain.AddBezier((P 18 46.6), (P 20 44.9), (P 21.6 42.7), (P 22.6 40.2))
$pMain.AddLines([System.Drawing.PointF[]]@((P 25.2 41.4)))
$pMain.AddBezier((P 25.2 41.4), (P 24 44.6), (P 22.1 47.4), (P 19.5 49.8))
$pMain.AddBezier((P 19.5 49.8), (P 15.2 53.8), (P 8.6 56.6), (P 0 57.6))
$pMain.CloseFigure()
$g.FillPath($roof, $pMain); $pMain.Dispose()

$pUnder = New-Object System.Drawing.Drawing2D.GraphicsPath
$pUnder.AddBezier((P 0 61.4), (P 7.6 60.4), (P 14.6 57.4), (P 19.5 53.4))
$pUnder.AddLines([System.Drawing.PointF[]]@((P 19.5 49.8)))
$pUnder.AddBezier((P 19.5 49.8), (P 15.2 53.8), (P 8.6 56.6), (P 0 57.6))
$pUnder.CloseFigure()
$g.FillPath($roof, $pUnder); $pUnder.Dispose()
$roof.Dispose()
Fill-Ellipse 23.9 40.8 1.2 1.2 (New-C 24 35 46)

$out = Join-Path $PWD "apple-touch-icon.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "generated: $out"
