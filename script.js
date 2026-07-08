let vistaActual = 'simple';
let casoSeleccionado = 'caso1';
let nodos = {};
let duracionGlobalProyecto = 0;
let varianzaGlobalProyecto = 0;
let zoomLevel = 1.0;
let datosCurvaCostoTiempo = [];
let capasPasos = [];
let currentPasoIndex = 0;
let unidadTiempo = 'semanas';
let monedaActual = 'USD';
const simbolosMoneda = { USD: '$', PEN: 'S/' };

function normalizarUnidadTiempo(valor) {
    return String(valor || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function obtenerClaveUnidad(valor) {
    const clave = normalizarUnidadTiempo(valor);
    if (['semanas', 'semana', 'sem', 'wk', 'w'].includes(clave)) return 'semanas';
    if (['dias', 'dia', 'días', 'dí', 'd'].includes(clave)) return 'dias';
    return clave || 'unidades';
}

function getUnidadTiempoNombre() { return unidadTiempo || 'unidades'; }
function getUnidadTiempoAbrev() {
    const clave = obtenerClaveUnidad(unidadTiempo);
    if (clave === 'dias') return 'días';
    if (clave === 'semanas') return 'sem';
    return unidadTiempo || 'u.t.';
}
function getSimboloMoneda() { return simbolosMoneda[monedaActual] || monedaActual || '$'; }

function cambiarUnidadTiempo(nuevaUnidad) {
    const texto = String(nuevaUnidad || '').trim();
    if (!texto || unidadTiempo === texto) return;
    unidadTiempo = texto;
    actualizarEtiquetasUnidadYMoneda();
    procesarYDibujar();
}

function cambiarMoneda(nuevaMoneda) {
    const texto = String(nuevaMoneda || '').trim();
    if (!texto || monedaActual === texto) return;
    monedaActual = texto;
    actualizarEtiquetasUnidadYMoneda();
    dibujarCurvaCostoTiempo();
}

function actualizarEtiquetasUnidadYMoneda() {
    const unidadNombre = getUnidadTiempoNombre();
    const labelPlazo = document.getElementById('labelPlazo');
    if (labelPlazo) labelPlazo.textContent = `Plazo Objetivo del Proyecto (X ${unidadNombre}):`;
    const labelPlazoCasoC = document.getElementById('labelPlazoCasoC');
    if (labelPlazoCasoC) labelPlazoCasoC.textContent = `Reducir Duración del Proyecto a (${unidadNombre}):`;
    const unidadInput = document.getElementById('unidadTiempoInput');
    if (unidadInput) unidadInput.value = unidadTiempo;
    const monedaInput = document.getElementById('monedaInput');
    if (monedaInput) monedaInput.value = monedaActual;
}

// --- Funciones de Zoom ---
function ajustarZoom(delta) {
    zoomLevel = Math.max(0.3, Math.min(3.0, zoomLevel + delta));
    dibujar();
}

function resetearZoom() {
    zoomLevel = 1.0;
    dibujar();
}

// --- Drag & Drop en Canvas ---
let draggingNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isPanning = false;
let panX = 0;
let panY = 0;
let lastPanClientX = 0;
let lastPanClientY = 0;

function initCanvasDrag() {
    const canvas = document.getElementById('canvasRed');
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup',   onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseUp);
    canvas.addEventListener('dblclick', onCanvasDblClick);
}

function getCanvasPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: ((e.clientX - rect.left) * scaleX) / zoomLevel - panX,
        y: ((e.clientY - rect.top) * scaleY) / zoomLevel - panY
    };
}

function hitTest(n, px, py) {
    const radius = n.esDummy ? 16 : 35;
    return Math.hypot(n.x - px, n.y - py) < radius;
}

function onCanvasMouseDown(e) {
    const canvas = document.getElementById('canvasRed');
    const p = getCanvasPos(canvas, e);

    for (let id in nodos) {
        if (hitTest(nodos[id], p.x, p.y)) {
            draggingNode = nodos[id];
            dragOffsetX = p.x - nodos[id].x;
            dragOffsetY = p.y - nodos[id].y;
            canvas.style.cursor = 'grabbing';
            return;
        }
    }

    isPanning = true;
    lastPanClientX = e.clientX;
    lastPanClientY = e.clientY;
    canvas.style.cursor = 'grabbing';
}

function onCanvasMouseMove(e) {
    const canvas = document.getElementById('canvasRed');
    const p = getCanvasPos(canvas, e);

    if (draggingNode) {
        draggingNode.x = p.x - dragOffsetX;
        draggingNode.y = p.y - dragOffsetY;
        draggingNode.esManual = true;
        dibujar();
        return;
    }

    if (isPanning) {
        const dx = (e.clientX - lastPanClientX) / zoomLevel;
        const dy = (e.clientY - lastPanClientY) / zoomLevel;
        panX += dx;
        panY += dy;
        lastPanClientX = e.clientX;
        lastPanClientY = e.clientY;
        dibujar();
        return;
    }

    let over = false;
    for (let id in nodos) {
        if (hitTest(nodos[id], p.x, p.y)) { over = true; break; }
    }
    canvas.style.cursor = over ? 'grab' : 'grab';
}

function onCanvasMouseUp() {
    draggingNode = null;
    isPanning = false;
    document.getElementById('canvasRed').style.cursor = 'default';
}

function onCanvasDblClick(e) {
    const canvas = document.getElementById('canvasRed');
    const p = getCanvasPos(canvas, e);
    for (let id in nodos) {
        if (hitTest(nodos[id], p.x, p.y)) {
            nodos[id].esManual = false;
            calcularNivelesYPosicionesOptimizadas();
            dibujar();
            break;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('#cuerpoTabla tr').forEach(tr => recalcularFila(tr.querySelector('.pert-a')));
    actualizarEtiquetasUnidadYMoneda();
    procesarYDibujar();
    actualizarCamposVisibles();
    initCanvasDrag();
});

function normalCumulativeProbability(z) {
    let sign = 1; if (z < 0) { sign = -1; z = -z; }
    let b1 = 0.319381530; let b2 = -0.356563782; let b3 = 1.781477937;
    let b4 = -1.821255978; let b5 = 1.330274429; let p = 0.2316419;
    let t = 1.0 / (1.0 + p * z);
    let fact = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-z * z / 2.0) * (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));
    return sign === -1 ? 1.0 - fact : fact;
}

function inverseNormalDistribution(p) {
    if (p <= 0 || p >= 1) return 0;
    let a1 = -3.969683028e+01, a2 = 2.209460984e+02, a3 = -2.759285104e+02, a4 = 1.383577519e+02, a5 = -3.066479800e+01, a6 = 2.506628277e+00;
    let b1 = -5.447609879e+01, b2 = 1.615858368e+02, b3 = -1.556989799e+02, b4 = 6.680131188e+01, b5 = -1.328068155e+01;
    let c1 = -1.395329302e-03, c2 = -1.015242274e-01, c3 = 5.719753480e-01, c4 = -4.453488830e-01, c5 = 8.386760434e-02, c6 = -5.008424441e-03;
    let d1 = 3.374523317e-02, d2 = 3.361414376e-01, d3 = 1.592927248e-01, d4 = 3.801403850e-02;
    let low = 0.02425, high = 1 - low, q, r, z;
    if (p < low) { q = Math.sqrt(-2 * Math.log(p)); z = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / (((((d1 * q + d2) * q + d3) * q + d4) * q + 1)); }
    else if (p > high) { q = Math.sqrt(-2 * Math.log(1 - p)); z = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / (((((d1 * q + d2) * q + d3) * q + d4) * q + 1)); }
    else { q = p - 0.5; r = q * q; z = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1); }
    return z;
}

// Manejar la selección visual de los bloques
function seleccionarCasoBloque(caso) {
    casoSeleccionado = caso;
    document.getElementById('btnCaso1').classList.toggle('active', caso === 'caso1');
    document.getElementById('btnCaso3').classList.toggle('active', caso === 'caso3');
    document.getElementById('btnCasoC').classList.toggle('active', caso === 'casoC');
    actualizarCamposVisibles();
}

function actualizarCamposVisibles() {
    const isCasoC = casoSeleccionado === 'casoC';
    // Campos del formulario A/B
    document.getElementById('filaPlazo').style.display     = isCasoC ? 'none' : 'flex';
    document.getElementById('filaPorcentaje').style.display = (casoSeleccionado === 'caso1' || isCasoC) ? 'none' : 'flex';
    // Input plazo objetivo Caso C
    const filaPlazoCasoC = document.getElementById('filaPlazoCasoC');
    if (filaPlazoCasoC) filaPlazoCasoC.style.display = isCasoC ? 'flex' : 'none';
    // Columnas de compresión en la tabla
    document.querySelectorAll('.col-compresion').forEach(el => el.classList.toggle('hidden', !isCasoC));
    // Texto del botón principal
    const btn = document.getElementById('btnEjecutarAccion');
    if (btn) btn.textContent = isCasoC
        ? '📊 Calcular costo y disponibilidad de actividades a comprimir'
        : 'Ejecutar Simulación Estadística';
    const btnMaximo = document.getElementById('btnReducirMaximo');
    if (btnMaximo) btnMaximo.style.display = isCasoC ? 'inline-flex' : 'none';
    document.getElementById('resultadoDinamico').innerHTML = '';
}

// Simulación con textos totalmente limpios sin símbolos de formato caídos ($)
function calcularEscenarioPersonalizado() {
    const divRes = document.getElementById('resultadoDinamico');
    if (varianzaGlobalProyecto <= 0) {
        divRes.innerHTML = "<span style='color: #e74c3c;'>La varianza es 0. Introduce actividades válidas.</span>";
        return;
    }

    let sigma = Math.sqrt(varianzaGlobalProyecto);

    // CASO A: Probabilidad con Plazo X Fijo
    if (casoSeleccionado === 'caso1') {
        let x = parseFloat(document.getElementById('inputX').value);
        if (isNaN(x)) { divRes.innerHTML = "<span style='color: #e74c3c;'>Ingrese un número de plazo válido.</span>"; return; }

        let z = (x - duracionGlobalProyecto) / sigma;
        let prob = normalCumulativeProbability(z) * 100;

        divRes.innerHTML = `
                    <div style="background-color: white; padding: 14px; border-radius: 6px; border: 1px dashed #2980b9; line-height: 1.5;">
                        <span style="color:#2980b9; font-size:1.1em;">📊 <strong>Resultados del Análisis Estadístico:</strong></span><br>
                        • Plazo Objetivo Evaluado (X) = <strong>${x} ${getUnidadTiempoNombre()}</strong><br>
                        • Duración de la Ruta Crítica (μ) = <strong>${duracionGlobalProyecto} ${getUnidadTiempoNombre()}</strong><br>
                        • Valor Z Calculado = <span style="color:#2980b9;">${z.toFixed(4)}</span><br>
                        <hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;">
                        • Probabilidad de Terminar a Tiempo = <span style="color:#27ae60; font-size:1.2em;">${prob.toFixed(2)}%</span>
                    </div>`;
    }

    // CASO B: Reducción de Tiempos (Pregunta de Examen)
    else if (casoSeleccionado === 'caso3') {
        let x = parseFloat(document.getElementById('inputX').value);
        let porc = parseFloat(document.getElementById('inputPorcentaje').value);

        if (isNaN(x) || isNaN(porc) || porc <= 0 || porc >= 100) {
            divRes.innerHTML = "<span style='color: #e74c3c;'>Verifica el plazo y que el porcentaje esté entre 1 y 99.</span>";
            return;
        }

        let z = inverseNormalDistribution(porc / 100);

        // Despeje: Nueva media requerida = X - (Z * Desviación Estándar)
        let nuevaDuracionRutaCritica = x - (z * sigma);
        let reduccionRequerida = duracionGlobalProyecto - nuevaDuracionRutaCritica;

        let mensajeDestacado = reduccionRequerida > 0
            ? `⚠️ La gerencia exige una <strong>REDUCCIÓN DE TIEMPO</strong> de <span style="color:#e74c3c; font-size:1.15em;">${reduccionRequerida.toFixed(2)} ${getUnidadTiempoNombre()}</span> en la ruta crítica original.`
            : `✅ No es necesario comprimir los tiempos. La red actual cubre la meta holgadamente por ${Math.abs(reduccionRequerida).toFixed(2)} ${getUnidadTiempoNombre()}.`;

        divRes.innerHTML = `
                    <div style="background-color: white; padding: 14px; border-radius: 6px; border: 2px solid #e67e22; line-height: 1.5;">
                        <span style="color:#e67e22; font-size:1.1em;">🎓 <strong>Solución de Ingeniería Inversa Realizada:</strong></span><br>
                        • Plazo de Entrega Exigido (X) = <strong>${x} ${getUnidadTiempoNombre()}</strong><br>
                        • Nivel de Confianza Exigido = <strong>${porc}%</strong><br>
                        • Valor Z de Tabla Inversa = <span style="color:#7f8c8d;">${z.toFixed(4)}</span><br>
                        • La nueva duración máxima que debe tener tu red (μ nuevo) es: <strong>${nuevaDuracionRutaCritica.toFixed(2)} ${getUnidadTiempoNombre()}</strong><br>
                        <hr style="border: 0; border-top: 1px dashed #e67e22; margin: 10px 0;">
                        ${mensajeDestacado}
                    </div>`;
    }
}

// Lógica interna PERT/CPM invariable
function toggleModoPert() {
    const isPert = document.getElementById('modoPertCheck').checked;
    document.querySelectorAll('.col-pert').forEach(el => el.classList.toggle('hidden', !isPert));
    document.querySelectorAll('.col-simple').forEach(el => el.classList.toggle('hidden', isPert));
    document.querySelectorAll('#cuerpoTabla tr').forEach(tr => {
        if (!isPert) { tr.querySelector('.tiempo-calc').value = tr.querySelector('.tiempo-unico').value || 0; }
        else { recalcularFila(tr.querySelector('.pert-a')); }
    });
}

function actualizarSimple(input) { input.closest('tr').querySelector('.tiempo-calc').value = input.value; }

function recalcularFila(inputEl) {
    if (!inputEl) return;
    const tr = inputEl.closest('tr');
    const a = parseFloat(tr.querySelector('.pert-a').value) || 0;
    const b = parseFloat(tr.querySelector('.pert-b').value) || 0;
    const c = parseFloat(tr.querySelector('.pert-c').value) || 0;
    tr.querySelector('.tiempo-calc').value = Math.round(((a + (b * 4) + c) / 6) * 100) / 100;
    let varCalculada = Math.pow((c - a) / 6, 2);
    tr.querySelector('.varianza-calc').value = Math.round(varCalculada * 100) / 100;
}

function agregarFila(datos = null) {
    const tbody = document.getElementById('cuerpoTabla');
    const isPert = document.getElementById('modoPertCheck').checked;
    const isCasoC = casoSeleccionado === 'casoC';
    const tr = document.createElement('tr');
    tr.innerHTML = `
                <td><input type="text" value="${datos ? datos.id : ''}" class="act-id"></td>
                <td><input type="text" value="${datos ? datos.prec : '-'}" class="act-prec"></td>
                <td class="col-pert ${isPert ? '' : 'hidden'}"><input type="number" value="${datos ? datos.a : 0}" class="pert-a" oninput="recalcularFila(this)"></td>
                <td class="col-pert ${isPert ? '' : 'hidden'}"><input type="number" value="${datos ? datos.b : 0}" class="pert-b" oninput="recalcularFila(this)"></td>
                <td class="col-pert ${isPert ? '' : 'hidden'}"><input type="number" value="${datos ? datos.c : 0}" class="pert-c" oninput="recalcularFila(this)"></td>
                <td class="col-simple ${isPert ? 'hidden' : ''}"><input type="number" value="${datos ? datos.unico : 0}" class="tiempo-unico" oninput="actualizarSimple(this)"></td>
                <td><input type="number" value="${datos ? datos.calc : 0}" class="tiempo-calc" disabled></td>
                <td class="col-pert ${isPert ? '' : 'hidden'}"><input type="number" value="${datos ? datos.var : 0}" class="varianza-calc" disabled></td>
                <td class="col-compresion ${isCasoC ? '' : 'hidden'}"><input type="number" value="${datos ? (datos.compTiempo || 0) : 0}" class="comp-tiempo"></td>
                <td class="col-compresion ${isCasoC ? '' : 'hidden'}"><input type="number" value="${datos ? (datos.compCostoNormal || 0) : 0}" class="comp-costo-normal"></td>
                <td class="col-compresion ${isCasoC ? '' : 'hidden'}"><input type="number" value="${datos ? (datos.compCostoComp || 0) : 0}" class="comp-costo-comp"></td>
                <td><button class="btn-del" onclick="eliminarFila(this)">X</button></td>`;
    tbody.appendChild(tr);
}

function eliminarFila(btn) { btn.closest('tr').remove(); }
// 1. Modifica tu función cambiarVista existente
function cambiarVista(vista) {
    vistaActual = vista;
    document.getElementById('btnSimple').classList.toggle('active', vista === 'simple');
    document.getElementById('btnCPM').classList.toggle('active', vista === 'cpm');
    document.getElementById('btnCapas').classList.toggle('active', vista === 'capas');
    document.getElementById('btnGantt').classList.toggle('active', vista === 'gantt');
    document.getElementById('btnCosto').classList.toggle('active', vista === 'costo');

    const isGantt = vista === 'gantt';
    const isCosto = vista === 'costo';
    const isCapas = vista === 'capas';
    document.getElementById('canvasRed').style.display = (isGantt || isCosto) ? 'none' : 'block';
    document.getElementById('containerGantt').classList.toggle('hidden', !isGantt);
    document.getElementById('containerCostoTiempo').classList.toggle('hidden', !isCosto);
    document.getElementById('panelCapasPasos').classList.toggle('hidden', !isCapas);
    document.getElementById('canvasHint').style.display = (isGantt || isCosto) ? 'none' : 'block';
    const zoomEl = document.getElementById('zoomControls');
    if (zoomEl) zoomEl.style.display = (isGantt || isCosto) ? 'none' : 'flex';

    const canvasTitle = document.getElementById('canvasTitle');
    if (canvasTitle) {
        if (isCapas) canvasTitle.textContent = 'Red de Actividades Capas';
        else if (vista === 'cpm') canvasTitle.textContent = 'Red de Actividades';
        else if (vista === 'simple') canvasTitle.textContent = 'Diagrama de Nodos';
        else canvasTitle.textContent = '';
    }

    if (isCapas) {
        actualizarPanelCapas();
    }

    if (isGantt) {
        dibujarGantt();
    } else if (isCosto) {
        dibujarCurvaCostoTiempo();
    } else {
        dibujar();
    }
}

// 2. Gráfico de Gantt Profesional
function dibujarCurvaCostoTiempo() {
    const canvas = document.getElementById('canvasCostoTiempo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!datosCurvaCostoTiempo.length) {
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('Completa el análisis de compresión para ver la curva costo-tiempo.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const padding = { top: 60, right: 30, bottom: 60, left: 70 };
    const width = canvas.width - padding.left - padding.right;
    const height = canvas.height - padding.top - padding.bottom;
    const minDur = Math.min(...datosCurvaCostoTiempo.map(p => p.duracion));
    const maxDur = Math.max(...datosCurvaCostoTiempo.map(p => p.duracion));
    const minCost = Math.min(...datosCurvaCostoTiempo.map(p => p.costo));
    const maxCost = Math.max(...datosCurvaCostoTiempo.map(p => p.costo));
    const durSpan = Math.max(1, maxDur - minDur);
    const costSpan = Math.max(1, maxCost - minCost);

    const puntosCurva = datosCurvaCostoTiempo.map(p => {
        const x = padding.left + ((p.duracion - minDur) / durSpan) * width;
        const y = padding.top + height - ((p.costo - minCost) / costSpan) * height;
        return { ...p, x, y };
    });

    const xLabelStep = Math.max(1, Math.round(puntosCurva.length / 8));
    const xTicks = puntosCurva.filter((item, index) => index % xLabelStep === 0 || index === puntosCurva.length - 1);

    const valoresCostos = Array.from(new Set(puntosCurva.map(p => Math.round(p.costo)))).sort((a, b) => a - b);
    const yLabelCount = Math.min(6, valoresCostos.length);
    const yLabelStep = Math.max(1, Math.floor(valoresCostos.length / yLabelCount));
    const valoresY = [];
    for (let i = 0; i < valoresCostos.length; i += yLabelStep) {
        valoresY.push(valoresCostos[i]);
    }
    if (valoresY[valoresY.length - 1] !== valoresCostos[valoresCostos.length - 1]) {
        valoresY.push(valoresCostos[valoresCostos.length - 1]);
    }
    const yTicks = valoresY
        .map(value => puntosCurva.find(p => Math.round(p.costo) === value))
        .filter(Boolean);

    ctx.strokeStyle = '#d6dde8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    yTicks.forEach(item => {
        ctx.beginPath();
        ctx.moveTo(padding.left, item.y);
        ctx.lineTo(canvas.width - padding.right, item.y);
        ctx.stroke();
    });
    xTicks.forEach(item => {
        ctx.beginPath();
        ctx.moveTo(item.x, padding.top);
        ctx.lineTo(item.x, padding.top + height);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + height);
    ctx.moveTo(padding.left, padding.top + height);
    ctx.lineTo(canvas.width - padding.right, padding.top + height);
    ctx.stroke();

    ctx.fillStyle = '#2c3e50';
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    xTicks.forEach(item => {
        ctx.beginPath();
        ctx.moveTo(item.x, padding.top + height);
        ctx.lineTo(item.x, padding.top + height + 6);
        ctx.stroke();
        ctx.fillText(`${item.duracion.toFixed(0)} ${getUnidadTiempoAbrev()}`, item.x, padding.top + height + 18);
    });

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yTicks.forEach(item => {
        ctx.beginPath();
        ctx.moveTo(padding.left - 6, item.y);
        ctx.lineTo(padding.left, item.y);
        ctx.stroke();
        ctx.fillText(`${getSimboloMoneda()}${Math.round(item.costo).toLocaleString()}`, padding.left - 10, item.y);
    });

    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(`Duración (${getUnidadTiempoNombre()})`, canvas.width / 2, canvas.height - 18);
    ctx.save();
    ctx.translate(20, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Costo acumulado', 0, 0);
    ctx.restore();

    if (datosCurvaCostoTiempo.length >= 2) {
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        datosCurvaCostoTiempo.forEach((p, index) => {
            const x = padding.left + ((p.duracion - minDur) / durSpan) * width;
            const y = padding.top + height - ((p.costo - minCost) / costSpan) * height;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    datosCurvaCostoTiempo.forEach((p, index) => {
        const x = padding.left + ((p.duracion - minDur) / durSpan) * width;
        const y = padding.top + height - ((p.costo - minCost) / costSpan) * height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? '#e74c3c' : '#2980b9';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    ctx.fillStyle = '#34495e';
    ctx.font = '13px Segoe UI';
    ctx.textAlign = 'left';
    const ultimo = datosCurvaCostoTiempo[datosCurvaCostoTiempo.length - 1];
    ctx.fillText(`Duración actual: ${duracionGlobalProyecto.toFixed(1)} ${getUnidadTiempoAbrev()}`, padding.left, 20);
    ctx.fillText(`Costo final estimado: ${getSimboloMoneda()}${Math.round(ultimo.costo).toLocaleString()}`, padding.left + 220, 20);
}

function dibujarGantt() {
    const container = document.getElementById('containerGantt');
    container.innerHTML = '';

    let listaNodos = Object.values(nodos).filter(n => n.id !== 'INICIO' && n.id !== 'FIN' && !n.esDummy);
    if (listaNodos.length === 0) {
        container.innerHTML = '<p style="padding:20px;color:#999;">Calcula la red primero.</p>';
        return;
    }
    listaNodos.sort((a, b) => a.es - b.es || a.id.localeCompare(b.id));

    const totalTime = duracionGlobalProyecto || 1;
    const PX_PER_UNIT = 28; // píxeles por unidad de tiempo
    const LABEL_W = 110;
    const ROW_H = 38;
    const HEADER_H = 40;
    const chartW = totalTime * PX_PER_UNIT;

    // --- Wrapper ---
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `overflow-x:auto; padding:16px 20px; font-family:'Segoe UI',sans-serif;`;

    // --- Título ---
    const title = document.createElement('div');
    title.style.cssText = 'font-size:15px;font-weight:700;color:#2c3e50;margin-bottom:14px;letter-spacing:.4px;';
    title.innerHTML = '📅 Gráfico de Gantt &nbsp;<span style="font-size:12px;font-weight:normal;color:#7f8c8d;">— Arrastre las barras para explorar. Rojo = Ruta Crítica · Azul = Holgura disponible</span>';
    wrapper.appendChild(title);

    // --- Leyenda ---
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:18px;margin-bottom:12px;font-size:12px;';
    legend.innerHTML = `
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;background:#e74c3c;border-radius:3px;display:inline-block;"></span>Actividad crítica</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;background:#3498db;border-radius:3px;display:inline-block;"></span>Actividad no crítica</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;background:repeating-linear-gradient(45deg,#aed6f1,#aed6f1 3px,transparent 3px,transparent 7px);border-radius:3px;display:inline-block;"></span>Holgura total</span>
    `;
    wrapper.appendChild(legend);

    // --- Contenedor del Gantt (label + chart) ---
    const ganttWrap = document.createElement('div');
    ganttWrap.style.cssText = `display:flex; width:${LABEL_W + chartW + 40}px;`;

    // Columna de etiquetas
    const labelCol = document.createElement('div');
    labelCol.style.cssText = `width:${LABEL_W}px; flex-shrink:0; padding-top:${HEADER_H}px;`;

    // Columna del chart
    const chartCol = document.createElement('div');
    chartCol.style.cssText = `position:relative; width:${chartW + 20}px; flex-shrink:0;`;

    // --- Cabecera de escala de tiempo ---
    const scaleEl = document.createElement('div');
    scaleEl.style.cssText = `position:relative; height:${HEADER_H}px; border-bottom:2px solid #2c3e50; margin-bottom:0;`;
    const tickCount = Math.min(totalTime, 30);
    const tickStep = Math.ceil(totalTime / tickCount);
    for (let t = 0; t <= totalTime; t += tickStep) {
        const tick = document.createElement('div');
        tick.style.cssText = `position:absolute; left:${t * PX_PER_UNIT}px; top:0; text-align:center; transform:translateX(-50%);`;
        tick.innerHTML = `<div style="height:8px;width:1px;background:#2c3e50;margin:auto;"></div><div style="font-size:10px;color:#555;margin-top:2px;">${t}</div>`;
        scaleEl.appendChild(tick);
    }
    chartCol.appendChild(scaleEl);

    // --- Líneas de grid verticales ---
    const grid = document.createElement('div');
    grid.style.cssText = `position:absolute; top:${HEADER_H}px; left:0; width:100%; height:${listaNodos.length * ROW_H}px; pointer-events:none;`;
    for (let t = 0; t <= totalTime; t += tickStep) {
        const vLine = document.createElement('div');
        vLine.style.cssText = `position:absolute; left:${t * PX_PER_UNIT}px; top:0; bottom:0; width:1px; background:rgba(0,0,0,0.06);`;
        grid.appendChild(vLine);
    }
    chartCol.appendChild(grid);

    // --- Filas del Gantt ---
    listaNodos.forEach((n, i) => {
        const isCritical = Math.abs(n.holgura) < 0.01;
        const barColor  = isCritical ? '#e74c3c' : '#3498db';
        const barColorD = isCritical ? '#c0392b' : '#2980b9';

        // Label
        const lbl = document.createElement('div');
        lbl.style.cssText = `height:${ROW_H}px; display:flex; align-items:center; padding-right:10px; font-size:13px; font-weight:600; color:${isCritical ? '#c0392b' : '#2c3e50'}; border-bottom:1px solid #f0f0f0;`;
        lbl.textContent = `Act. ${n.id}`;
        labelCol.appendChild(lbl);

        // Row en el chart
        const rowEl = document.createElement('div');
        rowEl.style.cssText = `position:relative; height:${ROW_H}px; border-bottom:1px solid #f0f0f0;`;

        // Holgura (background stripe)
        if (n.holgura > 0.01) {
            const slack = document.createElement('div');
            slack.style.cssText = `
                position:absolute;
                left:${n.ef * PX_PER_UNIT}px;
                top:50%; transform:translateY(-50%);
                width:${n.holgura * PX_PER_UNIT}px;
                height:16px;
                background:repeating-linear-gradient(45deg,#aed6f1,#aed6f1 3px,transparent 3px,transparent 8px);
                border-radius:3px;
                opacity:0.7;
            `;
            slack.title = `Holgura total: ${n.holgura.toFixed(1)} u.t.`;
            rowEl.appendChild(slack);
        }

        // Barra principal
        const bar = document.createElement('div');
        const barW = Math.max(n.duracion * PX_PER_UNIT, 8);
        bar.style.cssText = `
            position:absolute;
            left:${n.es * PX_PER_UNIT}px;
            top:50%; transform:translateY(-50%) scaleX(0);
            transform-origin: left center;
            width:${barW}px;
            height:22px;
            background: linear-gradient(90deg, ${barColor}, ${barColorD});
            border-radius:4px;
            box-shadow: 0 2px 6px ${barColor}55;
            display:flex; align-items:center; justify-content:center;
            cursor:default;
            transition: box-shadow .2s;
        `;

        // Texto dentro de la barra
        const barLabel = document.createElement('span');
        barLabel.style.cssText = `color:white; font-size:11px; font-weight:700; pointer-events:none; white-space:nowrap; overflow:hidden; padding:0 4px;`;
        barLabel.textContent = barW > 30 ? `${n.duracion} u.t.` : '';
        bar.appendChild(barLabel);

        // Tooltip
        bar.title = `Actividad ${n.id}\nInicio: ${n.es} | Fin: ${n.ef}\nDuración: ${n.duracion}\nHolgura: ${n.holgura.toFixed(2)}\n${isCritical ? '⚠ Ruta Crítica' : ''}`;

        bar.addEventListener('mouseenter', () => { bar.style.boxShadow = `0 4px 14px ${barColor}88`; bar.style.filter = 'brightness(1.1)'; });
        bar.addEventListener('mouseleave', () => { bar.style.boxShadow = `0 2px 6px ${barColor}55`; bar.style.filter = ''; });

        rowEl.appendChild(bar);
        chartCol.appendChild(rowEl);

        // Animación de entrada escalonada
        setTimeout(() => {
            bar.style.transform = 'translateY(-50%) scaleX(1)';
            bar.style.transitionProperty = 'transform, box-shadow, filter';
            bar.style.transitionDuration = '0.4s';
            bar.style.transitionTimingFunction = 'cubic-bezier(0.34,1.4,0.64,1)';
        }, 60 + i * 55);
    });

    ganttWrap.appendChild(labelCol);
    ganttWrap.appendChild(chartCol);
    wrapper.appendChild(ganttWrap);

    // --- Línea de hoy / progreso (decorativa) ---
    const nowLine = document.createElement('div');
    nowLine.style.cssText = `margin-top:10px; font-size:11px; color:#95a5a6; padding-left:${LABEL_W}px;`;
    nowLine.textContent = `Escala: 1 unidad = 1 columna · Duración total del proyecto: ${totalTime} unidades de tiempo`;
    wrapper.appendChild(nowLine);

    container.appendChild(wrapper);
}
function exportarJSON() {
    const filas = document.querySelectorAll('#cuerpoTabla tr');
    let data = { modoPert: document.getElementById('modoPertCheck').checked, actividades: [] };
    filas.forEach(fil => {
        data.actividades.push({
            id: fil.querySelector('.act-id').value, prec: fil.querySelector('.act-prec').value,
            a: fil.querySelector('.pert-a').value, b: fil.querySelector('.pert-b').value,
            c: fil.querySelector('.pert-c').value, unico: fil.querySelector('.tiempo-unico').value,
            calc: fil.querySelector('.tiempo-calc').value, var: fil.querySelector('.varianza-calc').value,
            compTiempo: fil.querySelector('.comp-tiempo') ? fil.querySelector('.comp-tiempo').value : 0,
            compCostoNormal: fil.querySelector('.comp-costo-normal') ? fil.querySelector('.comp-costo-normal').value : 0,
            compCostoComp: fil.querySelector('.comp-costo-comp') ? fil.querySelector('.comp-costo-comp').value : 0
        });
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = "red_pert_cpm.json"; a.click(); URL.revokeObjectURL(url);
}

function importarJSON(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            document.getElementById('modoPertCheck').checked = data.modoPert;
            const tbody = document.getElementById('cuerpoTabla'); tbody.innerHTML = "";
            toggleModoPert();
            data.actividades.forEach(act => agregarFila(act));
            procesarYDibujar();
        } catch (err) { alert("Error al cargar JSON."); }
    };
    reader.readAsText(file); event.target.value = '';
}

function procesarYDibujar() {
    const filas = document.querySelectorAll('#cuerpoTabla tr');
    nodos = {}; let gruposPrecedentes = {}; let idsReales = []; let varianzasMap = {};

    nodos["INICIO"] = { id: "INICIO", duracion: 0, precedentes: [], sucesores: [], es: 0, ef: 0, ls: 0, lf: 0, holgura: 0, x: 0, y: 0, nivel: 0, esFijo: true };

    filas.forEach(fil => {
        const id = fil.querySelector('.act-id').value.trim().toUpperCase();
        if (!id || id === "INICIO" || id === "FIN") return; idsReales.push(id);
        const precStr = fil.querySelector('.act-prec').value.trim();
        let precedentes = (precStr === '-' || precStr === '') ? [] : precStr.split(/[,;]/).map(p => p.trim().toUpperCase()).sort();
        if (precedentes.length === 0) precedentes = ["INICIO"];

        const usarComp = document.getElementById('usarTiemposComprimidosCheck') && document.getElementById('usarTiemposComprimidosCheck').checked;
        const duracion = usarComp
            ? (parseFloat(fil.querySelector('.comp-tiempo') ? fil.querySelector('.comp-tiempo').value : 0) || 0)
            : (parseFloat(fil.querySelector('.tiempo-calc').value) || 0);
        const varianza = parseFloat(fil.querySelector('.varianza-calc').value) || 0;
        varianzasMap[id] = varianza;

        nodos[id] = { id: id, duracion: duracion, precedentes: precedentes, sucesores: [], es: 0, ef: 0, ls: 0, lf: 0, holgura: 0, x: 0, y: 0, nivel: 0, esFijo: false, esDummy: false };
        if (precedentes.length > 1) {
            let key = precedentes.join(',');
            if (!gruposPrecedentes[key]) gruposPrecedentes[key] = [];
            gruposPrecedentes[key].push(id);
        }
    });

    let contadorDummy = 1;
    for (let key in gruposPrecedentes) {
        let hijosCompartidos = gruposPrecedentes[key];
        if (hijosCompartidos.length >= 2) {
            let listaPrecedentesOriginales = key.split(',');
            let dummyId = `X${contadorDummy++}`;
            nodos[dummyId] = { id: dummyId, duracion: 0, precedentes: listaPrecedentesOriginales, sucesores: [...hijosCompartidos], es: 0, ef: 0, ls: 0, lf: 0, holgura: 0, x: 0, y: 0, nivel: 0, esFijo: false, esDummy: true };
            hijosCompartidos.forEach(hijoId => { nodos[hijoId].precedentes = [dummyId]; });
        }
    }

    for (let id in nodos) nodos[id].sucesores = [];
    for (let id in nodos) { nodos[id].precedentes.forEach(p => { if (nodos[p]) nodos[p].sucesores.push(id); }); }

    let terminales = []; idsReales.forEach(id => { if (nodos[id].sucesores.length === 0) terminales.push(id); });
    nodos["FIN"] = { id: "FIN", duracion: 0, precedentes: terminales, sucesores: [], es: 0, ef: 0, ls: 0, lf: 0, holgura: 0, x: 0, y: 0, nivel: 0, esFijo: true };
    nodos["FIN"].precedentes.forEach(p => { if (nodos[p]) nodos[p].sucesores.push("FIN"); });

    calcularPasadaIda(); calcularPasadaRegreso(); calcularNivelesYPosicionesOptimizadas();

    let rutaCritica = []; varianzaGlobalProyecto = 0;
    for (let id in nodos) {
        if (Math.abs(nodos[id].holgura) < 0.01 && !nodos[id].esDummy) {
            rutaCritica.push(id);
            if (varianzasMap[id]) varianzaGlobalProyecto += varianzasMap[id];
        }
    }
    rutaCritica.sort((a, b) => nodos[a].nivel - nodos[b].nivel);
    duracionGlobalProyecto = nodos["FIN"].ef;

    document.getElementById('rutaCriticaOutput').innerText = rutaCritica.join(' -> ');
    document.getElementById('duracionProyectoOutput').innerText = `${duracionGlobalProyecto} ${getUnidadTiempoNombre()}`;
    document.getElementById('varianzaProyectoOutput').innerText = `${Math.round(varianzaGlobalProyecto * 100) / 100}`;

    calcularEscenarioPersonalizado();
    dibujar();
}

function calcularPasadaIda() {
    let queue = ["INICIO"]; nodos["INICIO"].es = 0; nodos["INICIO"].ef = 0;
    let inDegree = {}; for (let id in nodos) inDegree[id] = nodos[id].precedentes.length;
    while (queue.length > 0) {
        let actual = queue.shift();
        nodos[actual].sucesores.forEach(suc => {
            if (nodos[suc]) {
                nodos[suc].es = Math.max(nodos[suc].es, nodos[actual].ef);
                nodos[suc].ef = nodos[suc].es + nodos[suc].duracion;
                inDegree[suc]--; if (inDegree[suc] === 0) queue.push(suc);
            }
        });
    }
}

function calcularPasadaRegreso() {
    let maxEF = nodos["FIN"].ef; let queue = ["FIN"];
    for (let id in nodos) { nodos[id].lf = maxEF; nodos[id].ls = maxEF; }
    let outDegree = {}; for (let id in nodos) outDegree[id] = nodos[id].sucesores.length;
    while (queue.length > 0) {
        let actual = queue.shift();
        nodos[actual].precedentes.forEach(prec => {
            if (nodos[prec]) {
                nodos[prec].lf = Math.min(nodos[prec].lf, nodos[actual].ls);
                nodos[prec].ls = nodos[prec].lf - nodos[prec].duracion;
                nodos[prec].holgura = nodos[prec].ls - nodos[prec].es;
                outDegree[prec]--; if (outDegree[prec] === 0) queue.push(prec);
            }
        });
    }
}

function calcularNivelesYPosicionesOptimizadas() {
    let cambiado = true; for (let id in nodos) nodos[id].nivel = 0;
    while (cambiado) {
        cambiado = false;
        for (let id in nodos) {
            let maxNivelPrec = -1;
            nodos[id].precedentes.forEach(p => { if (nodos[p]) maxNivelPrec = Math.max(maxNivelPrec, nodos[p].nivel); });
            if (maxNivelPrec + 1 > nodos[id].nivel) { nodos[id].nivel = maxNivelPrec + 1; cambiado = true; }
        }
    }
    let capas = {}; for (let id in nodos) { let nv = nodos[id].nivel; if (!capas[nv]) capas[nv] = []; capas[nv].push(id); }
    let totalCapas = Object.keys(capas).length;
    const canvas = document.getElementById('canvasRed'); const anchoCapa = canvas.width / (totalCapas + 0.1);
    for (let nv in capas) {
        let nodosEnCapa = capas[nv]; let altoSeccion = canvas.height / (nodosEnCapa.length + 1);
        nodosEnCapa.forEach((id, index) => {
            // Si el nodo fue arrastrado manualmente, conservar su posición
            if (nodos[id].esManual) return;
            nodos[id].x = (parseInt(nv) + 0.5) * anchoCapa;
            nodos[id].y = (index + 1) * altoSeccion;
        });
    }
}

function clonarNodosParaPaso(durMap) {
    const copia = {};
    for (let id in nodos) {
        copia[id] = {
            ...nodos[id],
            duracion: durMap && durMap[id] !== undefined ? durMap[id] : nodos[id].duracion,
            es: 0,
            ef: 0,
            ls: 0,
            lf: 0,
            holgura: 0,
            nivel: nodos[id].nivel,
            x: nodos[id].x,
            y: nodos[id].y,
            precedentes: [...nodos[id].precedentes],
            sucesores: [...nodos[id].sucesores]
        };
    }
    return copia;
}

function calcularRedTemporal(tempNodos) {
    tempNodos["INICIO"].es = 0;
    tempNodos["INICIO"].ef = 0;
    let inDegree = {};
    for (let id in tempNodos) inDegree[id] = (tempNodos[id].precedentes || []).length;
    let queue = ["INICIO"];
    while (queue.length > 0) {
        const actual = queue.shift();
        (tempNodos[actual].sucesores || []).forEach(suc => {
            if (!tempNodos[suc]) return;
            tempNodos[suc].es = Math.max(tempNodos[suc].es, tempNodos[actual].ef);
            tempNodos[suc].ef = tempNodos[suc].es + tempNodos[suc].duracion;
            inDegree[suc]--;
            if (inDegree[suc] === 0) queue.push(suc);
        });
    }

    const durTotal = tempNodos["FIN"] ? tempNodos["FIN"].ef : 0;
    for (let id in tempNodos) { tempNodos[id].lf = durTotal; tempNodos[id].ls = durTotal; }
    let outDegree = {};
    for (let id in tempNodos) outDegree[id] = (tempNodos[id].sucesores || []).length;
    queue = ["FIN"];
    while (queue.length > 0) {
        const actual = queue.shift();
        (tempNodos[actual].precedentes || []).forEach(prec => {
            if (!tempNodos[prec]) return;
            tempNodos[prec].lf = Math.min(tempNodos[prec].lf, tempNodos[actual].ls);
            tempNodos[prec].ls = tempNodos[prec].lf - tempNodos[prec].duracion;
            tempNodos[prec].holgura = tempNodos[prec].ls - tempNodos[prec].es;
            outDegree[prec]--;
            if (outDegree[prec] === 0) queue.push(prec);
        });
    }
    return { tempNodos, durTotal };
}

function dibujar() {
    const canvas = document.getElementById('canvasRed'); const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(panX * zoomLevel, panY * zoomLevel);
    ctx.scale(zoomLevel, zoomLevel);

    let dibujarNodos = nodos;
    let pasosPrevios = [];
    let pasosActuales = [];
    if (vistaActual === 'capas' && capasPasos.length) {
        const paso = capasPasos[Math.max(0, Math.min(currentPasoIndex, capasPasos.length - 1))];
        pasosActuales = paso.actividades.map(a => a.act);
        pasosPrevios = capasPasos.slice(0, currentPasoIndex).flatMap(g => g.actividades.map(a => a.act));
        dibujarNodos = clonarNodosParaPaso(paso.durMap);
        calcularRedTemporal(dibujarNodos);
    }

    for (let id in dibujarNodos) {
        let nOrigen = dibujarNodos[id];
        nOrigen.sucesores.forEach(sucId => {
            let nDestino = nodos[sucId]; if (!nDestino) return;
            let esCritico = (Math.abs(nOrigen.holgura) < 0.01 && Math.abs(nDestino.holgura) < 0.01);
            ctx.setLineDash((nOrigen.esDummy || nDestino.esDummy) ? [4, 4] : []);
            ctx.strokeStyle = esCritico ? '#e74c3c' : '#95a5a6'; ctx.lineWidth = esCritico ? 3 : 1.5;
            ctx.beginPath(); ctx.moveTo(nOrigen.x, nOrigen.y); ctx.lineTo(nDestino.x, nDestino.y); ctx.stroke();
            ctx.setLineDash([]);
            let angle = Math.atan2(nDestino.y - nOrigen.y, nDestino.x - nOrigen.x);
            let radioColision = nDestino.esDummy ? 16 : (vistaActual === 'cpm' ? 42 : 31);
            let arrowX = nDestino.x - radioColision * Math.cos(angle); let arrowY = nDestino.y - radioColision * Math.sin(angle);
            ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowX - 10 * Math.cos(angle - Math.PI / 6), arrowY - 10 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(arrowX - 10 * Math.cos(angle + Math.PI / 6), arrowY - 10 * Math.sin(angle + Math.PI / 6));
            ctx.closePath(); ctx.fill();
        });
    }
    for (let id in dibujarNodos) {
        let n = dibujarNodos[id]; let esCritico = Math.abs(n.holgura) < 0.01;
        const isActiveStep = pasosActuales.includes(n.id);
        const isDoneStep = pasosPrevios.includes(n.id);
        if (n.esDummy) {
            ctx.lineWidth = esCritico ? 2.5 : 1.5; ctx.strokeStyle = esCritico ? '#e74c3c' : '#7f8c8d';
            ctx.fillStyle = '#f2f4f4'; ctx.beginPath(); ctx.arc(n.x, n.y, 14, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#7f8c8d'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.id, n.x, n.y);
            continue;
        }
        ctx.lineWidth = esCritico ? 3 : 1.5; ctx.strokeStyle = esCritico ? '#e74c3c' : '#2c3e50'; ctx.fillStyle = '#ffffff';
        if (vistaActual === 'simple') {
            ctx.beginPath(); ctx.arc(n.x, n.y, 30, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#000000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(n.id, n.x, n.y - 11);
            ctx.font = '9px Arial';
            ctx.fillStyle = '#555';
            ctx.fillText(`t=${n.duracion}`, n.x, n.y + 2);
            ctx.fillStyle = esCritico ? '#e74c3c' : '#3498db';
            ctx.font = 'bold 9px Arial';
            ctx.fillText(`H=${Number(n.holgura.toFixed(1))}`, n.x, n.y + 14);
        } else {
            let w = 75, h = 50; 
            ctx.fillStyle = isActiveStep ? '#e8f8f5' : isDoneStep ? '#eaf2fb' : '#ffffff';
            ctx.fillRect(n.x - w / 2, n.y - h / 2, w, h); 
            ctx.strokeStyle = esCritico ? '#e74c3c' : '#2c3e50';
            ctx.strokeRect(n.x - w / 2, n.y - h / 2, w, h);
            ctx.beginPath(); ctx.moveTo(n.x - w / 2, n.y); ctx.lineTo(n.x + w / 2, n.y); ctx.moveTo(n.x, n.y - h / 2); ctx.lineTo(n.x, n.y + h / 2); ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = '11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let format = num => Number(num.toFixed(1));
            ctx.fillText(format(n.es), n.x - w / 4, n.y - h / 4); ctx.fillText(format(n.ef), n.x + w / 4, n.y - h / 4);
            ctx.fillText(format(n.ls), n.x - w / 4, n.y + h / 4); ctx.fillText(format(n.lf), n.x + w / 4, n.y + h / 4);
            ctx.fillStyle = isActiveStep ? '#52c58d' : isDoneStep ? '#a12bd8' : (esCritico ? '#e74c3c' : '#2c3e50'); ctx.font = 'bold 14px Arial'; ctx.fillText(n.id, n.x, n.y - h / 2 - 10);
            
            // Dibujar la Holgura debajo del nodo en la Red de Actividades (CPM)
            ctx.fillStyle = esCritico ? '#e74c3c' : '#3498db';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`H: ${format(n.holgura)}`, n.x, n.y + h / 2 + 8);

            const textoT = `t:${format(n.duracion)}`;
            ctx.font = '10px Arial';
            ctx.fillStyle = isActiveStep ? '#0f834b' : isDoneStep ? '#8b0dd4' : '#444';
            ctx.fillText(textoT, n.x, n.y + h / 2 + 24);
        }
    }
    ctx.restore();
}

function ejecutarAccionSimulacion() {
    if (casoSeleccionado === 'casoC') {
        calcularCompresionCostos();
    } else {
        calcularEscenarioPersonalizado();
    }
}

function calcularReduccionMaxima() {
    const divRes = document.getElementById('resultadoDinamico');
    const filas  = document.querySelectorAll('#cuerpoTabla tr');

    let actBase = [];
    let costoNormalTotal = 0, costoMaxTotal = 0;

    filas.forEach(fil => {
        const id = fil.querySelector('.act-id').value.trim().toUpperCase();
        if (!id) return;
        const tNormal = parseFloat(fil.querySelector('.tiempo-calc').value) || 0;
        const compTEl = fil.querySelector('.comp-tiempo');
        const compNEl = fil.querySelector('.comp-costo-normal');
        const compCEl = fil.querySelector('.comp-costo-comp');
        const tMin    = compTEl ? (parseFloat(compTEl.value) || tNormal) : tNormal;
        const cNormal = compNEl ? (parseFloat(compNEl.value) || 0) : 0;
        const cComp   = compCEl ? (parseFloat(compCEl.value) || 0) : 0;
        const precStr = fil.querySelector('.act-prec').value.trim();
        const prec    = (precStr === '-' || precStr === '') ? [] : precStr.split(/[,;]/).map(p => p.trim().toUpperCase());

        costoNormalTotal += cNormal;
        costoMaxTotal    += cComp;

        const redMax     = Math.max(0, tNormal - tMin);
        const costoExtra = Math.max(0, cComp - cNormal);
        const cpd        = redMax > 0 ? (costoExtra / redMax) : Infinity;
        const nodo       = nodos[id];
        const esCritica  = nodo ? Math.abs(nodo.holgura) < 0.01 : false;

        actBase.push({ id, tNormal, tMin, cNormal, cComp, prec, redMax, costoExtra, costoPorDia: cpd, esCritica });
    });

    if (actBase.length === 0) {
        divRes.innerHTML = "<span style='color:#e74c3c;'>No hay actividades en la tabla.</span>";
        return;
    }

    let output = generarTablaResumen(actBase, costoNormalTotal, costoMaxTotal);
    output += ejecutarCrashingIterativo(actBase, duracionGlobalProyecto, 0, true);
    divRes.innerHTML = output;
}

function calcularCompresionCostos() {
    const divRes = document.getElementById('resultadoDinamico');
    const filas  = document.querySelectorAll('#cuerpoTabla tr');

    let actBase = [];
    let costoNormalTotal = 0, costoMaxTotal = 0;

    filas.forEach(fil => {
        const id = fil.querySelector('.act-id').value.trim().toUpperCase();
        if (!id) return;
        const tNormal = parseFloat(fil.querySelector('.tiempo-calc').value) || 0;
        const compTEl = fil.querySelector('.comp-tiempo');
        const compNEl = fil.querySelector('.comp-costo-normal');
        const compCEl = fil.querySelector('.comp-costo-comp');
        const tMin    = compTEl ? (parseFloat(compTEl.value) || tNormal) : tNormal;
        const cNormal = compNEl ? (parseFloat(compNEl.value) || 0) : 0;
        const cComp   = compCEl ? (parseFloat(compCEl.value) || 0) : 0;
        const precStr = fil.querySelector('.act-prec').value.trim();
        const prec    = (precStr === '-' || precStr === '') ? [] : precStr.split(/[,;]/).map(p => p.trim().toUpperCase());

        costoNormalTotal += cNormal;
        costoMaxTotal    += cComp;

        const redMax     = Math.max(0, tNormal - tMin);
        const costoExtra = Math.max(0, cComp - cNormal);
        const cpd        = redMax > 0 ? (costoExtra / redMax) : Infinity;
        const nodo       = nodos[id];
        const esCritica  = nodo ? Math.abs(nodo.holgura) < 0.01 : false;

        actBase.push({ id, tNormal, tMin, cNormal, cComp, prec, redMax, costoExtra, costoPorDia: cpd, esCritica });
    });

    if (actBase.length === 0) {
        divRes.innerHTML = "<span style='color:#e74c3c;'>No hay actividades en la tabla.</span>";
        return;
    }

    let output = generarTablaResumen(actBase, costoNormalTotal, costoMaxTotal);

    const plazoInput = document.getElementById('inputXCasoC');
    const plazoObj   = plazoInput ? parseFloat(plazoInput.value) : null;
    const durActual  = duracionGlobalProyecto;

    if (plazoObj !== null && !isNaN(plazoObj)) {
        if (plazoObj >= durActual) {
            output += `<div style="background:#eafaf1;border-left:4px solid #27ae60;padding:12px;border-radius:4px;margin-top:12px;font-size:12px;">
                <strong style="color:#1e8449;">✅ Sin necesidad de compresión</strong><br>
                La duración actual (<strong>${durActual} ${getUnidadTiempoAbrev()}</strong>) ya cumple con el plazo objetivo de <strong>${plazoObj} ${getUnidadTiempoAbrev()}</strong>.
            </div>`;
        } else {
            output += ejecutarCrashingIterativo(actBase, durActual, plazoObj);
        }
    }

    divRes.innerHTML = output;
}

function generarTablaResumen(actBase, costoNormalTotal, costoMaxTotal) {
    const sorted = [...actBase].sort((a, b) => {
        if (a.esCritica !== b.esCritica) return a.esCritica ? -1 : 1;
        const ca = a.costoPorDia === Infinity ? 9e9 : a.costoPorDia;
        const cb = b.costoPorDia === Infinity ? 9e9 : b.costoPorDia;
        return ca - cb;
    });

    let html = `<div style="background:white;padding:16px;border-radius:8px;border:1px solid #ddd;font-family:'Segoe UI',system-ui,sans-serif;">
        <h4 style="margin:0 0 10px;color:#2c3e50;font-size:1.15em;border-bottom:2px solid #3498db;padding-bottom:6px;">
            💸 Análisis de Compresión — Pendiente de Costo por Actividad
        </h4>
        <div style="overflow-x:auto;margin-bottom:14px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
            <thead><tr style="background:#f8f9fa;">
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">Act.</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">T. Normal</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">T. Mínimo</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">Días Disp.</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">Costo Normal</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">Costo Comprimido</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">Costo Adicional</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;">Costo/${getUnidadTiempoAbrev()}</th>
                <th style="padding:8px;border-bottom:2px solid #dee2e6;text-align:center;">Crítica?</th>
            </tr></thead>
            <tbody>`;

    sorted.forEach(a => {
        const badge = a.esCritica
            ? `<span style="background:#e74c3c;color:white;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:bold;">SÍ</span>`
            : `<span style="background:#95a5a6;color:white;padding:2px 7px;border-radius:3px;font-size:10px;">NO</span>`;
        const cpdStr = (a.costoPorDia === Infinity || a.redMax === 0) ? '—' : `${getSimboloMoneda()}${a.costoPorDia.toFixed(2)}/${getUnidadTiempoAbrev()}`;
        html += `<tr style="border-bottom:1px solid #eee;background:${a.esCritica ? 'rgba(231,76,60,0.04)' : 'transparent'}">
            <td style="padding:8px;font-weight:bold;color:#2c3e50;">${a.id}</td>
            <td style="padding:8px;">${a.tNormal}</td>
            <td style="padding:8px;">${a.tMin}</td>
            <td style="padding:8px;font-weight:bold;color:${a.redMax > 0 ? '#27ae60' : '#7f8c8d'};">${a.redMax}</td>
            <td style="padding:8px;">${getSimboloMoneda()}${a.cNormal.toLocaleString()}</td>
            <td style="padding:8px;">${getSimboloMoneda()}${a.cComp.toLocaleString()}</td>
            <td style="padding:8px;color:#c0392b;">${getSimboloMoneda()}${a.costoExtra.toLocaleString()}</td>
            <td style="padding:8px;font-weight:bold;color:#2980b9;">${cpdStr}</td>
            <td style="padding:8px;text-align:center;">${badge}</td>
        </tr>`;
    });

    html += `</tbody></table></div>
        <div style="display:flex;justify-content:flex-start;flex-wrap:wrap;font-size:13px;font-weight:bold;background:#f9f9f9;padding:10px;border-radius:4px;border:1px solid #eee;gap:8px;">
            <div>Costo Total Normal: <span style="color:#2c3e50;">${getSimboloMoneda()}${costoNormalTotal.toLocaleString()}</span></div>
        </div>
    </div>`;
    return html;
}

function calcularDuracionRed(actBase, durMap) {
    let mn = { 'INICIO': { ef:0, es:0, ls:0, lf:0, duracion:0, prec:[], suc:[], holgura:0 } };
    actBase.forEach(a => {
        const prec = a.prec.length === 0 ? ['INICIO'] : [...a.prec];
        mn[a.id] = { ef:0, es:0, ls:0, lf:0, duracion: durMap[a.id] ?? a.tNormal, prec, suc:[], holgura:0 };
    });
    const conPred = new Set(); actBase.forEach(a => a.prec.forEach(p => conPred.add(p)));
    const terminales = actBase.map(a => a.id).filter(id => !conPred.has(id));
    mn['FIN'] = { ef:0, es:0, ls:0, lf:0, duracion:0, prec: terminales, suc:[], holgura:0 };
    Object.keys(mn).forEach(id => mn[id].suc = []);
    Object.keys(mn).forEach(id => mn[id].prec.forEach(p => { if (mn[p]) mn[p].suc.push(id); }));
    let inDeg = {}; Object.keys(mn).forEach(id => inDeg[id] = mn[id].prec.length);
    let q = ['INICIO'];
    while (q.length) {
        const cur = q.shift();
        mn[cur].suc.forEach(s => {
            if (!mn[s]) return;
            mn[s].es = Math.max(mn[s].es, mn[cur].ef);
            mn[s].ef = mn[s].es + mn[s].duracion;
            if (--inDeg[s] === 0) q.push(s);
        });
    }
    const durTotal = mn['FIN'].ef;
    Object.keys(mn).forEach(id => { mn[id].lf = durTotal; mn[id].ls = durTotal; });
    let outDeg = {}; Object.keys(mn).forEach(id => outDeg[id] = mn[id].suc.length);
    q = ['FIN'];
    while (q.length) {
        const cur = q.shift();
        mn[cur].prec.forEach(p => {
            if (!mn[p]) return;
            mn[p].lf = Math.min(mn[p].lf, mn[cur].ls);
            mn[p].ls = mn[p].lf - mn[p].duracion;
            mn[p].holgura = mn[p].ls - mn[p].es;
            if (--outDeg[p] === 0) q.push(p);
        });
    }
    const criticas = new Set(actBase.filter(a => mn[a.id] && Math.abs(mn[a.id].holgura) < 0.01).map(a => a.id));
    return { durTotal, criticas };
}

function ejecutarCrashingIterativo(actBase, durInicial, plazoObj, reducirMaximo = false) {
    const costoBase = actBase.reduce((sum, a) => sum + a.cNormal, 0);
    let durMap = {};
    let redUsada = {};
    actBase.forEach(a => { durMap[a.id] = a.tNormal; redUsada[a.id] = 0; });

    const rutaCriticaOriginal = new Set(actBase.filter(a => a.esCritica).map(a => a.id));
    const preservaRutaCriticaOriginal = (id) => {
        const durMapSim = { ...durMap, [id]: durMap[id] - 1 };
        const { criticas: criticasSim } = calcularDuracionRed(actBase, durMapSim);
        return [...rutaCriticaOriginal].every(origId => criticasSim.has(origId));
    };

    let costoAcum = 0;
    let pasos = [];
    let durActual = durInicial;
    let puntosCurva = [{ duracion: durInicial, costo: costoBase }];
    const MAX = 1000;
    let iter = 0;
    const plazoFinal = reducirMaximo ? 0 : plazoObj;

    while (durActual > plazoFinal && iter++ < MAX) {
        const { criticas } = calcularDuracionRed(actBase, durMap);
        const candidatas = actBase
            .filter(a => criticas.has(a.id) && redUsada[a.id] < a.redMax && a.costoPorDia < Infinity && preservaRutaCriticaOriginal(a.id))
            .sort((a, b) => a.costoPorDia - b.costoPorDia);

        if (candidatas.length === 0) {
            pasos.push({ tipo: 'limite', msg: 'No quedan actividades críticas comprimibles que preserven la ruta crítica original. Se alcanzó el límite de reducción.' });
            break;
        }

        const elegida = candidatas[0];
        durMap[elegida.id] -= 1;
        redUsada[elegida.id] += 1;
        costoAcum += elegida.costoPorDia;
        durActual = calcularDuracionRed(actBase, durMap).durTotal;
        const durMapSnapshot = { ...durMap };
        pasos.push({ tipo: 'paso', act: elegida.id, costoDia: elegida.costoPorDia, costoAcum, nuevaDur: durActual, durMap: durMapSnapshot });
        puntosCurva.push({ duracion: durActual, costo: costoBase + costoAcum });
    }

    const grupos = [];
    pasos.forEach(p => {
        if (p.tipo !== 'paso') return;
        if (grupos.length && grupos[grupos.length - 1].nuevaDur === p.nuevaDur) {
            grupos[grupos.length - 1].actividades.push({ act: p.act, costoDia: p.costoDia });
            grupos[grupos.length - 1].costoAcum = p.costoAcum;
            grupos[grupos.length - 1].durMap = p.durMap;
        } else {
            grupos.push({
                step: grupos.length + 1,
                nuevaDur: p.nuevaDur,
                costoAcum: p.costoAcum,
                durMap: p.durMap,
                actividades: [{ act: p.act, costoDia: p.costoDia }]
            });
        }
    });

    capasPasos = grupos;
    currentPasoIndex = 0;
    datosCurvaCostoTiempo = puntosCurva;
    dibujarCurvaCostoTiempo();

    const alcanzado = reducirMaximo ? true : durActual <= plazoObj;
    const col = alcanzado ? '#27ae60' : '#e67e22';
    const titulo = reducirMaximo
        ? `🗓️ Reducción Máxima Alcanzada — de ${durInicial} a ${durActual} ${getUnidadTiempoNombre()}`
        : `🗓️ Plan de Crashing — de ${durInicial} a ${plazoObj} ${getUnidadTiempoNombre()}`;
    const subtitulo = reducirMaximo
        ? `Se redujo hasta el límite de compresión disponible.`
        : `Reducción requerida: ${durInicial - plazoObj} ${getUnidadTiempoAbrev()}`;
    const resultadoTexto = reducirMaximo
        ? '✅ Se alcanzó el límite máximo de compresión disponible.'
        : alcanzado
            ? '✅ Plazo objetivo alcanzado'
            : '⚠️ No fue posible alcanzar el plazo con la compresión disponible';

    let html = `<div style="background:white;padding:16px;border-radius:8px;border:1px solid #ddd;margin-top:14px;font-family:'Segoe UI',system-ui,sans-serif;">
        <h4 style="margin:0 0 10px;color:#2c3e50;font-size:1.1em;border-bottom:2px solid ${col};padding-bottom:6px;">
            ${titulo}
            <span style="font-size:11px;font-weight:normal;color:#7f8c8d;margin-left:8px;">${subtitulo}</span>
        </h4>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f8f9fa;">
                <th style="padding:7px 8px;border-bottom:2px solid #dee2e6;text-align:center;">Paso</th>
                <th style="padding:7px 8px;border-bottom:2px solid #dee2e6;">Actividad</th>
                <th style="padding:7px 8px;border-bottom:2px solid #dee2e6;text-align:right;">Costo del Paso</th>
                <th style="padding:7px 8px;border-bottom:2px solid #dee2e6;text-align:right;">Costo Acumulado</th>
                <th style="padding:7px 8px;border-bottom:2px solid #dee2e6;text-align:center;">Duración (sem)</th>
            </tr></thead>
            <tbody>`;

    pasos.forEach((p, i) => {
        if (p.tipo === 'paso') {
            const ok = p.nuevaDur <= plazoObj;
            html += `<tr style="border-bottom:1px solid #eee;background:${ok ? '#eafaf1' : 'transparent'}">
                <td style="padding:7px 8px;text-align:center;color:#7f8c8d;font-weight:bold;">${i + 1}</td>
                <td style="padding:7px 8px;font-weight:bold;color:#2c3e50;">Act. ${p.act}</td>
                <td style="padding:7px 8px;text-align:right;color:#c0392b;">${getSimboloMoneda()}${p.costoDia.toFixed(2)}/${getUnidadTiempoAbrev()}</td>
                <td style="padding:7px 8px;text-align:right;font-weight:bold;color:#2980b9;">${getSimboloMoneda()}${p.costoAcum.toFixed(2)}</td>
                <td style="padding:7px 8px;text-align:center;font-weight:bold;color:${ok ? '#1e8449' : '#2c3e50'};">${p.nuevaDur} ${getUnidadTiempoAbrev()} ${ok ? '✅' : ''}</td>
            </tr>`;
        } else {
            html += `<tr><td colspan="5" style="padding:8px;color:#e67e22;font-style:italic;">⚠️ ${p.msg}</td></tr>`;
        }
    });

    html += `</tbody></table></div>
        <div style="margin-top:10px;padding:10px;background:${alcanzado ? '#eafaf1' : '#fdf2e9'};border-radius:4px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span style="color:${alcanzado ? '#1e8449' : '#c0392b'};">${resultadoTexto}</span>
            <span>Duración final: <strong>${durActual} ${getUnidadTiempoNombre()}</strong></span>
            <span style="color:#c0392b;">Costo adicional: <strong>${getSimboloMoneda()}${costoAcum.toFixed(2)}</strong></span>
        </div>
    </div>`;
    return html;
}

function actualizarPanelCapas() {
    const panel = document.getElementById('panelCapasPasos');
    if (!panel) return;
    if (!capasPasos.length) {
        panel.innerHTML = `<div style="background:#f8f9fa;border:1px solid #dde2e6;padding:14px;border-radius:8px;color:#555;font-size:14px;">No hay pasos de reducción disponibles. Ejecuta Caso C para ver los pasos comprimidos.</div>`;
        return;
    }

    const paso = capasPasos[Math.max(0, Math.min(currentPasoIndex, capasPasos.length - 1))];
    const total = capasPasos.length;
    const anteriorDisabled = currentPasoIndex <= 0;
    const siguienteDisabled = currentPasoIndex >= total - 1;
    const actividadesText = paso.actividades.map(a => a.act).join(', ');
    const costoTotal = paso.actividades.reduce((sum, item) => sum + item.costoDia, 0);

    let html = `<div style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <button onclick="cambiarPasoCapas(-1)" style="padding:10px 14px;border:1px solid #95a5a6;background:${anteriorDisabled ? '#ecf0f1' : '#ffffff'};color:${anteriorDisabled ? '#95a5a6' : '#2c3e50'};border-radius:6px;cursor:${anteriorDisabled ? 'not-allowed' : 'pointer'};" ${anteriorDisabled ? 'disabled' : ''}>&larr; Retroceder</button>
            <div style="font-weight:700;color:#2c3e50;">Paso ${currentPasoIndex + 1} / ${total}</div>
            <button onclick="cambiarPasoCapas(1)" style="padding:10px 14px;border:1px solid #95a5a6;background:${siguienteDisabled ? '#ecf0f1' : '#ffffff'};color:${siguienteDisabled ? '#95a5a6' : '#2c3e50'};border-radius:6px;cursor:${siguienteDisabled ? 'not-allowed' : 'pointer'};" ${siguienteDisabled ? 'disabled' : ''}>Avanzar &rarr;</button>
        </div>
        <div style="background:#ffffff;border:1px solid #dee2e6;padding:16px;border-radius:8px;">
            <div style="margin-bottom:10px;font-size:14px;color:#34495e;font-weight:700;">Actividad(es) reducida(s): <span style="color:#c0392b;">${actividadesText}</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;color:#2c3e50;">
                <div style="background:#f8f9fa;padding:12px;border-radius:6px;border:1px solid #dde2e6;">
                    <div style="color:#7f8c8d;margin-bottom:6px;">Costo adicional total</div>
                    <div style="font-weight:700;">${getSimboloMoneda()}${costoTotal.toFixed(2)}</div>
                </div>
                <div style="background:#f8f9fa;padding:12px;border-radius:6px;border:1px solid #dde2e6;">
                    <div style="color:#7f8c8d;margin-bottom:6px;">Duración total</div>
                    <div style="font-weight:700;">${paso.nuevaDur.toFixed(1)} ${getUnidadTiempoAbrev()}</div>
                </div>
            </div>
        </div>
    </div>`;
    panel.innerHTML = html;
}

function cambiarPasoCapas(delta) {
    if (!capasPasos.length) return;
    currentPasoIndex = Math.max(0, Math.min(currentPasoIndex + delta, capasPasos.length - 1));
    actualizarPanelCapas();
    if (vistaActual === 'capas' || vistaActual === 'cpm') dibujar();
}

function toggleTiemposDeRed() { procesarYDibujar(); }

function exportarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportarCanvasAsPNG(canvas, nombreArchivo) {
    canvas.toBlob(blob => {
        if (!blob) return;
        exportarBlob(blob, nombreArchivo);
    }, 'image/png');
}

function getJsPDFConstructor() {
    if (window.jspdf && typeof window.jspdf.jsPDF === 'function') return window.jspdf.jsPDF;
    if (typeof window.jsPDF === 'function') return window.jsPDF;
    if (window.jspdf && typeof window.jspdf === 'function') return window.jspdf;
    return null;
}

function exportarCanvasAsPDF(canvas, nombreArchivo) {
    const pdfConstructor = getJsPDFConstructor();
    if (!pdfConstructor) {
        alert('No se pudo generar el PDF porque jsPDF no está disponible.');
        return;
    }
    const w = Math.min(canvas.width, 14400);
    const h = Math.min(canvas.height, 14400);
    const orientation = w >= h ? 'landscape' : 'portrait';
    const pdf = new pdfConstructor({ orientation, unit: 'px', format: [w, h] });
    const dataUrl = canvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
    pdf.save(nombreArchivo);
}

function exportarContainerComoCanvas(container) {
    return html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
}

function exportarContainerComoPNG(container, nombreArchivo) {
    exportarContainerComoCanvas(container)
        .then(canvas => exportarCanvasAsPNG(canvas, nombreArchivo))
        .catch(err => { console.error('Error exportando Gantt a PNG:', err); alert('Error al exportar Gantt como PNG.'); });
}

function exportarContainerComoPDF(container, nombreArchivo) {
    exportarContainerComoCanvas(container)
        .then(canvas => exportarCanvasAsPDF(canvas, nombreArchivo))
        .catch(err => { console.error('Error exportando Gantt a PDF:', err); alert('Error al exportar Gantt como PDF.'); });
}

function exportarVistaActual(formato) {
    if (vistaActual === 'costo') {
        const canvas = document.getElementById('canvasCostoTiempo');
        if (!canvas) return;
        if (formato === 'png') exportarCanvasAsPNG(canvas, 'curva-costo-tiempo.png');
        else exportarCanvasAsPDF(canvas, 'curva-costo-tiempo.pdf');
        return;
    }

    if (vistaActual === 'gantt') {
        const container = document.getElementById('containerGantt');
        if (!container) return;
        if (formato === 'png') exportarContainerComoPNG(container, 'gantt.png');
        else exportarContainerComoPDF(container, 'gantt.pdf');
        return;
    }

    if (vistaActual === 'capas') {
        exportarCapas();
        return;
    }

    const canvas = document.getElementById('canvasRed');
    if (!canvas) return;
    if (formato === 'png') exportarCanvasAsPNG(canvas, 'red-actividades.png');
    else exportarCanvasAsPDF(canvas, 'red-actividades.pdf');
}

function exportarCapas() {
    if (!capasPasos.length) {
        alert('No hay capas disponibles para exportar. Ejecuta Caso C primero.');
        return;
    }

    const zip = new JSZip();
    const numCapas = capasPasos.length;
    const originalPaso = currentPasoIndex;

    for (let i = 0; i < numCapas; i++) {
        currentPasoIndex = i;
        dibujar();
        const canvas = document.getElementById('canvasRed');
        if (!canvas) continue;
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        zip.file(`capa-${String(i + 1).padStart(2, '0')}.png`, base64, { base64: true });
    }

    currentPasoIndex = originalPaso;
    dibujar();

    zip.generateAsync({ type: 'blob' }).then(content => {
        exportarBlob(content, 'red-actividades-capas.zip');
    });
}
