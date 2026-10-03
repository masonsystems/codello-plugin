---
type: regex
target: trace
pattern: '"file_path\\?"\s*:\s*\\?"[^"\\]*scratchpad/([\w.-]+)\\?"[\s\S]*codello spawn.{0,300}?--prompt-file\s+(?:\\*")?[^"\\\s]*scratchpad/\1'
---
