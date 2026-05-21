"""
Vercel serverless function: POST /api/solve_beam

Espera body JSON con BeamModel { spans, supports, loads }.
Retorna SolveResponse con desplazamientos, reacciones, fuerzas internas y diagramas.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

# Permite importar el módulo _lib estando dentro de /api
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib.beam_solver import solve_beam


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            model = json.loads(body)
            result = solve_beam(model)
            self._send(200, result)
        except Exception as exc:
            self._send(500, {"ok": False, "error": f"Server error: {exc}"})

    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _send(self, status: int, payload: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))
