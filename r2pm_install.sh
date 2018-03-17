R2PM_BEGIN

R2PM_GIT "https://github.com/securisec/r2decompile"
R2PM_DESC "[r2decompile] Use local opensource retdec to decompile functions"

R2PM_DOC="
usage: $r2decompile [-h] [-p] [-t FILE]

r2decompile help

Optional arguments:
  -h, --help  Show this help message and exit.
  -t TMP      Set temp file for decompiled code
  -p          Print dicompilation to stdout

Invoke from inside r2 shell with $dec
"

R2PM_INSTALL() {
    cd ${R2PM_GITDIR}r2decompile
    npm install
    cd -
	echo '$'dec="#"'!'"pipe node ${R2PM_GITDIR}r2decompile/r2decompile.js" >> ~/.radare2rc || exit 1
	echo "\n[+] r2decompile has been installed"
}

R2PM_UNINSTALL() {
	rm -rf "${R2PM_GITDIR}"/r2decompile
}

R2PM_END