let vistaActual = 'simple';
let casoSeleccionado = 'caso1';
let nodos = {};
let duracionGlobalProyecto = 0;
let varianzaGlobalProyecto = 0;

// --- Drag & Drop en Canvas ---
let draggingNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

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
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function hitTest(n, px, py) {
    if (n.esDummy) return Math.hypot(n.x - px, n.y - py) < 16;
    if (vistaActual === 'simple') return Math.hypot(n.x - px, n.y - py) < 30;
    return Math.abs(n.x - px) < 40 && Math.abs(n.y - py) < 28;
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
            break;
        }
    }
}

function onCanvasMouseMove(e) {
    const canvas = document.getElementById('canvasRed');
    const p = getCanvasPos(canvas, e);
    if (draggingNode) {
        draggingNode.x = p.x - dragOffsetX;
        draggingNode.y = p.y - dragOffsetY;
        draggingNode.esManual = true;
        dibujar();
    } else {
        let over = false;
        for (let id in nodos) { if (hitTest(nodos[id], p.x, p.y)) { over = true; break; } }
        canvas.style.cursor = over ? 'grab' : 'default';
    }
}

function onCanvasMouseUp() {
    draggingNode = null;
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
    actualizarCamposVisibles();
}

function actualizarCamposVisibles() {
    document.getElementById('filaPlazo').style.display = 'flex'; // Siempre visible en ambos casos
    document.getElementById('filaPorcentaje').style.display = (casoSeleccionado === 'caso1') ? 'none' : 'flex';
    document.getElementById('resultadoDinamico').innerHTML = "";
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
                        • Plazo Objetivo Evaluado (X) = <strong>${x} semanas</strong><br>
                        • Duración de la Ruta Crítica (μ) = <strong>${duracionGlobalProyecto} semanas</strong><br>
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
            ? `⚠️ La gerencia exige una <strong>REDUCCIÓN DE TIEMPO</strong> de <span style="color:#e74c3c; font-size:1.15em;">${reduccionRequerida.toFixed(2)} semanas</span> en la ruta crítica original.`
            : `✅ No es necesario comprimir los tiempos. La red actual cubre la meta holgadamente por ${Math.abs(reduccionRequerida).toFixed(2)} semanas.`;

        divRes.innerHTML = `
                    <div style="background-color: white; padding: 14px; border-radius: 6px; border: 2px solid #e67e22; line-height: 1.5;">
                        <span style="color:#e67e22; font-size:1.1em;">🎓 <strong>Solución de Ingeniería Inversa Realizada:</strong></span><br>
                        • Plazo de Entrega Exigido (X) = <strong>${x} semanas</strong><br>
                        • Nivel de Confianza Exigido = <strong>${porc}%</strong><br>
                        • Valor Z de Tabla Inversa = <span style="color:#7f8c8d;">${z.toFixed(4)}</span><br>
                        • La nueva duración máxima que debe tener tu red (μ nuevo) es: <strong>${nuevaDuracionRutaCritica.toFixed(2)} semanas</strong><br>
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
                <td><button class="btn-del" onclick="eliminarFila(this)">X</button></td>`;
    tbody.appendChild(tr);
}

function eliminarFila(btn) { btn.closest('tr').remove(); }
// 1. Modifica tu función cambiarVista existente
function cambiarVista(vista) {
    vistaActual = vista;
    document.getElementById('btnSimple').classList.toggle('active', vista === 'simple');
    document.getElementById('btnCPM').classList.toggle('active', vista === 'cpm');
    document.getElementById('btnGantt').classList.toggle('active', vista === 'gantt');

    // Control de visibilidad
    const isGantt = vista === 'gantt';
    document.getElementById('canvasRed').style.display = isGantt ? 'none' : 'block';
    document.getElementById('containerGantt').classList.toggle('hidden', !isGantt);
    document.getElementById('canvasHint').style.display = isGantt ? 'none' : 'block';

    if (isGantt) {
        dibujarGantt();
    } else {
        dibujar();
    }
}

// 2. Gráfico de Gantt Profesional
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
            calc: fil.querySelector('.tiempo-calc').value, var: fil.querySelector('.varianza-calc').value
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

        const duracion = parseFloat(fil.querySelector('.tiempo-calc').value) || 0;
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
    document.getElementById('duracionProyectoOutput').innerText = `${duracionGlobalProyecto} semanas`;
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

function dibujar() {
    const canvas = document.getElementById('canvasRed'); const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let id in nodos) {
        let nOrigen = nodos[id];
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
    for (let id in nodos) {
        let n = nodos[id]; let esCritico = Math.abs(n.holgura) < 0.01;
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
            let w = 75, h = 50; ctx.fillRect(n.x - w / 2, n.y - h / 2, w, h); ctx.strokeRect(n.x - w / 2, n.y - h / 2, w, h);
            ctx.beginPath(); ctx.moveTo(n.x - w / 2, n.y); ctx.lineTo(n.x + w / 2, n.y); ctx.moveTo(n.x, n.y - h / 2); ctx.lineTo(n.x, n.y + h / 2); ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = '11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let format = num => Number(num.toFixed(1));
            ctx.fillText(format(n.es), n.x - w / 4, n.y - h / 4); ctx.fillText(format(n.ef), n.x + w / 4, n.y - h / 4);
            ctx.fillText(format(n.ls), n.x - w / 4, n.y + h / 4); ctx.fillText(format(n.lf), n.x + w / 4, n.y + h / 4);
            ctx.fillStyle = esCritico ? '#e74c3c' : '#2c3e50'; ctx.font = 'bold 14px Arial'; ctx.fillText(n.id, n.x, n.y - h / 2 - 10);
            
            // Dibujar la Holgura debajo del nodo en la Red de Actividades (CPM)
            ctx.fillStyle = esCritico ? '#e74c3c' : '#3498db';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(`H: ${format(n.holgura)}`, n.x, n.y + h / 2 + 11);
        }
    }
}
