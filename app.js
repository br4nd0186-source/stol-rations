// --- CONFIGURACIÓN Y ESTADOS ---
const PASSWORD_ADMIN = "admin123";

let DATA = JSON.parse(localStorage.getItem('STOL_DATA')) || {};
let ENTREGADOS = JSON.parse(localStorage.getItem('STOL_ENTREGADOS')) || [];
let INTENTOS = JSON.parse(localStorage.getItem('STOL_INTENTOS')) || [];
let CEDIDOS = JSON.parse(localStorage.getItem('STOL_CEDIDOS')) || [];

// --- FUNCIONES CORE ---

function registrar(dni, nombre, estado, tipo, referencia = "") {
    const ahora = new Date();
    const fechaHora = ahora.toLocaleString('es-PE');
    
    INTENTOS.push({
        "Fecha_Hora": fechaHora,
        "DNI": dni,
        "Nombre": nombre,
        "Estado": estado,
        "Tipo_Marcacion": tipo,
        "Referencia_Auditoria": referencia
    });
    
    localStorage.setItem('STOL_INTENTOS', JSON.stringify(INTENTOS));
}

// BUSCADOR INTELIGENTE: Acepta DNI o Nombre en cualquier orden
function validarAcceso(inputUsuario) {
    // 1. Limpieza inicial
    inputUsuario = inputUsuario.trim().toUpperCase();
    if (!inputUsuario) return;

    let dniEncontrado = null;
    const ahora = new Date();
    const hora = ahora.getHours();

    // 2. Lógica de búsqueda mejorada
    if (DATA && DATA[inputUsuario]) {
        // Es un DNI exacto
        dniEncontrado = inputUsuario;
    } else if (DATA) {
        // Es un nombre o parte de un nombre
        const palabrasBusqueda = inputUsuario.split(" ");
        dniEncontrado = Object.keys(DATA).find(dni => {
            const nombrePersona = DATA[dni].nombre ? DATA[dni].nombre.toUpperCase() : "";
            // Verifica que todas las palabras escritas estén en el nombre de la DB
            return palabrasBusqueda.every(palabra => nombrePersona.includes(palabra));
        });
    }

    // 3. Procesar resultados
    if (hora >= 23) {
        actualizarUI("❌ SISTEMA CERRADO (Fin de jornada)", "mensaje-error", false);
    } else if (!dniEncontrado) {
        // AQUÍ ESTABA EL ERROR: Aseguramos que guarde lo que el usuario escribió para la excepción
        window.dniActualGlobal = inputUsuario; 
        actualizarUI(`❌ NO ENCONTRADO: "${inputUsuario}"`, "mensaje-error", true);
    } else {
        // Encontró a alguien (ya sea por DNI o Nombre)
        procesarMarcacion(dniEncontrado);
    }
    
    // Limpiar el campo siempre al final
    const inputElement = document.getElementById('dniInput');
    if (inputElement) {
        inputElement.value = "";
        inputElement.focus();
    }
}

function procesarMarcacion(dni) {
    const persona = DATA[dni];
    window.dniActualGlobal = dni;

    // Mensaje con Nombre + Área
    const infoPersonal = `${persona.nombre} (${persona.area})`;

    if (ENTREGADOS.includes(dni) || CEDIDOS.includes(dni)) {
        actualizarUI(`⚠️ YA UTILIZADO: ${infoPersonal}`, "mensaje-info", false);
    } else {
        ENTREGADOS.push(dni);
        localStorage.setItem('STOL_ENTREGADOS', JSON.stringify(ENTREGADOS));
        registrar(dni, persona.nombre, "ENTREGADO", "valido", "Normal");
        
        // El mensaje ahora dirá por ejemplo: "✅ DESAYUNO OK: TRUJILLO PIÑAN RICHARD (ALMACEN)"
        actualizarUI(`✅ DESAYUNO OK: ${infoPersonal}`, "mensaje-exito", false);
    }
}

// --- MEJORA PARA LISTAS LARGAS (FILTRADO VISUAL) ---
function filtrarPendientes(texto) {
    const listaSug = document.getElementById('lista-reemplazos-sugeridos');
    const inputOculto = document.getElementById('dni-ausente-hidden');
    
    listaSug.innerHTML = "";
    inputOculto.value = ""; 

    if (texto.length < 2) return; 

    const terminos = texto.toUpperCase().split(" ");
    let encontrados = 0;
    
    Object.keys(DATA).forEach(dni => {
        if (!ENTREGADOS.includes(dni) && !CEDIDOS.includes(dni)) {
            const nombre = DATA[dni].nombre.toUpperCase();
            const coincide = terminos.every(t => nombre.includes(t) || dni.includes(t));
            
            if (coincide && encontrados < 8) {
                const item = document.createElement('div');
                item.className = "item-reemplazo";
                item.innerHTML = `<span>${DATA[dni].nombre}</span><small>DNI: ${dni}</small>`;
                
                item.onclick = function() {
                    document.getElementById('busqueda-reemplazo').value = DATA[dni].nombre;
                    document.getElementById('dni-ausente-hidden').value = dni;
                    listaSug.innerHTML = ""; 
                };
                
                listaSug.appendChild(item);
                encontrados++;
            }
        }
    });
}

// --- ADMINISTRACIÓN ---

function ejecutarExcepcion() {
    const pass = document.getElementById('pass-exc').value;
    if (pass !== PASSWORD_ADMIN) return alert("Clave incorrecta");
    
    ENTREGADOS.push(window.dniActualGlobal);
    localStorage.setItem('STOL_ENTREGADOS', JSON.stringify(ENTREGADOS));
    registrar(window.dniActualGlobal, "AUTORIZADO", "EXCEPCIÓN", "valido", "Manual");
    alert("✅ Aprobado");
    location.reload();
}

function ejecutarTransferencia() {
    const pass = document.getElementById('pass-tra').value;
    const dniAusente = document.getElementById('dni-ausente-hidden').value; // Usar el campo oculto del buscador visual
    const dniReceptor = window.dniActualGlobal;

    if (pass !== PASSWORD_ADMIN) return alert("Clave incorrecta");
    if (!dniAusente) return alert("Debe buscar y seleccionar a una persona de la lista de pendientes");

    // Lógica de guardado
    ENTREGADOS.push(dniReceptor);
    CEDIDOS.push(dniAusente);
    localStorage.setItem('STOL_ENTREGADOS', JSON.stringify(ENTREGADOS));
    localStorage.setItem('STOL_CEDIDOS', JSON.stringify(CEDIDOS));
    
    registrar(dniAusente, DATA[dniAusente].nombre, "CEDIDO", "reemplazado", `Cede a ${dniReceptor}`);
    registrar(dniReceptor, "REEMPLAZO", "RECIBE", "reemplazado", `Toma de ${DATA[dniAusente].nombre}`);
    
    alert("🔄 Transferencia exitosa");
    location.reload();
}

// --- UI Y EXCEL ---

function actualizarUI(mensaje, categoria, mostrarAdmin) {
    const card = document.getElementById('status-card');
    const msgDiv = document.getElementById('status-msg');
    const adminDiv = document.getElementById('admin-actions');

    card.style.display = 'block';
    card.className = `status-card ${categoria}`;
    msgDiv.innerText = mensaje;
    adminDiv.style.display = mostrarAdmin ? 'block' : 'none';

    actualizarProgreso();
}

function actualizarProgreso() {
    const total = Object.keys(DATA).length;
    const entregados = ENTREGADOS.length;
    const porcentaje = total > 0 ? (entregados / total) * 100 : 0;
    
    const txt = document.getElementById('progress-text');
    const fill = document.getElementById('progress-fill');
    if(txt) txt.innerText = `${entregados} / ${total}`;
    if(fill) fill.style.width = `${porcentaje}%`;
}

function loginAdmin() {
    const pass = document.getElementById('admin-pass-input').value;
    if (pass === PASSWORD_ADMIN) {
        sessionStorage.setItem('admin_logueado', 'true');
        mostrarPanelSiEstaLogueado();
    } else { alert("❌ Clave incorrecta"); }
}

function logoutAdmin() {
    sessionStorage.removeItem('admin_logueado');
    location.reload();
}

function mostrarPanelSiEstaLogueado() {
    const logueado = sessionStorage.getItem('admin_logueado');
    if (logueado === 'true') {
        document.getElementById('admin-login-section').style.display = 'none';
        document.getElementById('admin-panel-locked').style.display = 'block';
    }
}

function cargarListaExcel(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type: 'array'});
        
        // Buscamos específicamente la hoja llamada "DESAYUNOS"
        const nombreHoja = "DESAYUNOS";
        const hoja = wb.Sheets[nombreHoja];
        
        if (!hoja) {
            return alert("❌ Error: No se encontró la hoja llamada 'DESAYUNOS'");
        }

        // Convertimos a JSON. El parámetro 'range: 1' es para saltar 
        // la fila de "DESAYUNOS 24/04/2026" y empezar en los encabezados
        const json = XLSX.utils.sheet_to_json(hoja, { range: 1 });
        
        // --- LIMPIEZA TOTAL ---
        DATA = {};
        ENTREGADOS = [];
        INTENTOS = [];
        CEDIDOS = [];
        localStorage.removeItem('STOL_ENTREGADOS');
        localStorage.removeItem('STOL_INTENTOS');
        localStorage.removeItem('STOL_CEDIDOS');

        // --- CARGA DE DATA SEGÚN TU NUEVO FORMATO ---
        json.forEach(f => {
            // Validamos que la fila tenga un DNI
            if(f.DNI) {
                DATA[String(f.DNI)] = { 
                    // Mapeamos "APELLIDOS" de tu Excel a "nombre" del sistema
                    nombre: f.APELLIDOS || "SIN NOMBRE", 
                    // Mapeamos "AREA" tal cual viene
                    area: f.AREA || "SIN ÁREA" 
                };
            }
        });
        
        localStorage.setItem('STOL_DATA', JSON.stringify(DATA));
        alert(`♻️ Lista "${nombreHoja}" cargada con éxito.`);
        location.reload();
    };
    reader.readAsArrayBuffer(file);
}

function renderizarAuditoria() {
    const tbody = document.getElementById('audit-body');
    tbody.innerHTML = "";
    [...INTENTOS].reverse().slice(0, 15).forEach(reg => {
        tbody.innerHTML += `<tr>
            <td>${reg.Fecha_Hora.split(' ')[1] || ''}</td>
            <td>${reg.DNI}</td>
            <td>${reg.Nombre}</td>
            <td>${reg.Estado}</td>
        </tr>`;
    });
}

function exportarReporte() {
    // --- 1. LÓGICA DE CONTEO ---
    const totalNomina = Object.keys(DATA).length;
    const entregadosNomina = ENTREGADOS.filter(dni => DATA[dni]).length;
    const cambiados = CEDIDOS.length;
    const agregadosExtra = INTENTOS.filter(reg => !DATA[reg.DNI] && (reg.Estado === "EXCEPCIÓN" || reg.Estado === "RECIBE")).length;
    const granTotalEntregados = entregadosNomina + agregadosExtra;
    const pendientes = totalNomina - entregadosNomina - cambiados;

    // --- 2. HOJA DE RESUMEN ---
    const resumenData = [
        ["INDICADOR", "CANTIDAD", "ESTADO"],
        ["Total en Nómina", totalNomina, ""],
        ["Entregados (de lista)", entregadosNomina, ""],
        ["Personal Agregado (Extra)", agregadosExtra, ""],
        ["TOTAL GENERAL ENTREGADOS", granTotalEntregados, "CONFIRMADO"],
        ["Pendientes (No vinieron)", pendientes, ""],
        ["Raciones Cambiadas", cambiados, ""]
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);

    // --- 3. HOJA DE DETALLE ---
    let detalleData = [];

    // Detalle del personal en nómina
    Object.keys(DATA).forEach(dni => {
        const persona = DATA[dni];
        let estado = "NO RECOGIDO";
        let detalle = "---";
        
        if (ENTREGADOS.includes(dni)) {
            estado = "ENTREGADO";
            detalle = "Entrega normal";
        }
        if (CEDIDOS.includes(dni)) {
            estado = "CEDIDO";
            const transf = INTENTOS.find(reg => reg.DNI === dni && reg.Estado === "CEDIDO");
            detalle = transf ? transf.Referencia_Auditoria : "Ración transferida";
        }

        detalleData.push({
            "DNI": dni,
            "APELLIDOS": persona.nombre, // <-- CORRECTO: Coincide con tu base de datos
            "AREA": persona.area,
            "ESTADO": estado,
            "OBSERVACIÓN": detalle
        });
    });

    // Detalle del personal adicional/extra
    INTENTOS.forEach(reg => {
        if (!DATA[reg.DNI] && (reg.Estado === "EXCEPCIÓN" || reg.Estado === "RECIBE")) {
            detalleData.push({
                "DNI": reg.DNI,
                "APELLIDOS": reg.Nombre, // <-- CAMBIADO: De "NOMBRE" a "APELLIDOS" para que no se cree una columna nueva
                "AREA": "ADICIONAL / EXTRA",
                "ESTADO": "ENTREGADO (EXTRA)",
                "OBSERVACIÓN": reg.Referencia_Auditoria
            });
        }
    });

    const wsDetalle = XLSX.utils.json_to_sheet(detalleData);

    // --- 4. ENSAMBLAJE ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, "RESUMEN");
    XLSX.utils.book_append_sheet(wb, wsDetalle, "DETALLE DE ENTREGAS");

    const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    XLSX.writeFile(wb, `Reporte_DESAYUNOS_${fecha}.xlsx`);
}

// --- INICIALIZACIÓN FINAL ---
document.addEventListener('DOMContentLoaded', () => {
    mostrarPanelSiEstaLogueado();
    actualizarProgreso();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ App lista'))
            .catch(err => console.log('❌ Error sw', err));
    });
}
