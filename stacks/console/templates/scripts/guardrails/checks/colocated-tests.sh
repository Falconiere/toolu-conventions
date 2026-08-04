# colocated-tests.sh — tests live beside the code they exercise.
#
# A test in a sibling __tests__/ (TS) or tests/ (Rust) is found by whoever opens
# the file it covers. A centralized test tree is found by nobody, and drifts.
#
# testGlob is load-bearing rather than cosmetic: marketing deliberately matches
# *.test.tsx as well as *.test.ts, because an interactive React island is a
# documented option there and a gate that only saw .test.ts would let a
# misplaced component test through.

gr_ct_is_test() {
  target=${1##*/}
  for glob in $GR_TEST_GLOB; do
    # shellcheck disable=SC2254
    case "$target" in $glob) return 0 ;; esac
  done
  return 1
}

gr_check_colocated_tests() {
  mode=$1
  path=${2-}
  if [ "$mode" = 'file' ]; then
    gr_ct_is_test "$path" || return 0
    case "$path" in
      *"/$GR_TEST_DIR/"*) return 0 ;;
      *) gr_violation colocated-tests "$path" \
           "test file outside a $GR_TEST_DIR/ directory" \
           "move it to a sibling $GR_TEST_DIR/ beside the file it covers" ;;
    esac
    return 0
  fi

  # A centralized test tree, by any of its usual names.
  for centralized in "$GR_SRC_ROOT/__tests__" "$GR_SRC_ROOT/tests" tests test; do
    [ "$centralized" = "$GR_SRC_ROOT/$GR_TEST_DIR" ] && continue
    # Rust's crate-root tests/ is the documented integration-test surface.
    [ "$centralized" = 'tests' ] && [ "$GR_TEST_DIR" = 'tests' ] && continue
    if [ -d "$centralized" ]; then
      gr_violation colocated-tests "$centralized" \
        'centralized test directory' \
        "colocate each test in a sibling $GR_TEST_DIR/ instead"
    fi
  done

  [ -d "$GR_SRC_ROOT" ] || return 0
  while IFS= read -r f; do
    gr_ct_is_test "$f" || continue
    case "$f" in
      *"/$GR_TEST_DIR/"*) ;;
      *) gr_violation colocated-tests "$f" \
           "test file outside a $GR_TEST_DIR/ directory" \
           "move it to a sibling $GR_TEST_DIR/ beside the file it covers" ;;
    esac
  done < <(find "$GR_SRC_ROOT" -type f ! -path '*/node_modules/*' 2>/dev/null)
}
