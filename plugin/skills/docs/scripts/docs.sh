#!/usr/bin/env bash
# Fetch https://codello.app/docs and answer questions from it.
#
#   docs.sh index              section headings with their #anchors
#   docs.sh search <terms...>  case-insensitive grep with context (terms ORed)
#   docs.sh section <anchor>   one section, e.g. `section push-notifications`
#   docs.sh all                the whole page as text
#
# The site publishes the docs as ONE HTML page with no search API or
# llms.txt, so this strips the page to text locally. The page is ~30 KB,
# so fetching it per call is cheaper than maintaining a cache that can
# go stale against a deploy.
set -euo pipefail

DOCS_URL="${CODELLO_DOCS_URL:-https://codello.app/docs}"

fetch_text() {
  curl -fsSL --max-time 20 "$DOCS_URL" | perl -0777 -pe '
    s{<script\b.*?</script>}{}gsi; s{<style\b.*?</style>}{}gsi;
    s{.*?<main\b[^>]*>}{}si; s{</main>.*}{}si;
    # h2 carries the anchor id; keep it so answers can link to #section.
    s{<h2[^>]*id="([^"]+)"[^>]*>(.*?)</h2>}{\n\n## $2   [#$1]\n}gsi;
    s{<h3[^>]*>(.*?)</h3>}{\n### $1\n}gsi;
    s{<h4[^>]*>(.*?)</h4>}{\n#### $1\n}gsi;
    s{<(pre|div class="code-block")[^>]*>(.*?)</\1>}{"\n```\n".($2=~s/<[^>]+>//gr)."\n```\n"}gsie;
    s{<li[^>]*>}{\n- }gi; s{<br\s*/?>}{\n}gi;
    s{</(p|ul|ol|tr|table|div)>}{\n}gi; s{</t[dh]>}{\t}gi;
    s{<code[^>]*>(.*?)</code>}{`$1`}gsi;
    s{<[^>]+>}{}g;
    s/&amp;/&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g; s/&#39;/\x27/g; s/&nbsp;/ /g;
    s/[ \t]+\n/\n/g; s/\n{3,}/\n\n/g;
  '
}

cmd="${1:-}"; shift || true
case "$cmd" in
  index)
    fetch_text | grep -E '^## ' | sed -E 's/^## (.*)   \[#(.*)\]$/\2\t\1/'
    ;;
  search)
    [ $# -gt 0 ] || { echo "usage: docs.sh search <terms...>" >&2; exit 2; }
    pattern=$(printf '%s|' "$@"); pattern="${pattern%|}"
    # Exit 0 on no match too: "not in the docs" is an answer, not a failure.
    fetch_text | grep -n -i -E -B2 -A8 -- "$pattern" || echo "(no match for: $pattern)"
    ;;
  section)
    [ $# -eq 1 ] || { echo "usage: docs.sh section <anchor>" >&2; exit 2; }
    fetch_text | awk -v a="[#$1]" 'index($0, a) && /^## / {p=1; print; next} p && /^## / {exit} p'
    ;;
  all)
    fetch_text
    ;;
  *)
    sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2
    ;;
esac
