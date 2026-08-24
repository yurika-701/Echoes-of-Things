Add-Type -AssemblyName System.Drawing
$size = 180
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Transparent)

# rounded rect path (outer seal)
$r = 28
$rect = New-Object System.Drawing.Rectangle(6, 6, ($size - 12), ($size - 12))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$path.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
$path.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
$path.CloseFigure()

# cinnabar gradient fill
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(176,80,63), [System.Drawing.Color]::FromArgb(138,51,43), 45)
$g.FillPath($brush, $path)

# inner frame (cream line)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(249,244,231), 5)
$inner = $rect
$inner.Inflate(-16, -16)
$innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$ir = 16
$innerPath.AddArc($inner.X, $inner.Y, $ir, $ir, 180, 90)
$innerPath.AddArc($inner.Right - $ir, $inner.Y, $ir, $ir, 270, 90)
$innerPath.AddArc($inner.Right - $ir, $inner.Bottom - $ir, $ir, $ir, 0, 90)
$innerPath.AddArc($inner.X, $inner.Bottom - $ir, $ir, $ir, 90, 90)
$innerPath.CloseFigure()
$g.DrawPath($pen, $innerPath)

# center glyph (KaiTi preferred)
$font = $null
foreach ($name in @("KaiTi", "STKaiti", "SimSun")) {
  try {
    $f = New-Object System.Drawing.Font($name, 92, [System.Drawing.FontStyle]::Bold)
    if ($f.Name -eq $name) { $font = $f; break }
  } catch {}
}
if (-not $font) { $font = New-Object System.Drawing.Font("serif", 92, [System.Drawing.FontStyle]::Bold) }
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(249,244,231))
$char = [char]0x7269  # CJK ideograph
$g.DrawString($char, $font, $white, (New-Object System.Drawing.RectangleF(0, -4, $size, $size)), $fmt)

$out = Join-Path $PWD "apple-touch-icon.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "generated: $out"
