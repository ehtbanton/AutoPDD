import sys
import signal

def handle_shutdown(sig, frame):
    """A simple signal handler to exit gracefully."""
    print(f"Process interrupted with signal {sig}. Shutting down.")
    sys.stdout.flush()
    sys.exit(0)

