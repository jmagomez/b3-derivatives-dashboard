"""Smoke test: garante que todos os scripts compilam sem erro de sintaxe."""
import pathlib
import py_compile

SCRIPTS = pathlib.Path(__file__).resolve().parent.parent / "scripts"


def test_all_scripts_compile():
    files = list(SCRIPTS.glob("*.py"))
    assert files, "nenhum script encontrado em scripts/"
    for f in files:
        py_compile.compile(str(f), doraise=True)
