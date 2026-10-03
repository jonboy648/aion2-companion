"""Entry point: python -m aion2c [--fake-engine] [--smoke [--shot DIR]]."""
import sys

from aion2c.app import main

if __name__ == "__main__":
    sys.exit(main())
