# folder-tree.sh — the allowed source tree shape.
#
# Three rules from one config block:
#   src.topLevel      the only directories permitted directly under srcRoot
#   src.nested        a glob-keyed allowlist of subdirectories, which is how
#                     intra-domain shape is expressed — "features/*" constrains
#                     every feature folder without naming any of them
#   src.requireReadme directories that must carry a README.md index
#
# src.topLevel OMITTED means unconstrained (the Rust stack: module names are
# arbitrary). An empty array means nothing is allowed. They are different, and
# the distinction is what keeps Rust usable.

# gr_ft_allow_for <parent-rel-dir> — the allowlist governing this directory's
# children, empty when no key matches (unconstrained). Reads the cached map;
# no subprocess.
gr_ft_allow_for() {
  parent=$1
  rest_map=$GR_NESTED_MAP
  while [ -n "$rest_map" ]; do
    entry=${rest_map%%;*}
    case "$rest_map" in *\;*) rest_map=${rest_map#*;} ;; *) rest_map='' ;; esac
    [ -n "$entry" ] || continue
    key=${entry%%|*}
    values=${entry#*|}
    case "$key" in
      */\*)
        # "features/*" governs the children of every direct child of features/
        prefix=${key%/\*}
        case "$parent" in
          "$prefix"/*)
            tail_seg=${parent#"$prefix"/}
            case "$tail_seg" in */*) ;; *) printf '%s' "$values"; return ;; esac
            ;;
        esac
        ;;
      "$parent")
        printf '%s' "$values"
        return
        ;;
      \*)
        # A bare "*" key governs every directory at any depth. The Rust stack
        # needs it: module names are arbitrary, but a module folder may still
        # only hold .rs parts and a sibling tests/.
        printf '%s' "$values"
        return
        ;;
    esac
  done
}

# gr_ft_check_dir <rel-dir> <display-path>
gr_ft_check_dir() {
  rel=$1
  shown=$2
  [ -n "$rel" ] && [ "$rel" != '.' ] || return 0

  top=${rel%%/*}
  if [ "$GR_TOPLEVEL_SET" = 'yes' ]; then
    case " $GR_TOPLEVEL " in
      *" $top "*) ;;
      *) gr_violation folder-tree "$shown" \
           "\"$top\" is not an allowed top-level directory under $GR_SRC_ROOT" \
           "move it under one of: $GR_TOPLEVEL" ;;
    esac
  fi

  parent=${rel%/*}
  leaf=${rel##*/}
  [ "$parent" = "$rel" ] && return 0

  allow=$(gr_ft_allow_for "$parent")
  [ -n "$allow" ] || return 0
  case " $allow " in
    *" $leaf "*) ;;
    *) gr_violation folder-tree "$shown" \
         "\"$leaf\" is not an allowed directory inside $GR_SRC_ROOT/$parent" \
         "use one of: $allow" ;;
  esac
}

gr_check_folder_tree() {
  mode=$1
  path=${2-}
  [ -d "$GR_SRC_ROOT" ] || return 0

  if [ "$mode" = 'file' ]; then
    # Validate the directory the edited file landed in and every directory above
    # it up to srcRoot — one new file can introduce several at once.
    dir=${path%/*}
    case "$dir" in "$GR_SRC_ROOT"/*) ;; *) return 0 ;; esac
    rel=${dir#"$GR_SRC_ROOT"/}
    while [ -n "$rel" ] && [ "$rel" != '.' ]; do
      gr_ft_check_dir "$rel" "$GR_SRC_ROOT/$rel"
      [ "$rel" = "${rel%/*}" ] && break
      rel=${rel%/*}
    done
    return 0
  fi

  while IFS= read -r dir; do
    gr_ft_check_dir "${dir#"$GR_SRC_ROOT"/}" "$dir"
  done < <(find "$GR_SRC_ROOT" -mindepth 1 -type d ! -path '*/node_modules/*' 2>/dev/null)

  for name in $GR_REQUIRE_README; do
    if [ -d "$GR_SRC_ROOT/$name" ] && [ ! -f "$GR_SRC_ROOT/$name/README.md" ]; then
      gr_violation folder-tree "$GR_SRC_ROOT/$name" \
        'missing README.md' \
        "add one from templates/folder-README.md — it is how an agent answers \"where does X live\" without reading the tree"
    fi
  done

  # Every domain folder carries its own README too, so a feature is
  # self-describing the moment it exists.
  rest_map=$GR_NESTED_MAP
  while [ -n "$rest_map" ]; do
    entry=${rest_map%%;*}
    case "$rest_map" in *\;*) rest_map=${rest_map#*;} ;; *) rest_map='' ;; esac
    key=${entry%%|*}
    case "$key" in */\*) ;; *) continue ;; esac
    prefix=${key%/\*}
    [ -d "$GR_SRC_ROOT/$prefix" ] || continue
    for domain in "$GR_SRC_ROOT/$prefix"/*/; do
      [ -d "$domain" ] || continue
      [ -f "${domain}README.md" ] || gr_violation folder-tree "${domain%/}" \
        'domain folder has no README.md' \
        'add one listing what belongs in this domain and what does not'
    done
  done
}
