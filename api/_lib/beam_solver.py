"""
Solver de viga continua 2D por el Método Matricial de la Rigidez.

GDL por nodo: 2 (v = desplazamiento vertical, theta = rotación).
Cada tramo (elemento) tiene 4 GDL: [v_i, theta_i, v_j, theta_j].

Convención:
  - v positivo hacia arriba
  - theta positivo antihorario
  - Cargas POSITIVAS = hacia abajo (gravedad)
  - Momentos POSITIVOS = antihorario
"""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np


# ----------------------------------------------------------------------
# Soporte → restricciones
# ----------------------------------------------------------------------
# fixed_v, fixed_theta
SUPPORT_RESTRAINTS = {
    "PIN":   (True,  False),   # impide desplazamiento, permite rotación
    "ROD":   (True,  False),   # rodillo (igual que PIN en viga continua)
    "EMP":   (True,  True),    # empotrado
    "LIBRE": (False, False),
}


def _k_local(E_kN_m2: float, I_m4: float, L: float) -> np.ndarray:
    """Matriz de rigidez 4x4 del elemento viga (flexión Euler-Bernoulli)."""
    EI = E_kN_m2 * I_m4
    L2 = L * L
    L3 = L2 * L
    return EI * np.array([
        [ 12 / L3,    6 / L2,   -12 / L3,    6 / L2],
        [  6 / L2,    4 / L,    -6 / L2,     2 / L ],
        [-12 / L3,   -6 / L2,   12 / L3,    -6 / L2],
        [  6 / L2,    2 / L,    -6 / L2,     4 / L ],
    ])


def _equiv_load_uniform(w_down: float, L: float) -> np.ndarray:
    """Cargas nodales equivalentes para una carga uniforme w (positiva = abajo)."""
    # Fixed-end: R = wL/2 arriba, M = wL²/12 (CCW en A, CW en B).
    # Equivalente nodal = -Fixed-end (cargas aplicadas en los nodos).
    return np.array([-w_down * L / 2,
                     -w_down * L * L / 12,
                     -w_down * L / 2,
                      w_down * L * L / 12])


def _equiv_load_point(P_down: float, a: float, L: float) -> np.ndarray:
    """Carga puntual P (abajo positivo) a distancia 'a' del nodo izq del tramo."""
    b = L - a
    if a < 0 or b < 0:
        return np.zeros(4)
    L3 = L ** 3
    return np.array([
        -P_down * b * b * (L + 2 * a) / L3,
        -P_down * a * b * b / (L * L),
        -P_down * a * a * (L + 2 * b) / L3,
         P_down * a * a * b / (L * L),
    ])


def _equiv_load_moment(M0_ccw: float, a: float, L: float) -> np.ndarray:
    """Momento puntual aplicado a distancia 'a' del nodo izq (CCW positivo)."""
    b = L - a
    if a < 0 or b < 0:
        return np.zeros(4)
    L2 = L * L
    L3 = L * L * L
    return np.array([
         6 * M0_ccw * a * b / L3,
        -M0_ccw * b * (2 * a - b) / L2,
        -6 * M0_ccw * a * b / L3,
        -M0_ccw * a * (2 * b - a) / L2,
    ])


def _equiv_load_trapezoidal(w1: float, w2: float, L: float) -> np.ndarray:
    """
    Carga trapezoidal de w1 (izq) a w2 (der), ambas positivas = abajo.
    Se descompone como rectángulo + triángulo y se suman las equivalentes.
    """
    # Rectángulo de altura w_base = min(w1, w2)
    w_base = min(w1, w2)
    eq = _equiv_load_uniform(w_base, L)

    # Triángulo de altura delta
    delta = abs(w2 - w1)
    if delta < 1e-12:
        return eq

    # Triángulo con pico DERECHA (w_max en derecha)
    # FE: R_A=3wL/20, M_A=wL²/30, R_B=7wL/20, M_B=-wL²/20
    if w2 > w1:
        tri = np.array([
            -delta * L * 3 / 20,
            -delta * L * L / 30,
            -delta * L * 7 / 20,
             delta * L * L / 20,
        ])
    else:
        # Pico IZQUIERDA (simétrico)
        tri = np.array([
            -delta * L * 7 / 20,
            -delta * L * L / 20,
            -delta * L * 3 / 20,
             delta * L * L / 30,
        ])
    return eq + tri


# ----------------------------------------------------------------------
# Solver principal
# ----------------------------------------------------------------------
def solve_beam(model: Dict[str, Any]) -> Dict[str, Any]:
    spans = model.get("spans", [])
    supports = model.get("supports", [])
    loads = model.get("loads", [])

    if len(spans) < 1:
        return {"ok": False, "error": "Se requiere al menos 1 tramo."}
    n_nodes = len(spans) + 1
    if len(supports) != n_nodes:
        return {"ok": False, "error": f"Se esperaban {n_nodes} apoyos, llegaron {len(supports)}."}

    # 2 GDL por nodo: [v, theta]
    n_dof = n_nodes * 2
    K = np.zeros((n_dof, n_dof))
    F = np.zeros(n_dof)

    # Almacena para diagnóstico
    spans_data = []

    for i, sp in enumerate(spans):
        L = float(sp["L"])
        if L <= 0:
            return {"ok": False, "error": f"Tramo T{i+1}: L debe ser > 0."}
        # E: GPa -> kN/m²  (1 GPa = 1e6 kN/m²)
        E_kN_m2 = float(sp["E"]) * 1e6
        # I: cm⁴ -> m⁴  (1 cm⁴ = 1e-8 m⁴)
        I_m4 = float(sp["I"]) * 1e-8

        ke = _k_local(E_kN_m2, I_m4, L)
        dof_map = [2 * i, 2 * i + 1, 2 * (i + 1), 2 * (i + 1) + 1]
        for a in range(4):
            for b in range(4):
                K[dof_map[a], dof_map[b]] += ke[a, b]
        spans_data.append({"L": L, "EI": E_kN_m2 * I_m4, "dof_map": dof_map})

    # Cargas equivalentes nodales
    for load in loads:
        si = int(load["spanIndex"])
        if si < 0 or si >= len(spans):
            continue
        L = spans_data[si]["L"]
        ltype = load["type"]
        if ltype == "puntual":
            f_eq = _equiv_load_point(float(load["magnitude"]),
                                     float(load.get("position", L / 2)), L)
        elif ltype == "uniforme":
            f_eq = _equiv_load_uniform(float(load["magnitude"]), L)
        elif ltype == "momento":
            f_eq = _equiv_load_moment(float(load["magnitude"]),
                                      float(load.get("position", L / 2)), L)
        elif ltype == "trapezoidal":
            f_eq = _equiv_load_trapezoidal(float(load["magnitude"]),
                                           float(load.get("magnitude2", load["magnitude"])), L)
        else:
            continue
        dof_map = spans_data[si]["dof_map"]
        for a in range(4):
            F[dof_map[a]] += f_eq[a]

    # GDL libres y restringidos
    free, fixed = [], []
    for i, sup in enumerate(supports):
        rv, rt = SUPPORT_RESTRAINTS.get(sup["type"], (False, False))
        (fixed if rv else free).append(2 * i)
        (fixed if rt else free).append(2 * i + 1)

    # Resolución (si todo está restringido, U = 0 y reacciones = -F)
    U = np.zeros(n_dof)
    if free:
        K_LL = K[np.ix_(free, free)]
        F_L = F[free]
        try:
            U_L = np.linalg.solve(K_LL, F_L)
        except np.linalg.LinAlgError:
            return {"ok": False, "error": "Matriz singular: la viga es un mecanismo. Revisar apoyos."}
        U[free] = U_L

    # Reacciones (en GDL restringidos): R = K U - F
    R_full = K @ U - F

    # Desplazamientos por nodo
    displacements = [[float(U[2 * i]), float(U[2 * i + 1])] for i in range(n_nodes)]

    # Reacciones por nodo (en GDL restringidos)
    reactions: List[List[float]] = []
    for i, sup in enumerate(supports):
        rv, rt = SUPPORT_RESTRAINTS.get(sup["type"], (False, False))
        Rv = float(R_full[2 * i]) if rv else 0.0
        Mr = float(R_full[2 * i + 1]) if rt else 0.0
        reactions.append([Rv, Mr])

    # Fuerzas internas por elemento (f_internal = k*u - F_eq)
    member_forces = []
    diagrams = []
    for i, sd in enumerate(spans_data):
        dof_map = sd["dof_map"]
        u_e = U[dof_map]
        L = sd["L"]
        EI = sd["EI"]
        L2, L3 = L * L, L * L * L
        ke = EI * np.array([
            [ 12 / L3,    6 / L2,   -12 / L3,    6 / L2],
            [  6 / L2,    4 / L,    -6 / L2,     2 / L ],
            [-12 / L3,   -6 / L2,   12 / L3,    -6 / L2],
            [  6 / L2,    2 / L,    -6 / L2,     4 / L ],
        ])

        # Equivalentes nodales del tramo (suma de todas sus cargas)
        f_eq_total = np.zeros(4)
        for load in loads:
            if int(load["spanIndex"]) != i:
                continue
            ltype = load["type"]
            if ltype == "uniforme":
                f_eq_total += _equiv_load_uniform(float(load["magnitude"]), L)
            elif ltype == "puntual":
                f_eq_total += _equiv_load_point(
                    float(load["magnitude"]), float(load.get("position", L / 2)), L)
            elif ltype == "momento":
                f_eq_total += _equiv_load_moment(
                    float(load["magnitude"]), float(load.get("position", L / 2)), L)
            elif ltype == "trapezoidal":
                f_eq_total += _equiv_load_trapezoidal(
                    float(load["magnitude"]),
                    float(load.get("magnitude2", load["magnitude"])), L)

        # Fuerzas internas en los extremos del elemento (convención matricial: CCW positivo)
        f_int = ke @ u_e - f_eq_total

        # Convención de INGENIERÍA para diagramas:
        #   V positivo = cortante en cara izq hacia arriba
        #   M positivo = sagging (fibra inferior en tracción)
        # Conversión desde la matricial: M_eng = -M_matrix en el extremo izquierdo.
        V_i =  float(f_int[0])
        M_i = -float(f_int[1])

        # Diagramas V(x), M(x) por integración directa de las cargas en este tramo
        N_POINTS = 41
        xs = np.linspace(0, L, N_POINTS).tolist()
        span_loads = [l for l in loads if int(l["spanIndex"]) == i]
        Vs, Ms = [], []
        for x in xs:
            V = V_i
            # M(x) = M_i + V_i * x - integral_0^x w(s)*(x-s) ds - sum(P*(x-a)) - sum(M0 for a<=x)
            M = M_i + V_i * x
            for l in span_loads:
                t = l["type"]
                if t == "uniforme":
                    w = float(l["magnitude"])
                    V -= w * x
                    M -= w * x * x / 2
                elif t == "puntual":
                    P = float(l["magnitude"])
                    a = float(l.get("position", L / 2))
                    if x >= a:
                        V -= P
                        M -= P * (x - a)
                elif t == "momento":
                    M0 = float(l["magnitude"])
                    a = float(l.get("position", L / 2))
                    if x >= a:
                        M -= M0
                elif t == "trapezoidal":
                    w1 = float(l["magnitude"])
                    w2 = float(l.get("magnitude2", w1))
                    Fw = w1 * x + (w2 - w1) * x * x / (2 * L)
                    Mw = w1 * x * x / 2 + (w2 - w1) * x * x * x / (3 * L)
                    V -= Fw
                    M -= Mw
            Vs.append(float(V))
            Ms.append(float(M))
        diagrams.append({"spanIndex": i, "x": xs, "V": Vs, "M": Ms})

        # Reportar fuerzas en extremos en convención de ingeniería usando los diagramas
        member_forces.append({
            "spanIndex": i,
            "V_i": Vs[0],  "M_i": Ms[0],
            "V_j": Vs[-1], "M_j": Ms[-1],
        })

    return {
        "ok": True,
        "displacements": displacements,
        "reactions": reactions,
        "member_forces": member_forces,
        "K_global": K.tolist(),
        "F_global": F.tolist(),
        "diagrams": diagrams,
    }
