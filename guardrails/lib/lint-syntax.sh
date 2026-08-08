# lint-syntax.sh — remove string contents before suppression-policy matching.
#
# These scanners are deliberately lexical rather than regex-only. Directive
# text is meaningful in a real JavaScript comment and Rust attributes are
# meaningful in Rust code; the same bytes inside a string are documentation.

gr_ls_script_syntax_reset() {
  GR_LS_JS_STATE=code
  GR_LS_JS_EXPR_DEPTH=0
  GR_LS_JS_TEMPLATE_STACK=''
}

# gr_ls_script_syntax_line <line> — preserve JavaScript comments and code while
# replacing quoted/template text. Template expressions return to normal code,
# so a real comment inside ${...} remains visible to the policy check.
gr_ls_script_syntax_line() {
  local line i length char next output return_depth rest
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
        else
          case "$char" in
            "'") output="${output} "; GR_LS_JS_STATE=single; i=$((i + 1)) ;;
            '"') output="${output} "; GR_LS_JS_STATE=double; i=$((i + 1)) ;;
            \`)
              GR_LS_JS_TEMPLATE_STACK="$GR_LS_JS_EXPR_DEPTH $GR_LS_JS_TEMPLATE_STACK"
              GR_LS_JS_EXPR_DEPTH=0
              GR_LS_JS_STATE=template
              output="${output} "
              i=$((i + 1))
              ;;
            '{')
              [ "$GR_LS_JS_EXPR_DEPTH" -gt 0 ] && GR_LS_JS_EXPR_DEPTH=$((GR_LS_JS_EXPR_DEPTH + 1))
              output=${output}${char}
              i=$((i + 1))
              ;;
            '}')
              output=${output}${char}
              i=$((i + 1))
              if [ "$GR_LS_JS_EXPR_DEPTH" -gt 0 ]; then
                GR_LS_JS_EXPR_DEPTH=$((GR_LS_JS_EXPR_DEPTH - 1))
                [ "$GR_LS_JS_EXPR_DEPTH" -eq 0 ] && GR_LS_JS_STATE=template
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
          GR_LS_JS_EXPR_DEPTH=1
          GR_LS_JS_STATE=code
        elif [ "$char" = \` ]; then
          return_depth=${GR_LS_JS_TEMPLATE_STACK%% *}
          rest=${GR_LS_JS_TEMPLATE_STACK#* }
          GR_LS_JS_TEMPLATE_STACK=$rest
          GR_LS_JS_EXPR_DEPTH=${return_depth:-0}
          GR_LS_JS_STATE=code
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
# strings. Rust block comments nest, and raw-string delimiters may contain any
# number of hashes, so both states persist across source lines.
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
