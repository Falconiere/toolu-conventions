# lint-syntax.sh — remove string contents before suppression-policy matching.
#
# These scanners are deliberately lexical rather than regex-only. Directive
# text is meaningful in a real JavaScript comment and Rust attributes are
# meaningful in Rust code; the same bytes inside a string are documentation.

gr_ls_script_syntax_reset() {
  GR_LS_JS_STATE=code
  GR_LS_JS_BRACE_DEPTH=0
  GR_LS_JS_BRACE_STACK=''
  GR_LS_JS_JSX_DEPTH=0
  GR_LS_JS_JSX_STACK=''
  GR_LS_JS_TAG_KIND=''
  GR_LS_JS_TAG_LAST=''
  case ${1-} in *.tsx|*.jsx|*.astro) GR_LS_JS_JSX_ENABLED=1 ;; *) GR_LS_JS_JSX_ENABLED=0 ;; esac
}

gr_ls_js_push_brace() {
  GR_LS_JS_BRACE_STACK="$1,$GR_LS_JS_BRACE_DEPTH;$GR_LS_JS_BRACE_STACK"
  GR_LS_JS_BRACE_DEPTH=1
  GR_LS_JS_STATE=code
}

gr_ls_js_pop_brace() {
  local frame
  frame=${GR_LS_JS_BRACE_STACK%%;*}
  GR_LS_JS_BRACE_STACK=${GR_LS_JS_BRACE_STACK#*;}
  GR_LS_JS_STATE=${frame%%,*}
  GR_LS_JS_BRACE_DEPTH=${frame#*,}
}

# A `<name` token is JSX only at an expression boundary. This also avoids
# mistaking TSX generic arrows (`<T,>` / `<T extends ...>`) for elements.
gr_ls_js_starts_jsx() {
  local line offset next prefix candidate
  [ "$GR_LS_JS_JSX_ENABLED" -eq 1 ] || return 1
  line=$1
  offset=$2
  next=${line:offset+1:1}
  case "$next" in /|'>'|[[:alpha:]_]) ;; *) return 1 ;; esac
  candidate=${line:offset+1}
  candidate=${candidate%%>*}
  if [[ $candidate =~ ^[[:alpha:]_][[:alnum:]_]*[[:space:]]*(,|extends([[:space:]]|$)) ]]; then
    return 1
  fi
  prefix=${line:0:offset}
  prefix=${prefix%"${prefix##*[![:space:]]}"}
  case "$prefix" in
    ''|*'=>'|*'return'|*'default'|*'yield'|*'await'|*'throw'|*'='|*'('|*'['|*'{'|*','|*':'|*'?'|*';'|*'!'|*'~'|*'+'|*'-'|*'*'|*'/'|*'%'|*'&'|*'|'|*'^') return 0 ;;
    *) return 1 ;;
  esac
}

gr_ls_js_start_root() {
  GR_LS_JS_JSX_STACK="code,$GR_LS_JS_JSX_DEPTH;$GR_LS_JS_JSX_STACK"
  GR_LS_JS_JSX_DEPTH=0
  GR_LS_JS_STATE=jsx_tag
  GR_LS_JS_TAG_KIND=$1
  GR_LS_JS_TAG_LAST=''
}

gr_ls_js_finish_root() {
  local frame
  frame=${GR_LS_JS_JSX_STACK%%;*}
  GR_LS_JS_JSX_STACK=${GR_LS_JS_JSX_STACK#*;}
  GR_LS_JS_STATE=${frame%%,*}
  GR_LS_JS_JSX_DEPTH=${frame#*,}
}

# gr_ls_script_syntax_line <line> — preserve JavaScript comments and code while
# replacing quoted/template text and rendered JSX text. Expressions inside
# templates and JSX return to code, keeping real lint comments visible.
gr_ls_script_syntax_line() {
  local line i length char next output
  line=$1
  i=0
  length=${#line}
  output=''
  while [ "$i" -lt "$length" ]; do
    char=${line:i:1}
    next=${line:i+1:1}
    case "$GR_LS_JS_STATE" in
      code)
        if [ "$char$next" = '//' ]; then
          output=${output}${line:i}
          i=$length
        elif [ "$char$next" = '/*' ]; then
          output=${output}'/*'
          GR_LS_JS_STATE=block
          i=$((i + 2))
        elif [ "$char" = '<' ] && gr_ls_js_starts_jsx "$line" "$i"; then
          output="${output} "
          i=$((i + 1))
          if [ "$next" = / ]; then
            output="${output} "
            i=$((i + 1))
            gr_ls_js_start_root close
          else
            gr_ls_js_start_root open
          fi
        else
          case "$char" in
            "'") output="${output} "; GR_LS_JS_STATE=single; i=$((i + 1)) ;;
            '"') output="${output} "; GR_LS_JS_STATE=double; i=$((i + 1)) ;;
            \`) output="${output} "; GR_LS_JS_STATE=template; i=$((i + 1)) ;;
            '{')
              [ "$GR_LS_JS_BRACE_DEPTH" -gt 0 ] && GR_LS_JS_BRACE_DEPTH=$((GR_LS_JS_BRACE_DEPTH + 1))
              output=${output}${char}
              i=$((i + 1))
              ;;
            '}')
              output=${output}${char}
              i=$((i + 1))
              if [ "$GR_LS_JS_BRACE_DEPTH" -gt 0 ]; then
                GR_LS_JS_BRACE_DEPTH=$((GR_LS_JS_BRACE_DEPTH - 1))
                [ "$GR_LS_JS_BRACE_DEPTH" -eq 0 ] && gr_ls_js_pop_brace
              fi
              ;;
            *) output=${output}${char}; i=$((i + 1)) ;;
          esac
        fi
        ;;
      block)
        output=${output}${char}
        i=$((i + 1))
        if [ "$char$next" = '*/' ]; then
          output=${output}${next}
          GR_LS_JS_STATE=code
          i=$((i + 1))
        fi
        ;;
      single|double)
        output="${output} "
        i=$((i + 1))
        if [ "$char" = '\\' ] && [ "$i" -lt "$length" ]; then
          output="${output} "
          i=$((i + 1))
        elif { [ "$GR_LS_JS_STATE" = single ] && [ "$char" = "'" ]; } \
          || { [ "$GR_LS_JS_STATE" = double ] && [ "$char" = '"' ]; }; then
          GR_LS_JS_STATE=code
        fi
        ;;
      template)
        output="${output} "
        i=$((i + 1))
        if [ "$char" = '\\' ] && [ "$i" -lt "$length" ]; then
          output="${output} "
          i=$((i + 1))
        elif [ "$char$next" = '${' ]; then
          output="${output} "
          i=$((i + 1))
          gr_ls_js_push_brace template
        elif [ "$char" = \` ]; then
          GR_LS_JS_STATE=code
        fi
        ;;
      jsx_text)
        output="${output} "
        i=$((i + 1))
        if [ "$char" = '<' ]; then
          GR_LS_JS_STATE=jsx_tag
          GR_LS_JS_TAG_KIND=open
          GR_LS_JS_TAG_LAST=''
          if [ "$next" = / ]; then
            output="${output} "
            i=$((i + 1))
            GR_LS_JS_TAG_KIND=close
          fi
        elif [ "$char" = '{' ]; then
          gr_ls_js_push_brace jsx_text
        fi
        ;;
      jsx_tag)
        output="${output} "
        i=$((i + 1))
        case "$char" in
          "'") GR_LS_JS_STATE=jsx_single ;;
          '"') GR_LS_JS_STATE=jsx_double ;;
          '{') gr_ls_js_push_brace jsx_tag ;;
          '>')
            if [ "$GR_LS_JS_TAG_KIND" = close ]; then
              GR_LS_JS_JSX_DEPTH=$((GR_LS_JS_JSX_DEPTH - 1))
              if [ "$GR_LS_JS_JSX_DEPTH" -eq 0 ]; then gr_ls_js_finish_root; else GR_LS_JS_STATE=jsx_text; fi
            elif [ "$GR_LS_JS_TAG_LAST" = / ]; then
              if [ "$GR_LS_JS_JSX_DEPTH" -eq 0 ]; then gr_ls_js_finish_root; else GR_LS_JS_STATE=jsx_text; fi
            else
              GR_LS_JS_JSX_DEPTH=$((GR_LS_JS_JSX_DEPTH + 1))
              GR_LS_JS_STATE=jsx_text
            fi
            ;;
          *) [ -n "${char//[[:space:]]/}" ] && GR_LS_JS_TAG_LAST=$char ;;
        esac
        ;;
      jsx_single|jsx_double)
        output="${output} "
        i=$((i + 1))
        if { [ "$GR_LS_JS_STATE" = jsx_single ] && [ "$char" = "'" ]; } \
          || { [ "$GR_LS_JS_STATE" = jsx_double ] && [ "$char" = '"' ]; }; then
          GR_LS_JS_STATE=jsx_tag
        fi
        ;;
    esac
  done
  GR_LS_SANITIZED=$output
}

gr_ls_rust_syntax_reset() {
  GR_LS_RUST_STATE=code
  GR_LS_RUST_COMMENT_DEPTH=0
  GR_LS_RUST_RAW_CLOSE=''
}

# gr_ls_rust_syntax_line <line> — preserve Rust code but erase comments and
# strings and character/byte literals. Rust block comments nest, and raw-string
# delimiters may contain any number of hashes, so both states persist across
# source lines.
gr_ls_rust_syntax_line() {
  local line i length char next output probe hashes close close_length
  line=$1
  i=0
  length=${#line}
  output=''
  while [ "$i" -lt "$length" ]; do
    char=${line:i:1}
    next=${line:i+1:1}
    case "$GR_LS_RUST_STATE" in
      code)
        if [ "$char$next" = '//' ]; then
          while [ "$i" -lt "$length" ]; do output="${output} "; i=$((i + 1)); done
        elif [ "$char$next" = '/*' ]; then
          output="${output}  "
          GR_LS_RUST_STATE=block
          GR_LS_RUST_COMMENT_DEPTH=1
          i=$((i + 2))
        elif [ "$char" = "'" ]; then
          probe=$((i + 1))
          if [ "$next" = '\\' ]; then
            while [ "$probe" -lt "$length" ]; do
              if [ "${line:probe:1}" = '\\' ]; then
                probe=$((probe + 2))
              elif [ "${line:probe:1}" = "'" ]; then
                break
              else
                probe=$((probe + 1))
              fi
            done
          else
            probe=$((probe + 1))
          fi
          if [ "$probe" -lt "$length" ] && [ "${line:probe:1}" = "'" ]; then
            while [ "$i" -le "$probe" ]; do output="${output} "; i=$((i + 1)); done
          else
            output=${output}${char}
            i=$((i + 1))
          fi
        elif [ "$char" = '"' ]; then
          output="${output} "
          GR_LS_RUST_STATE=string
          i=$((i + 1))
        elif [ "$char" = r ]; then
          probe=$((i + 1))
          hashes=''
          while [ "$probe" -lt "$length" ] && [ "${line:probe:1}" = '#' ]; do
            hashes=${hashes}'#'
            probe=$((probe + 1))
          done
          if [ "$probe" -lt "$length" ] && [ "${line:probe:1}" = '"' ]; then
            GR_LS_RUST_RAW_CLOSE='"'${hashes}
            GR_LS_RUST_STATE=raw
            while [ "$i" -le "$probe" ]; do output="${output} "; i=$((i + 1)); done
          else
            output=${output}${char}
            i=$((i + 1))
          fi
        else
          output=${output}${char}
          i=$((i + 1))
        fi
        ;;
      block)
        if [ "$char$next" = '/*' ]; then
          GR_LS_RUST_COMMENT_DEPTH=$((GR_LS_RUST_COMMENT_DEPTH + 1))
          output="${output}  "
          i=$((i + 2))
        elif [ "$char$next" = '*/' ]; then
          GR_LS_RUST_COMMENT_DEPTH=$((GR_LS_RUST_COMMENT_DEPTH - 1))
          output="${output}  "
          i=$((i + 2))
          [ "$GR_LS_RUST_COMMENT_DEPTH" -eq 0 ] && GR_LS_RUST_STATE=code
        else
          output="${output} "
          i=$((i + 1))
        fi
        ;;
      string)
        output="${output} "
        i=$((i + 1))
        if [ "$char" = '\\' ] && [ "$i" -lt "$length" ]; then
          output="${output} "
          i=$((i + 1))
        elif [ "$char" = '"' ]; then
          GR_LS_RUST_STATE=code
        fi
        ;;
      raw)
        close=$GR_LS_RUST_RAW_CLOSE
        close_length=${#close}
        if [ "${line:i:close_length}" = "$close" ]; then
          while [ "$close_length" -gt 0 ]; do
            output="${output} "
            i=$((i + 1))
            close_length=$((close_length - 1))
          done
          GR_LS_RUST_STATE=code
          GR_LS_RUST_RAW_CLOSE=''
        else
          output="${output} "
          i=$((i + 1))
        fi
        ;;
    esac
  done
  GR_LS_SANITIZED=$output
}
