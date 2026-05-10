import os, sys

DEFAULT_EXCEL_PATH = "Chromascope_file.xlsx"

if __name__ == "__main__":
    args         = sys.argv[1:]
    excel_path   = DEFAULT_EXCEL_PATH
    run_examples = False

    for arg in args:
        if arg == "--examples": run_examples = True
        elif not arg.startswith("--"): excel_path = arg

    if not os.path.exists(excel_path):
        print(f"\n[ERROR] File not found: {excel_path}")
        print("Usage: python main.py your_file.xlsx [--examples]")
        sys.exit(1)

    from ..core.engine import ChromascopeSafetyEngine
    from .cli import run_interactive, run_examples as run_example_scenarios

    engine = ChromascopeSafetyEngine(excel_path)

    if run_examples:
        run_example_scenarios(engine)
    else:
        run_interactive(engine)