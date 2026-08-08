#!/usr/bin/env python3
"""Drive the Clack wizard through a real pseudo-terminal."""

from __future__ import annotations

import os
import pty
import select
import fcntl
import struct
import sys
import termios
import time


def main() -> int:
    mode, binary, working_directory = sys.argv[1:4]
    child_pid, descriptor = pty.fork()
    if child_pid == 0:
        os.chdir(working_directory)
        os.execvp("node", ["node", binary])
    fcntl.ioctl(descriptor, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))

    transcript = bytearray()

    def wait_for(marker: str, timeout: float = 20.0) -> None:
        deadline = time.monotonic() + timeout
        expected = marker.encode()
        while expected not in transcript:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"prompt not found: {marker}\n{transcript.decode(errors='replace')}")
            readable, _, _ = select.select([descriptor], [], [], min(0.2, remaining))
            if readable:
                try:
                    transcript.extend(os.read(descriptor, 65536))
                except OSError:
                    break

    def send(value: bytes) -> None:
        os.write(descriptor, value)

    wait_for("Where should the project be created?")
    if mode == "cancel":
        send(b"\x03")
        wait_for("Project creation cancelled.")
    else:
        send(b"pty-eval\r")
        wait_for("Choose a stack")
        send(b"\x1b[B\r")
        wait_for("Package/project name")
        if mode == "validation":
            send(b"Bad Name\r")
            wait_for("Use lowercase letters, numbers, and single hyphens.")
            send(b"\x03")
            wait_for("Project creation cancelled.")
        else:
            send(b"pty-eval\r")
        if mode == "validation":
            pass
        else:
            wait_for("Select integrations")
            send(b" \r")
            wait_for("Routes (comma separated)")
            send(b"\r")
            wait_for("Select operations modules")
            send(b"\r")
            wait_for("Choose a theme preset")
            send(b"\x1b[B\r")
            wait_for("Create this project?")
            send(b"\r")
            wait_for("Created", timeout=40.0)

    while True:
        try:
            process, status = os.waitpid(child_pid, os.WNOHANG)
        except ChildProcessError:
            status = 0
            break
        if process == child_pid:
            break
        readable, _, _ = select.select([descriptor], [], [], 0.1)
        if readable:
            try:
                transcript.extend(os.read(descriptor, 65536))
            except OSError:
                pass

    sys.stdout.buffer.write(transcript)
    return os.waitstatus_to_exitcode(status)


if __name__ == "__main__":
    raise SystemExit(main())
