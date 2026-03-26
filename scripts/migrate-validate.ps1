$enc = [System.Text.UTF8Encoding]::new($false)
$root = "c:\Users\gusta\Desktop\gustavo-sotero.dev"

$routeFiles = @(
  "apps/api/src/routes/admin/posts.ts",
  "apps/api/src/routes/admin/projects.ts",
  "apps/api/src/routes/admin/tags.ts",
  "apps/api/src/routes/admin/education.ts",
  "apps/api/src/routes/admin/experience.ts",
  "apps/api/src/routes/admin/uploads.ts",
  "apps/api/src/routes/admin/comments.ts",
  "apps/api/src/routes/public/comments.ts"
)

foreach ($rel in $routeFiles) {
  $file = Join-Path $root $rel
  $content = [System.IO.File]::ReadAllText($file)
  
  # 1. Replace the 3-line parseBodyResult + validateBody + guard with 2-line parseAndValidateBody
  $pattern = '  const bodyResult = await parseBodyResult\(c\);\r?\n  const bv = validateBody\(c, (\w+), bodyResult\);\r?\n  if \(!bv\.ok\) return bv\.response;'
  $replacement = "  const bv = await parseAndValidateBody(c, `$1);`n  if (!bv.ok) return bv.response;"
  $content = [regex]::Replace($content, $pattern, $replacement)
  
  # 2. Remove standalone 'parseBodyResult' import from requestBody
  $content = $content -replace "import \{ parseBodyResult \} from '(\.\./)+lib/requestBody';`r?`n", ''
  
  # 3. Remove parseBodyResult from multi-function requestBody imports
  $content = $content -replace ', parseBodyResult', ''
  $content = $content -replace 'parseBodyResult, ', ''
  
  # 4. Add parseAndValidateBody to the validate import line
  $content = $content -replace "import \{ (validateBody|validateQuery)", "import { parseAndValidateBody, `$1"
  
  [System.IO.File]::WriteAllText($file, $content, $enc)
  
  $occurrences = ([regex]::Matches($content, 'parseAndValidateBody')).Count
  Write-Host "$(Split-Path $rel -Leaf): $occurrences x parseAndValidateBody"
}

Write-Host "Migration complete."
