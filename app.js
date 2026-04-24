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

// --- NUEVOS ESTADOS ---
let ENVASES_PENDIENTES = JSON.parse(localStorage.getItem('STOL_ENVASES')) || []; 

function procesarMarcacion(dni) {
    const persona = DATA[dni];
    window.dniActualGlobal = dni;
    const infoPersonal = `${persona.nombre} (${persona.area})`;

    // LOGICA DE RETORNO DE ENVASE
    if (ENVASES_PENDIENTES.includes(dni)) {
        // Si el DNI ya está en la lista de envases, significa que lo está devolviendo
        ENVASES_PENDIENTES = ENVASES_PENDIENTES.filter(id => id !== dni);
        localStorage.setItem('STOL_ENVASES', JSON.stringify(ENVASES_PENDIENTES));
        
        registrar(dni, persona.nombre, "ENVASE DEVUELTO", "retorno", "Entregó embase");
        actualizarUI(`♻️ ENVASE RECIBIDO: ${persona.nombre}`, "mensaje-exito", false);
        return; // Salimos para no procesar como ración nueva
    }

    // LOGICA DE ENTREGA DE DESAYUNO
    if (ENTREGADOS.includes(dni) || CEDIDOS.includes(dni)) {
        actualizarUI(`⚠️ YA RECOGIÓ RACIÓN: ${infoPersonal}`, "mensaje-info", false);
    } else {
        ENTREGADOS.push(dni);
        ENVASES_PENDIENTES.push(dni); // Registramos que se lleva un envase
        
        localStorage.setItem('STOL_ENTREGADOS', JSON.stringify(ENTREGADOS));
        localStorage.setItem('STOL_ENVASES', JSON.stringify(ENVASES_PENDIENTES));
        
        registrar(dni, persona.nombre, "ENTREGADO + ENVASE", "valido", "Se llevó envase");
        actualizarUI(`✅ DESAYUNO OK: ${infoPersonal}\n(Envase pendiente de retorno)`, "mensaje-exito", false);
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
    try {
        const envasesEnPoderDelPersonal = JSON.parse(localStorage.getItem('STOL_ENVASES')) || [];

        // 1. CONTEO DE RESUMEN
        const totalNomina = Object.keys(DATA).length;
        const entregadosNomina = ENTREGADOS.filter(dni => DATA[dni]).length;
        const cambiados = CEDIDOS.length;
        const agregadosExtra = INTENTOS.filter(reg => !DATA[reg.DNI] && (reg.Estado === "EXCEPCIÓN" || reg.Estado === "RECIBE")).length;
        const granTotalEntregados = entregadosNomina + agregadosExtra;

        const resumenData = [
            ["INDICADOR", "CANTIDAD"],
            ["Total en Nómina", totalNomina],
            ["Entregados (de lista)", entregadosNomina],
            ["Extra / Excepciones", agregadosExtra],
            ["TOTAL RACIONES SALIDAS", granTotalEntregados],
            ["Envases actualmente afuera", envasesEnPoderDelPersonal.length]
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);

        // 2. HOJA DE DETALLE
        let detalleData = [];
        Object.keys(DATA).forEach(dni => {
            const persona = DATA[dni];
            let estadoRacion = "NO RECOGIDO";
            let estadoEnvase = "N.A. (No salió)";
            let fechaCol = "---"; 
            let horaCol = "---";

            if (ENTREGADOS.includes(dni) || CEDIDOS.includes(dni)) {
                estadoRacion = CEDIDOS.includes(dni) ? "CEDIDO" : "ENTREGADO";
                
                if (envasesEnPoderDelPersonal.includes(dni)) {
                    estadoEnvase = "❌ PENDIENTE (Lo tiene el operario)";
                } else {
                    estadoEnvase = "✅ DEVUELTO";
                }

                const reg = INTENTOS.find(r => r.DNI === dni && (r.Estado.includes("ENTREGADO") || r.Estado === "CEDIDO"));
                if (reg && reg.Fecha_Hora) {
                    const partes = reg.Fecha_Hora.split(','); 
                    fechaCol = partes[0] ? partes[0].trim() : "---";
                    horaCol = partes[1] ? partes[1].trim() : "---";
                }
            }

            detalleData.push({
                "FECHA": fechaCol,
                "HORA": horaCol,
                "DNI": dni,
                "APELLIDOS": persona.nombre,
                "AREA": persona.area,
                "ESTADO RACIÓN": estadoRacion,
                "ESTADO ENVASE": estadoEnvase,
                "OBSERVACIÓN": estadoEnvase.includes("PENDIENTE") ? "Debe retornar táper" : "Todo conforme"
            });
        });

        const wsDetalle = XLSX.utils.json_to_sheet(detalleData);

        // 3. HOJA DE MERMAS
        const conteoAreas = {};
        Object.keys(DATA).forEach(dni => {
            const area = DATA[dni].area || "SIN ÁREA";
            if (!conteoAreas[area]) conteoAreas[area] = { pedidos: 0, recogidos: 0 };
            conteoAreas[area].pedidos++;
            if (ENTREGADOS.includes(dni)) conteoAreas[area].recogidos++;
        });

        const mermasData = [["ÁREA", "SOLICITADOS", "RECOGIDOS", "MERMA", "%"]];
        for (const area in conteoAreas) {
            const d = conteoAreas[area];
            const merma = d.pedidos - d.recogidos;
            const cumple = d.pedidos > 0 ? ((d.recogidos / d.pedidos) * 100).toFixed(1) + "%" : "0%";
            mermasData.push([area, d.pedidos, d.recogidos, merma, cumple]);
        }
        const wsMermas = XLSX.utils.aoa_to_sheet(mermasData);

        // 4. GENERACIÓN DEL ARCHIVO CON NOMBRE DINÁMICO
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsResumen, "RESUMEN");
        XLSX.utils.book_append_sheet(wb, wsDetalle, "DETALLE");
        XLSX.utils.book_append_sheet(wb, wsMermas, "MERMAS POR AREA");

        // Lógica para el nombre del reporte: Reporte_Desayuno_DD-MM-YYYY
        const d = new Date();
        const fechaHoy = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        const nombreArchivo = `Reporte_Desayuno_${fechaHoy}.xlsx`;
        
        XLSX.writeFile(wb, nombreArchivo);

    } catch (error) {
        alert("Error: " + error.message);
    }
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
