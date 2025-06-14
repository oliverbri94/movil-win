// 1. Importar librerías necesarias
const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fs = require('fs');

// 2. Configuración Inicial y Variables Globales
const app = express();
const port = 3000;
const DB_FILE = path.join(__dirname, 'sorteo.db');
const ADMIN_PASSWORD_HASH = '$2b$10$smI5GakSdpfQbVemvbabOee2/yjU5lJ6hIgOwvWGCEMw994hu.NZe'; // <<<--- PEGA TU HASH AQUÍ
const SESSION_SECRET = 'supercalifragilisticoespialidoso'; // ¡CAMBIA ESTO!

let SORTEO_ACTUAL_INFO = {
    id_sorteo: null,
    nombre_premio_display: "Smartphone de Última Generación (Por Defecto)",
    nombre_base_archivo_guia: "Smartphone_Generico",
    descripcion_premio: "Un increíble smartphone con la última tecnología.",
    meta_participaciones: 200
};
// ==============================================================
// --- Configuración para envío de email con Nodemailer ---
let transporter;
const mailConfig = {
    service: 'gmail',
    host: 'smtp.gmail.com', // Para Gmail, 'service' es usualmente suficiente
    port: 465,
    secure: true, // true para 465 (SSL)
    auth: {
        user: 'ceo@movilwin.com', // Tu dirección de email Gmail
        pass: 'wtlq knww arje imls' // <<<--- ¡REEMPLAZA ESTO CON TU CONTRASEÑA DE APLICACIÓN DE GMAIL!
    },
    tls: {
        rejectUnauthorized: false // A veces necesario para localhost o ciertos entornos, pero en producción revisar
    }
};

try {
    transporter = nodemailer.createTransport(mailConfig);
    transporter.verify(function(error, success) {
       if (error) {
         console.error("Error configurando Nodemailer o verificando conexión SMTP:", error);
         transporter = null;
       } else {
         console.log("Nodemailer configurado y servidor SMTP listo para enviar correos desde ceo@movilwin.com");
       }
    });
} catch(err) {
    console.error("Excepción al crear transporter de Nodemailer:", err);
    transporter = null;
}

// --- FUNCIÓN PARA CARGAR CONFIG DEL SORTEO ACTIVO ---
function cargarConfigSorteoActualDesdeDB(db) {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM sorteos_config WHERE status_sorteo = 'activo' LIMIT 1";
        db.get(sql, [], (err, row) => {
            if (err) {
                console.error("Error cargando config sorteo activo DB:", err.message);
                reject(err);
            } else if (row) {
                SORTEO_ACTUAL_INFO = { ...row };
                console.log("Configuración del sorteo activo cargada desde la base de datos:", SORTEO_ACTUAL_INFO);
                resolve(SORTEO_ACTUAL_INFO);
            } else {
                console.warn("No se encontró ningún sorteo activo. Usando config por defecto.");
                SORTEO_ACTUAL_INFO.id_sorteo = null;
                resolve(SORTEO_ACTUAL_INFO);
            }
        });
    });
}

// 5. Middlewares de Express y Autenticación
app.use(cors());
app.use(express.static('.'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 2 } // Sesión de 2 horas
}));

function requireAdminLogin(req, res, next) {
    const timestamp = `[${new Date().toLocaleTimeString()}]`;
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        console.warn(`${timestamp} Acceso no autorizado a ruta protegida: ${req.method} ${req.originalUrl}`);
        res.status(401).json({ error: 'Acceso no autorizado. Debes iniciar sesión.' });
    }
}

// 6. Endpoints de la API
// --- Rutas Públicas ---
app.get('/api/sorteos-visibles', (req, res) => {
    try {
        const sql = `
            SELECT
                s.id_sorteo, s.nombre_premio_display, s.descripcion_premio, s.imagen_url, s.meta_participaciones, s.status_sorteo,
                COUNT(p.id_sorteo_config_fk) as participantes_actuales
            FROM sorteos_config s
            LEFT JOIN participaciones p ON s.id_sorteo = p.id_sorteo_config_fk
            GROUP BY s.id_sorteo
            ORDER BY
                CASE s.status_sorteo
                    WHEN 'activo' THEN 1
                    WHEN 'programado' THEN 2
                    WHEN 'completado' THEN 3
                    ELSE 4
                END,
                s.id_sorteo DESC;
        `;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error("Error obteniendo sorteos visibles (con LEFT JOIN):", err.message);
                return res.status(500).json({ success: false, error: "Error interno al obtener la información de los sorteos." });
            }
            res.json({ success: true, sorteos: rows });
        });
    } catch (error) {
        console.error("Excepción en el endpoint /api/sorteos-visibles:", error.message);
        res.status(500).json({ success: false, error: "Error interno inesperado." });
    }
});

app.get('/api/participantes', (req, res) => {
    const sorteoIdQuery = req.query.sorteoId;
    const idSorteoParaFiltrar = sorteoIdQuery || (SORTEO_ACTUAL_INFO ? SORTEO_ACTUAL_INFO.id_sorteo : null);
    if (!idSorteoParaFiltrar) return res.json([]);
    const sql = `SELECT orden_id, id_documento, nombre FROM participaciones WHERE id_sorteo_config_fk = ? ORDER BY orden_id DESC`;
    db.all(sql, [idSorteoParaFiltrar], (err, rows) => {
        if (err) { return res.status(500).json({ error: 'Error interno.' }); }
        res.json(rows.map(row => ({ orden_id: row.orden_id, name: row.nombre, id: row.id_documento })));
    });
});

app.get('/api/top-participantes', (req, res) => {
    const sorteoIdQuery = req.query.sorteoId;
    const idSorteoParaFiltrar = sorteoIdQuery || (SORTEO_ACTUAL_INFO ? SORTEO_ACTUAL_INFO.id_sorteo : null);
    if (!idSorteoParaFiltrar) return res.json([]);
    const limit = 5;
    const sql = `SELECT nombre, id_documento, COUNT(*) as total_participaciones FROM participaciones WHERE id_sorteo_config_fk = ? GROUP BY id_documento, nombre ORDER BY total_participaciones DESC, nombre ASC LIMIT ?`;
    db.all(sql, [idSorteoParaFiltrar, limit], (err, rows) => {
        if (err) { return res.status(500).json({ error: 'Error interno.' }); }
        res.json(rows.map(row => ({ name: row.nombre, id: row.id_documento, total_participaciones: row.total_participaciones })));
    });
});

app.get('/api/ganadores', (req, res) => {
    const sql = "SELECT nombre, ciudad, imagenUrl, premio, fecha FROM ganadores ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(500).json({ error: 'Error interno.' }); }
        res.json(rows);
    });
 });

app.get('/api/ultimos-ganadores', (req, res) => {
    const sql = "SELECT nombre, ciudad, imagenUrl, premio, fecha FROM ganadores ORDER BY id DESC LIMIT 3";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(500).json({ error: 'Error interno.' }); }
        res.json(rows);
    });
});

app.get('/api/sorteo-actual-info', (req, res) => {
    res.json({
        success: true,
        idSorteo: SORTEO_ACTUAL_INFO.id_sorteo,
        premioNombre: SORTEO_ACTUAL_INFO.nombre_premio_display,
        metaParticipaciones: SORTEO_ACTUAL_INFO.meta_participaciones
    });
});

// === NUEVOS ENDPOINTS PARA DASHBOARD Y ESTADÍSTICAS ===

// GET /api/dashboard-stats - Obtener estadísticas para los gráficos
app.get('/api/dashboard-stats', requireAdminLogin, async (req, res) => {
    try {
        const stats = {};

        // 1. Obtener conteo de paquetes más populares
        const sqlPaquetes = `SELECT paquete_elegido, COUNT(*) as count FROM participaciones WHERE paquete_elegido IS NOT NULL AND paquete_elegido != '' GROUP BY paquete_elegido ORDER BY count DESC`;
        stats.paquetesPopulares = await new Promise((resolve, reject) => {
            db.all(sqlPaquetes, [], (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 2. Obtener participaciones de los últimos 7 días
        const sqlDiario = `SELECT strftime('%Y-%m-%d', DATETIME(orden_id / 1000, 'unixepoch', 'localtime')) as dia, COUNT(*) as count FROM participaciones GROUP BY dia ORDER BY dia DESC LIMIT 7`;
        stats.participacionesDiarias = await new Promise((resolve, reject) => {
            db.all(sqlDiario, [], (err, rows) => err ? reject(err) : resolve(rows.reverse())); // Revertir para que el gráfico muestre del más antiguo al más nuevo
        });

        res.json({ success: true, stats });
    } catch (error) {
        console.error("Error obteniendo estadísticas del dashboard:", error.message);
        res.status(500).json({ success: false, error: 'Error interno al obtener estadísticas.' });
    }
});

// GET /api/sorteo-participantes/:id_sorteo - Obtener participantes de un sorteo específico
app.get('/api/sorteo-participantes/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    const sql = `SELECT * FROM participaciones WHERE id_sorteo_config_fk = ? ORDER BY orden_id ASC`;
    db.all(sql, [id_sorteo], (err, rows) => {
        if (err) {
            console.error(`Error obteniendo participantes para sorteo ${id_sorteo}:`, err.message);
            return res.status(500).json({ error: 'Error al obtener la lista de participantes.' });
        }
        res.json(rows);
    });
});
// =======================================================


// --- Rutas de Administración ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Contraseña requerida.' });
    if (!ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH.startsWith('$2b$10$reemplazaEsto')) {
        console.error("ADMIN_PASSWORD_HASH no configurado.");
        return res.status(500).json({ error: 'Error de configuración del servidor.' });
    }
    bcrypt.compare(password, ADMIN_PASSWORD_HASH, (err, result) => {
        if (err) { console.error("Error comparando hash:", err); return res.status(500).json({ error: 'Error interno.' }); }
        if (result === true) {
            req.session.isAdmin = true;
            res.json({ success: true, message: 'Login exitoso.' });
        } else {
            res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
    });
});

app.post('/api/logout', requireAdminLogin, (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.status(500).json({ error: 'No se pudo cerrar la sesión.' }); }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Sesión cerrada.' });
    });
});

app.post('/api/participantes', requireAdminLogin, (req, res) => {
    const { id: id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, quantity } = req.body;
    const timestamp = `[${new Date().toLocaleTimeString()}]`;
    const numQuantity = parseInt(quantity, 10);
    if (!SORTEO_ACTUAL_INFO || !SORTEO_ACTUAL_INFO.id_sorteo) { return res.status(400).json({ error: 'No hay un sorteo activo configurado.' }); }
    const idSorteoActivo = SORTEO_ACTUAL_INFO.id_sorteo;
    // ... (validaciones de datos) ...

    db.run("BEGIN TRANSACTION;", function(beginErr) {
        if (beginErr) { /* ... */ return; }
        const sqlUpsertUnico = `INSERT INTO datos_unicos_participantes (id_documento, nombre, ciudad, celular, email) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id_documento) DO UPDATE SET nombre = COALESCE(excluded.nombre, nombre), ciudad = COALESCE(excluded.ciudad, ciudad), celular = COALESCE(excluded.celular, celular), email = COALESCE(excluded.email, email);`;
        db.run(sqlUpsertUnico, [id_documento, nombre, ciudad || null, celular || null, email || null], function(errUpsert) {
            if (errUpsert) { db.run("ROLLBACK;"); return res.status(500).json({ error: 'Error procesando datos.' }); }
            const sqlInsertParticipacion = `INSERT INTO participaciones (id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, id_sorteo_config_fk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            let completedOperations = 0; let errorsInLoop = false;
            const stmt = db.prepare(sqlInsertParticipacion);
            for (let i = 0; i < numQuantity; i++) {
                stmt.run([id_documento, nombre, ciudad || null, celular || null, email || null, paquete_elegido || null, nombre_afiliado || null, idSorteoActivo], function(errLoop) {
                    completedOperations++; if (errLoop) { errorsInLoop = true; }
                    if (completedOperations === numQuantity) {
                        stmt.finalize(async (finalizeErr) => {
                            if (finalizeErr) { if (!errorsInLoop) db.run("ROLLBACK;"); return res.status(500).json({ error: 'Error procesando inserciones.' }); }
                            if (!errorsInLoop) {
                                db.run("COMMIT;", async (commitErr) => {
                                     if(commitErr) { db.run("ROLLBACK;"); return res.status(500).json({ error: 'Error guardado.' }); }
                                     console.log(`${timestamp} ${numQuantity} participaciones añadidas para ${id_documento} en sorteo ID ${idSorteoActivo}`);
                                     
                                     // Definir variables ANTES de usarlas
                                     const nombreDisplayPremio = SORTEO_ACTUAL_INFO.nombre_premio_display || "Smartphone de Última Generación";
                                     const nombreBaseGuia = SORTEO_ACTUAL_INFO.nombre_base_archivo_guia || "Smartphone_Generico";
                                     const nombreArchivoGuia = `MiniGuia_${nombreBaseGuia.replace(/\s+/g, '_')}.pdf`;
                                     const rutaGuia = path.join(__dirname, 'guias', nombreArchivoGuia);
                                     let linkWhatsApp = null;
                                     
                                     if (email && transporter) {
                                        const mailOptions = {
                                            from: `"MOVIL WIN" <${mailConfig.auth.user}>`,
                                            to: email,
                                            subject: `¡Gracias por participar en MOVIL WIN por el ${nombreDisplayPremio}!`,
                                            html: `
                                                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                                                    <div style="text-align: center; margin-bottom: 20px;">
                                                        <img src="images/logo.png" alt="MOVIL WIN Logo" style="max-width: 150px; height: auto;">
                                                    </div>
                                                    <h2 style="color: #7f5af0; text-align: center;">¡Hola, ${nombre}!</h2>
                                                    <p>¡Gracias por adquirir tu Mini-Guía y obtener <strong>${numQuantity} participación(es)</strong> para el sorteo del <strong>${nombreDisplayPremio}</strong> en MOVIL WIN!</p>
                                                    <p>Estamos emocionados de tenerte a bordo. Tu Mini-Guía "${nombreArchivoGuia}" está adjunta a este correo.</p>
                                                    <p>Recuerda seguirnos en nuestras redes para estar al tanto de todas las novedades y próximos sorteos:</p>
                                                    <p style="text-align: center; margin: 20px 0;">
                                                        <a href="https://www.facebook.com/profile.php?id=61576682273505" style="color: #ffffff; background-color: #1877F2; padding: 10px 15px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Facebook</a>
                                                        <a href="https://www.instagram.com/movilwin" style="color: #ffffff; background-color: #E4405F; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Instagram</a>
                                                    </p>
                                                    <p style="text-align: center; margin-top: 25px;">
                                                        <a href="https://wa.me/593963135510?text=Hola%20MOVIL%20WIN%21%20Quisiera%20adquirir%20m%C3%A1s%20participaciones." target="_blank" style="display: inline-block; background-color: #25D366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
                                                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png" alt="WhatsApp" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;">¡Comprar Más Participaciones!
                                                        </a>
                                                    </p>
                                                    <p style="text-align: center; margin-top: 20px;">¡Mucha suerte en el sorteo!</p>
                                                    <p style="text-align: center; font-size: 0.9em; color: #777;">Atentamente,<br>El equipo de MOVIL WIN</p>
                                                </div>
                                            `,
                                            attachments: []
                                        };
                                        if (fs.existsSync(rutaGuia)) { mailOptions.attachments.push({ filename: nombreArchivoGuia, path: rutaGuia, contentType: 'application/pdf' }); }
                                        else { console.warn(`${timestamp} ARCHIVO GUÍA NO ENCONTRADO: ${rutaGuia}. Email se enviará sin adjunto.`); }
                                        try { await transporter.sendMail(mailOptions); console.log(`${timestamp} Email enviado a ${email}`); }
                                        catch (emailError) { console.error(`${timestamp} Error enviando email:`, emailError); }
                                     }
                                     
                                     if (celular) {
                                        let numeroFormateado = String(celular).trim();
                                        if (numeroFormateado.startsWith('0')) { numeroFormateado = `593${numeroFormateado.substring(1)}`; }
                                        else if (!numeroFormateado.startsWith('593')) { if (numeroFormateado.length === 9) numeroFormateado = `593${numeroFormateado}`; }
                                        if (numeroFormateado.length === 12 && numeroFormateado.startsWith('593')) {
                                            const mensajeWhatsApp = `¡Hola, ${nombre}! Gracias por tus ${numQuantity} participación(es) para el sorteo del ${nombreDisplayPremio} de MOVIL WIN ${email ? `.` : '.Pronto recibirás tu guía.'} Ya puedes ver tu nombre en nuestra lista de participantes en la web ¡Mucha suerte!`;
                                            linkWhatsApp = `https://wa.me/${numeroFormateado}?text=${encodeURIComponent(mensajeWhatsApp)}`;
                                            console.log(`   LINK DE WHATSAPP GENERADO: ${linkWhatsApp}`);
                                        } else { console.warn(`${timestamp} Número de celular '${celular}' no se pudo formatear.`); }
                                     }
                                     res.status(201).json({ message: `¡${numQuantity} para '${nombre}' añadidas!`, whatsappLink: linkWhatsApp });
                                });
                            } else { db.run("ROLLBACK;", (rbErr) => { if(rbErr) console.error(`${timestamp} Error ROLLBACK:`, rbErr.message); res.status(500).json({ error: `Fallaron inserciones.` }); }); }
                        });
                    }
                });
                if (errorsInLoop) break;
            }
        });
    });
});

app.delete('/api/participaciones/:orden_id', requireAdminLogin, (req, res) => {
    const { orden_id } = req.params;
    const ordenIdNum = parseInt(orden_id, 10);
    if (isNaN(ordenIdNum)) { return res.status(400).json({ error: 'ID de orden inválido.' }); }
    const sql = "DELETE FROM participaciones WHERE orden_id = ?";
    db.run(sql, [ordenIdNum], function(err) {
        if (err) { return res.status(500).json({ error: 'Error interno al eliminar.' }); }
        if (this.changes === 0) { return res.status(404).json({ error: `Participación ${ordenIdNum} no encontrada.` }); }
        res.json({ message: `Participación (Orden ID: ${ordenIdNum}) eliminada.` });
    });
});

app.post('/api/realizar-sorteo', requireAdminLogin, (req, res) => {
    const { premio_actual } = req.body;
    const idSorteoActivo = SORTEO_ACTUAL_INFO.id_sorteo;
    const nombreDelPremioSorteado = premio_actual || SORTEO_ACTUAL_INFO.nombre_premio_display;
    if (!idSorteoActivo) { return res.status(400).json({ error: 'No hay un sorteo activo.' }); }
    const sqlSelectParticipantes = "SELECT orden_id, id_documento, nombre, ciudad FROM participaciones WHERE id_sorteo_config_fk = ?";
    db.all(sqlSelectParticipantes, [idSorteoActivo], (err, todasLasParticipaciones) => {
        if (err) { return res.status(500).json({ error: 'Error al obtener participantes.' }); }
        if (!todasLasParticipaciones || todasLasParticipaciones.length === 0) { return res.status(400).json({ error: 'No hay participantes para este sorteo.' }); }
        const ganadorSeleccionado = todasLasParticipaciones[Math.floor(Math.random() * todasLasParticipaciones.length)];
        const fechaSorteo = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
        const ciudadDelGanador = ganadorSeleccionado.ciudad || "N/A";
        const sqlInsertGanador = `INSERT INTO ganadores (nombre, ciudad, id_participante, orden_id_participacion, premio, fecha, imagenUrl, id_sorteo_config_fk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sqlInsertGanador, [ganadorSeleccionado.nombre, ciudadDelGanador, ganadorSeleccionado.id_documento, ganadorSeleccionado.orden_id, nombreDelPremioSorteado, fechaSorteo, 'images/placeholder-ganador.png', idSorteoActivo], function(errIns) {
            if (errIns) console.error("Error guardando ganador:", errIns.message);
            else console.log(`Ganador ${ganadorSeleccionado.nombre} guardado para sorteo ID ${idSorteoActivo}`);
            res.json({ success: true, ganador: { orden_id: ganadorSeleccionado.orden_id, id: ganadorSeleccionado.id_documento, name: ganadorSeleccionado.nombre, ciudad: ganadorSeleccionado.ciudad }, message: `¡Sorteo realizado!` });
        });
    });
});

app.post('/api/reiniciar-sorteo', requireAdminLogin, (req, res) => {
    // Esta versión borra TODAS las participaciones.
    const sqlDeleteParticipantes = "DELETE FROM participaciones";
    const sqlResetSequence = "DELETE FROM sqlite_sequence WHERE name='participaciones'";
    db.run(sqlDeleteParticipantes, function(err) {
        if (err) { return res.status(500).json({ error: "Error al borrar participaciones." }); }
        db.run(sqlResetSequence, (errSeq) => {
            if(errSeq) console.error("Error reseteando secuencia:", errSeq);
            res.json({ message: `Sorteo reiniciado. ${this.changes} participaciones eliminadas.` });
        });
    });
});

app.get('/api/sorteos', requireAdminLogin, (req, res) => {
    const sql = "SELECT * FROM sorteos_config ORDER BY id_sorteo DESC";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(500).json({ error: "Error al obtener sorteos." }); }
        res.json(rows);
    });
});
app.post('/api/sorteos', requireAdminLogin, (req, res) => {
    const { nombre_premio_display, nombre_base_archivo_guia, descripcion_premio, meta_participaciones, activo } = req.body;
    if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
        return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
    }
    const statusInicial = activo ? 'activo' : 'programado';
    const sql = `INSERT INTO sorteos_config (nombre_premio_display, nombre_base_archivo_guia, descripcion_premio, meta_participaciones, status_sorteo) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [nombre_premio_display, nombre_base_archivo_guia, descripcion_premio || null, parseInt(meta_participaciones) || 200, statusInicial], async function(err) {
        if (err) { return res.status(500).json({ error: "Error al añadir el sorteo." }); }
        const nuevoSorteoId = this.lastID;
        if (activo) {
            db.run("UPDATE sorteos_config SET status_sorteo = 'programado' WHERE id_sorteo != ? AND status_sorteo = 'activo'", [nuevoSorteoId], async (errUpdate) => {
                if (errUpdate) console.error("Error desactivando otros sorteos:", errUpdate.message);
                await cargarConfigSorteoActualDesdeDB(db);
                res.status(201).json({ message: "Sorteo añadido y activado.", id_sorteo: nuevoSorteoId });
            });
        } else {
            res.status(201).json({ message: "Sorteo añadido.", id_sorteo: nuevoSorteoId });
        }
    });
});
app.put('/api/sorteos/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    const { nombre_premio_display, nombre_base_archivo_guia, descripcion_premio, meta_participaciones } = req.body;
    if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
        return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
    }
    const sql = `UPDATE sorteos_config SET nombre_premio_display = ?, nombre_base_archivo_guia = ?, descripcion_premio = ?, meta_participaciones = ? WHERE id_sorteo = ?`;
    db.run(sql, [nombre_premio_display, nombre_base_archivo_guia, descripcion_premio || null, parseInt(meta_participaciones) || 200, id_sorteo], async function(err) {
        if (err) { return res.status(500).json({ error: "Error al editar." }); }
        if (this.changes === 0) return res.status(404).json({ error: "Sorteo no encontrado."});
        if (SORTEO_ACTUAL_INFO && SORTEO_ACTUAL_INFO.id_sorteo == id_sorteo) {
            await cargarConfigSorteoActualDesdeDB(db);
        }
        res.json({ message: "Sorteo actualizado." });
    });
});
app.put('/api/sorteos/activar/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("UPDATE sorteos_config SET status_sorteo = 'programado' WHERE status_sorteo = 'activo'", (err1) => {
            if (err1) { db.run("ROLLBACK"); return res.status(500).json({ error: "Error al desactivar."}); }
            db.run("UPDATE sorteos_config SET status_sorteo = 'activo' WHERE id_sorteo = ?", [id_sorteo], async function(err2) {
                if (err2) { db.run("ROLLBACK"); return res.status(500).json({ error: "Error al activar."}); }
                if (this.changes === 0) { db.run("ROLLBACK"); return res.status(404).json({ error: "Sorteo no encontrado."});}
                db.run("COMMIT", async (errCommit) => {
                    if (errCommit) { return res.status(500).json({ error: "Error al activar."});}
                    await cargarConfigSorteoActualDesdeDB(db);
                    res.json({ message: `Sorteo ID ${id_sorteo} activado.` });
                });
            });
        });
    });
});
app.post('/api/sorteos/finalizar', requireAdminLogin, (req, res) => {
    if (!SORTEO_ACTUAL_INFO || !SORTEO_ACTUAL_INFO.id_sorteo) {
        return res.status(400).json({ error: 'No hay un sorteo activo para finalizar.' });
    }
    const idSorteoAFinalizar = SORTEO_ACTUAL_INFO.id_sorteo;
    const sql = "UPDATE sorteos_config SET status_sorteo = 'completado' WHERE id_sorteo = ?";
    db.run(sql, [idSorteoAFinalizar], async function(err) {
        if (err) { return res.status(500).json({ error: 'Error al finalizar el sorteo.' }); }
        if (this.changes === 0) { return res.status(404).json({ error: 'El sorteo activo no se encontró.' }); }
        await cargarConfigSorteoActualDesdeDB(db);
        res.json({ success: true, message: `Sorteo ID ${idSorteoAFinalizar} finalizado y archivado.` });
    });
});

// --- Rutas HTML ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/faq.html', (req, res) => { res.sendFile(path.join(__dirname, 'faq.html')); });
app.get('/bases.html', (req, res) => { res.sendFile(path.join(__dirname, 'bases.html')); });
app.get('/ganadores.html', (req, res) => { res.sendFile(path.join(__dirname, 'ganadores.html')); });


// === INICIALIZACIÓN DE LA BASE DE DATOS Y ARRANQUE DEL SERVIDOR ===
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("Error al conectar con SQLite:", err.message);
        process.exit(1);
    }
    console.log(`Conectado a SQLite: ${DB_FILE}`);

    const createTablesSql = `
        CREATE TABLE IF NOT EXISTS sorteos_config ( 
            id_sorteo INTEGER PRIMARY KEY AUTOINCREMENT, 
            nombre_premio_display TEXT NOT NULL, 
            nombre_base_archivo_guia TEXT NOT NULL, 
            descripcion_premio TEXT, 
            imagen_url TEXT,
            status_sorteo TEXT DEFAULT 'programado', -- <<<--- COLUMNA CORRECTA
            meta_participaciones INTEGER DEFAULT 200, 
            detalles_adicionales_premio TEXT 
        );
        CREATE TABLE IF NOT EXISTS participaciones ( orden_id INTEGER PRIMARY KEY AUTOINCREMENT, id_documento TEXT NOT NULL, nombre TEXT NOT NULL, ciudad TEXT, celular TEXT, email TEXT, paquete_elegido TEXT, nombre_afiliado TEXT DEFAULT NULL, id_sorteo_config_fk INTEGER, FOREIGN KEY (id_sorteo_config_fk) REFERENCES sorteos_config(id_sorteo) );
        CREATE TABLE IF NOT EXISTS datos_unicos_participantes ( id_documento TEXT PRIMARY KEY, nombre TEXT, ciudad TEXT, celular TEXT, email TEXT );
        CREATE TABLE IF NOT EXISTS ganadores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, ciudad TEXT, id_participante TEXT, orden_id_participacion INTEGER, imagenUrl TEXT, premio TEXT, fecha TEXT, id_sorteo_config_fk INTEGER, FOREIGN KEY (id_sorteo_config_fk) REFERENCES sorteos_config(id_sorteo) );
    `;

    db.exec(createTablesSql, async (execErr) => {
        if (execErr) {
            console.error("Error creando tablas:", execErr.message);
            process.exit(1);
        } else {
            console.log("Tablas verificadas/creadas.");
            try {
                await cargarConfigSorteoActualDesdeDB(db);
                startServer(db);
            } catch (loadErr) {
                console.error("No se pudo cargar la configuración inicial del sorteo. El servidor no arrancará.", loadErr);
                process.exit(1);
            }
        }
    });
});
function startServer(db) {
    app.listen(port, () => {
        console.log(`Servidor corriendo en http://localhost:${port}`);
    });

    process.on('SIGINT', () => {
        db.close((err) => {
            if (err) console.error("Error cerrando DB", err.message);
            else console.log('DB cerrada.');
            process.exit(0);
        });
    });
}