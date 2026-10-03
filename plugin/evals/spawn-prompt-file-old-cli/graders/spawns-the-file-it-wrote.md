---
type: regex
target: trace
pattern: '"file_path\\?"\s*:\s*\\?"[^"\\]*scratchpad/([\w.-]+)\\?"[\s\S]*codello spawn.{0,300}?\$\(\s*cat\s+(?:\\*")?[^"\\)\s]*scratchpad/\1'
---
