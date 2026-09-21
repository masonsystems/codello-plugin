---
type: regex
target: last_message
pattern: '\$\(\s*cat\s+"?(/tmp|/private/tmp|\$TMPDIR|\$\{TMPDIR)(?![^"\n)]*/scratchpad/)'
match: not_contains
---
