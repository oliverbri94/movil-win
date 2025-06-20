// =================================================================
// ARCHIVO SERVER.JS - ESTRUCTURA FINAL Y CORREGIDA
// =================================================================

// --- 1. IMPORTACIONES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

// --- 2. CONFIGURACIÓN INICIAL DE LA APP ---
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;

// --- 3. CONFIGURACIÓN DE MIDDLEWARES (EL ORDEN ES CRÍTICO) ---

// Confianza en el proxy de Render y seguridad básica
app.set('trust proxy', 1);
app.use(helmet());

// Parsers para leer el body de las peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 4. LÓGICA CONDICIONAL DE DB Y SESIÓN ---
// Declaramos las variables aquí para que sean accesibles en todo el archivo
let db;
let sessionStore = new session.MemoryStore(); // Usamos un store de memoria por defecto

// Verificamos si estamos en producción (en Render)
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    console.log("Detectado entorno de producción. Conectando a PostgreSQL...");

    // 1. CREAMOS LA CONEXIÓN A LA BASE DE DATOS PRIMERO
    const dbClient = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // 2. CREAMOS EL ALMACÉN DE SESIONES USANDO ESA CONEXIÓN
    sessionStore = new pgSession({
        pool : dbClient,
        tableName : 'user_sessions'
    });

    // 3. Creamos la capa de compatibilidad para las consultas
    db = {
        run: (sql, params = [], callback = () => {}) => dbClient.query(sql, params).then(res => callback.call({ changes: res.rowCount, lastID: res.rows[0]?.id_sorteo || res.rows[0]?.id_afiliado || null }, null)).catch(err => callback(err)),
        get: (sql, params = [], callback) => dbClient.query(sql, params).then(res => callback(null, res.rows[0])).catch(err => callback(err, null)),
        all: (sql, params = [], callback) => dbClient.query(sql, params).then(res => callback(null, res.rows)).catch(err => callback(err, null)),
        prepare: (sql) => ({
            run: (params = [], callback = () => {}) => dbClient.query(sql, params, (err, res) => callback(err, res?.rowCount)),
            finalize: (callback = () => {}) => callback()
        }),
        serialize: (callback) => callback()
    };
} else {
    // --- Lógica para Desarrollo (Tu PC con SQLite) ---
    console.log("Detectado entorno local. Conectando a SQLite...");
    const DB_FILE = path.join(__dirname, 'sorteo.db');
    db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) return console.error("Error al conectar con SQLite:", err.message);
        console.log(`Conectado a SQLite: ${DB_FILE}`);
    });
}

// --- 5. CONFIGURACIÓN DE SESIÓN Y CORS (USANDO EL STORE YA CREADO) ---

// Ahora configuramos la sesión, que usará 'sessionStore' (ya sea el de memoria o el de PostgreSQL)
app.use(session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 2, // 2 horas
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Y finalmente, la configuración de CORS, que necesita que la sesión ya esté configurada.
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://127.0.0.1:5500",
    credentials: true
};
app.use(cors(corsOptions));

// Servidor de archivos estáticos (no interfiere)
app.use(express.static('.'));



// --- 5. LÓGICA DE LA APLICACIÓN (MIDDLEWARES DE RUTA Y RUTAS DE API) ---

// Middleware de autenticación
function requireAdminLogin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Acceso no autorizado.' });
    }
}

// Limitador de peticiones para el login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de inicio de sesión.' }
});

let SORTEO_ACTUAL_INFO = {
    id_sorteo: null,
    nombre_premio_display: "Smartphone de Última Generación (Por Defecto)",
    nombre_base_archivo_guia: "Smartphone_Generico",
    descripcion_premio: "Un increíble smartphone con la última tecnología.",
    meta_participaciones: 200,
    status_sorteo: 'completado'

};

// 3. Configuración de Nodemailer (Email)
let transporter;
const mailConfig = {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, // Tu dirección de email Gmail
        pass: process.env.EMAIL_PASS // <<<--- ¡REEMPLAZA ESTO CON TU CONTRASEÑA DE APLICACIÓN DE GMAIL!
    },
    tls: {
        rejectUnauthorized: false
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




function requireAdminLogin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Acceso no autorizado.' });
    }
}
// =============================
// --- RUTAS PÚBLICAS DE LA API ---
// =============================

// --- AÑADE ESTA RUTA TEMPORAL PARA DEPURAR ---
app.get('/debug-cors', (req, res) => {
    console.log("Accediendo a la ruta de depuración de CORS.");
    res.json({
        mensaje: "Variables de entorno leídas por el servidor",
        origin_configurado: process.env.FRONTEND_URL || "No se encontró FRONTEND_URL",
        node_env: process.env.NODE_ENV,
        session_secret_existe: !!process.env.SESSION_SECRET
    });
});
app.get('/api/sorteos-visibles', async (req, res) => {
    try {
        const sql = `
            SELECT s.*, (SELECT COUNT(*) FROM participaciones p WHERE p.id_sorteo_config_fk = s.id_sorteo) as participantes_actuales
            FROM sorteos_config s WHERE s.status_sorteo != 'completado'
            ORDER BY CASE s.status_sorteo WHEN 'activo' THEN 1 WHEN 'programado' THEN 2 ELSE 3 END, s.id_sorteo DESC;
        `;
        const rows = await new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) return reject(new Error("Error al consultar sorteos visibles en la BD."));
                resolve(rows);
            });
        });
        res.json({ success: true, sorteos: rows });
    } catch (error) {
        console.error("Error en GET /api/sorteos-visibles:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor." });
    }
});

app.get('/api/participantes', (req, res) => {
    const sorteoIdQuery = req.query.sorteoId;
    if (!sorteoIdQuery) {
        // Si no se especifica un sorteo, no es un error, simplemente no hay nada que mostrar.
        return res.json([]); 
    }
    const sql = `SELECT orden_id, id_documento, nombre FROM participaciones WHERE id_sorteo_config_fk = ? ORDER BY orden_id DESC`;
    db.all(sql, [sorteoIdQuery], (err, rows) => {
        if (err) { 
            console.error("Error fetching public participants:", err.message);
            return res.status(500).json({ error: 'Error interno del servidor.' }); 
        }
        // El frontend espera un formato específico ('name', 'id')
        res.json(rows.map(row => ({ orden_id: row.orden_id, name: row.nombre, id: row.id_documento })));
    });
});

// NUEVA RUTA: Para autocompletar datos de participante
app.get('/api/participante-datos/:id_documento', (req, res) => {
    const { id_documento } = req.params;
    if (!id_documento || !/^\d{10}$/.test(id_documento)) {
        return res.status(400).json({ success: false, error: 'Cédula inválida.' });
    }
    const sql = "SELECT nombre, ciudad, celular, email FROM datos_unicos_participantes WHERE id_documento = ?";
    db.get(sql, [id_documento], (err, row) => {
        if (err) {
            console.error("Error buscando datos de participante:", err.message);
            return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
        }
        if (row) {
            res.json({ success: true, data: row });
        } else {
            // Es normal no encontrarlo si es nuevo, así que no devolvemos un error 404.
            res.json({ success: false, error: 'Participante no encontrado.' });
        }
    });
});

app.get('/api/top-participantes', async (req, res) => {
    try {
        const sorteoIdQuery = req.query.sorteoId;
        if (!sorteoIdQuery) {
            return res.status(400).json({ error: 'Se requiere un ID de sorteo.' });
        }
        
        const limit = 5;
        const sql = `
            SELECT nombre, id_documento, COUNT(*) as total_participaciones 
            FROM participaciones 
            WHERE id_sorteo_config_fk = $1 
            GROUP BY id_documento, nombre 
            ORDER BY total_participaciones DESC, MIN(orden_id) ASC 
            LIMIT $2`;
        const params = [sorteoIdQuery, limit];

        const rows = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(new Error("Error al consultar top participantes en la BD."));
                resolve(rows);
            });
        });

        res.json(rows.map(row => ({ 
            name: row.nombre, 
            id: row.id_documento, 
            total_participaciones: row.total_participaciones 
        })));

    } catch (error) {
        console.error("Error en GET /api/top-participantes:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


app.get('/api/ganadores', (req, res) => {
    const sql = "SELECT nombre, ciudad, imagenUrl, premio, fecha FROM ganadores ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) res.status(500).json({ error: 'Error interno.' });
        else res.json(rows);
    });
});

app.get('/api/ultimos-ganadores', (req, res) => {
    const sql = "SELECT nombre, ciudad, imagenUrl, premio, fecha FROM ganadores ORDER BY id DESC LIMIT 3";
    db.all(sql, [], (err, rows) => {
        if (err) res.status(500).json({ error: 'Error interno.' });
        else res.json(rows);
    });
});

app.post('/api/login', loginLimiter, (req, res) => {
    // Tu código de login existente va aquí, no cambia nada.
    const { password } = req.body;
    bcrypt.compare(password, ADMIN_PASSWORD_HASH, (err, result) => {
        if (result) {
            req.session.isAdmin = true;
            res.json({ success: true, message: 'Login exitoso.' });
        } else {
            res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Sesión cerrada.' });
    });
});


// ===============================
// --- RUTAS DE ADMINISTRACIÓN ---
// ===============================

// CRUD de Sorteos
app.get('/api/admin/sorteos', requireAdminLogin, (req, res) => {
    // ESTA CONSULTA AHORA INCLUYE EL CONTEO DE PARTICIPANTES PARA CADA SORTEO
    const sql = `
        SELECT s.*, (SELECT COUNT(*) FROM participaciones p WHERE p.id_sorteo_config_fk = s.id_sorteo) as participantes_actuales
        FROM sorteos_config s 
        ORDER BY s.id_sorteo DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching admin-sorteos:", err.message);
            res.status(500).json({ error: "Error al obtener sorteos." });
        } else {
            res.json(rows);
        }
    });
});
// --- REEMPLAZA LA RUTA DE AÑADIR SORTEO CON ESTA VERSIÓN ---

app.post('/api/admin/sorteos', requireAdminLogin, async (req, res) => {
    try {
        const { nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, activo } = req.body;
        if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
            return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
        }
        
        const statusInicial = activo ? 'activo' : 'programado';
        const sql = `INSERT INTO sorteos_config (nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, status_sorteo) VALUES ($1, $2, $3, $4, $5) RETURNING id_sorteo`;
        const params = [nombre_premio_display, imagen_url, nombre_base_archivo_guia, parseInt(meta_participaciones) || 200, statusInicial];

        // "Envolvemos" la consulta en una Promesa para poder usar await
        const result = await new Promise((resolve, reject) => {
            // La función de callback ya no es 'async'
            db.get(sql, params, function(err, row) {
                if (err) return reject(err);
                // 'this' en sqlite3 contiene lastID, pero en pg el ID se retorna con RETURNING
                // Usamos row para obtener el ID devuelto por PostgreSQL
                resolve(row); 
            });
        });

        // Este código solo se ejecuta DESPUÉS de que la base de datos haya terminado con éxito.
        console.log("Sorteo añadido con éxito. ID:", result.id_sorteo);
        res.status(201).json({ message: "Sorteo añadido con éxito.", id_sorteo: result.id_sorteo });

    } catch (error) {
        console.error("Error al añadir sorteo:", error);
        res.status(500).json({ error: "Error en la base de datos al añadir el sorteo." });
    }
});

app.put('/api/admin/sorteos/:id_sorteo', requireAdminLogin, async (req, res) => {
    try {
        const { id_sorteo } = req.params;
        const { nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones } = req.body;

        if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
            return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
        }

        const sql = `UPDATE sorteos_config SET nombre_premio_display = $1, imagen_url = $2, nombre_base_archivo_guia = $3, meta_participaciones = $4 WHERE id_sorteo = $5`;
        const params = [nombre_premio_display, imagen_url, nombre_base_archivo_guia, parseInt(meta_participaciones) || 200, id_sorteo];

        const result = await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(new Error("Error al actualizar sorteo en la BD."));
                resolve(this); // 'this' contiene .changes
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: "Sorteo no encontrado." });
        }
        res.json({ message: "Sorteo actualizado exitosamente." });

    } catch (error) {
        console.error(`Error en PUT /api/admin/sorteos/${req.params.id_sorteo}:`, error);
        res.status(500).json({ error: "Error interno al editar el sorteo." });
    }
});

app.put('/api/admin/sorteos/activar/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    const { activar } = req.body; // Esto será 'true' si se presiona "Activar" o 'false' si es "Desactivar"

    // Determinamos cuál será el nuevo estado basado en la acción
    const nuevoStatus = activar ? 'activo' : 'programado';

    const sql = "UPDATE sorteos_config SET status_sorteo = ? WHERE id_sorteo = ?";

    // Ejecutamos una única y simple actualización a la base de datos
    db.run(sql, [nuevoStatus, id_sorteo], function(err) {
        if (err) {
            console.error("Error actualizando el estado del sorteo:", err.message);
            return res.status(500).json({ error: "Error interno del servidor." });
        }
        // Verificamos si se actualizó alguna fila
        if (this.changes === 0) {
             return res.status(404).json({ error: "Sorteo no encontrado." });
        }
        
        // Enviamos una respuesta de éxito
        res.json({ message: `El estado del Sorteo ID ${id_sorteo} se ha cambiado a '${nuevoStatus}'.` });
    });
});

app.post('/api/admin/sorteos/finalizar', requireAdminLogin, (req, res) => {
    const { sorteo_id } = req.body;
    const sql = "UPDATE sorteos_config SET status_sorteo = 'completado' WHERE id_sorteo = ?";
    db.run(sql, [sorteo_id], function(err) {
        if (err) return res.status(500).json({ error: 'Error al finalizar.' });
        res.json({ success: true, message: `Sorteo ID ${sorteo_id} finalizado.` });
    });
});


// ===============================
// --- RUTAS DE GESTIÓN DE AFILIADOS ---
// ===============================

// OBTENER TODOS LOS AFILIADOS
app.get('/api/admin/afiliados', requireAdminLogin, (req, res) => {
    const sql = "SELECT * FROM afiliados ORDER BY nombre_completo ASC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Error al obtener la lista de afiliados." });
        }
        res.json(rows);
    });
});

// AÑADIR UN NUEVO AFILIADO
app.post('/api/admin/afiliados', requireAdminLogin, async (req, res) => {
    try {
        const { nombre_completo, telefono } = req.body;
        if (!nombre_completo) {
            return res.status(400).json({ error: "El nombre completo es requerido." });
        }

        // En PostgreSQL, se usa RETURNING para obtener el ID del nuevo registro.
        const sql = "INSERT INTO afiliados (nombre_completo, telefono) VALUES ($1, $2) RETURNING id_afiliado";
        const params = [nombre_completo.trim(), telefono];

        const result = await new Promise((resolve, reject) => {
            // Usamos db.get para poder recibir la fila devuelta por RETURNING
            db.get(sql, params, function(err, row) {
                if (err) return reject(err);
                resolve(row);
            });
        });

        res.status(201).json({ message: "Afiliado añadido con éxito.", id: result.id_afiliado });

    } catch (error) {
        // El código de error para una violación de restricción 'UNIQUE' en PostgreSQL es '23505'
        if (error.code === '23505') {
            return res.status(409).json({ error: `El afiliado '${req.body.nombre_completo}' ya existe.` });
        }
        console.error("Error en POST /api/admin/afiliados:", error);
        res.status(500).json({ error: "Error al guardar el afiliado." });
    }
});
// CRUD de Participantes
app.get('/api/admin/participantes-activos', requireAdminLogin, (req, res) => {
    const sql = `
        SELECT p.orden_id, p.id_documento, p.nombre, p.ciudad, p.id_sorteo_config_fk as sorteo_id FROM participaciones p
        JOIN sorteos_config s ON p.id_sorteo_config_fk = s.id_sorteo WHERE s.status_sorteo = 'activo' ORDER BY p.orden_id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno.' });
        res.json(rows);
    });
});

// **RUTA POST PARTICIPANTES CON LÓGICA DE EMAIL/WHATSAPP**
app.post('/api/admin/participantes', requireAdminLogin, async (req, res) => {
    // Log para saber que la petición llegó
    console.log("-> Petición recibida para añadir participante:", req.body);

    const { id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, quantity, sorteo_id } = req.body;

    // Validación inicial de datos de entrada
    if (!id_documento || !nombre || !sorteo_id || !quantity) {
        return res.status(400).json({ error: 'Datos incompletos', message: 'Faltan datos requeridos para el registro.' });
    }
    const numQuantity = parseInt(quantity, 10);

    try {
        // --- PASO 1: OBTENER INFORMACIÓN DEL SORTEO ---
        const sorteoInfo = await new Promise((resolve, reject) => {
            const sql = `SELECT *, (SELECT COUNT(*) FROM participaciones WHERE id_sorteo_config_fk = ?) as participantes_actuales FROM sorteos_config WHERE id_sorteo = ?`;
            db.get(sql, [sorteo_id, sorteo_id], (err, row) => {
                if (err) return reject(new Error("Error al consultar la base de datos del sorteo."));
                resolve(row);
            });
        });

        if (!sorteoInfo) {
            return res.status(404).json({ error: 'Sorteo no encontrado', message: `El sorteo con ID ${sorteo_id} no existe.` });
        }
        console.log("--- PASO 1 COMPLETADO: INFO DE SORTEO OBTENIDA ---");

        console.log(`-> Información del sorteo ID ${sorteo_id} obtenida.`);

        // --- PASO 2: VALIDACIÓN ESTRICTA DE CONFIGURACIÓN Y ARCHIVO ---
        if (!sorteoInfo.nombre_base_archivo_guia || sorteoInfo.nombre_base_archivo_guia.trim() === '') {
            console.error(`VALIDATION FAIL: El sorteo ID ${sorteo_id} no tiene un 'nombre_base_archivo_guia' configurado.`);
            return res.status(400).json({ 
                error: "Sorteo mal configurado",
                message: `El sorteo '${sorteoInfo.nombre_premio_display}' no tiene un 'Nombre Base Archivo Guía' asignado. Edita el sorteo y añade uno.`
            });
        }

        const nombreArchivoGuia = `MiniGuia_${sorteoInfo.nombre_base_archivo_guia.replace(/\s+/g, '_')}.pdf`;
        const rutaGuia = path.join(__dirname, 'guias', nombreArchivoGuia);

        if (!fs.existsSync(rutaGuia)) {
            console.error(`VALIDATION FAIL: El archivo de la guía no existe en la ruta: ${rutaGuia}`);
            return res.status(409).json({
                error: "Falta el archivo de la guía",
                message: `El archivo PDF requerido '${nombreArchivoGuia}' no se encontró en la carpeta /guias. Por favor, sube el archivo al servidor.`
            });
        }
        console.log(`-> Guía '${nombreArchivoGuia}' encontrada.`);

        // --- PASO 3: VALIDACIÓN DE CUPO DISPONIBLE ---
        if ((sorteoInfo.participantes_actuales + numQuantity) > sorteoInfo.meta_participaciones) {
            const boletosRestantes = sorteoInfo.meta_participaciones - sorteoInfo.participantes_actuales;
            return res.status(409).json({
                error: "Cupo excedido",
                message: `No se pueden añadir ${numQuantity} boletos. Solo quedan ${boletosRestantes} cupos disponibles.`
            });
        }
        console.log(`-> Cupo validado. Hay espacio disponible.`);

        // --- PASO 4: TRANSACCIÓN SEGURA EN LA BASE DE DATOS ---
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION;");
                const sqlUpsertUnico = `INSERT INTO datos_unicos_participantes (id_documento, nombre, ciudad, celular, email) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id_documento) DO UPDATE SET nombre=excluded.nombre, ciudad=excluded.ciudad, celular=excluded.celular, email=excluded.email;`;
                db.run(sqlUpsertUnico, [id_documento, nombre, ciudad, celular, email]);

                const sqlInsertParticipacion = `INSERT INTO participaciones (id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, id_sorteo_config_fk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const stmt = db.prepare(sqlInsertParticipacion);
                for (let i = 0; i < numQuantity; i++) {
                    stmt.run([id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, sorteo_id]);
                }
                stmt.finalize((err) => {
                    if (err) return reject(new Error("Error al finalizar la inserción de participaciones."));
                    db.run("COMMIT;", (commitErr) => {
                        if (commitErr) {
                            console.error("Error al hacer COMMIT, revirtiendo...", commitErr);
                            db.run("ROLLBACK;");
                            return reject(new Error("Error al confirmar la transacción en la base de datos."));
                        }
                        resolve();
                    });
                });
            });
        });
        console.log(`-> Transacción completada. ${numQuantity} participaciones guardadas.`);

        // --- PASO 5: NOTIFICACIONES (SE EJECUTA SÓLO SI TODO LO ANTERIOR FUE EXITOSO) ---
        let linkWhatsApp = null;
        if (celular) {
            let numeroFormateado = String(celular).trim().replace(/\D/g, '');
            if (numeroFormateado.length === 10 && numeroFormateado.startsWith('0')) {
                numeroFormateado = `593${numeroFormateado.substring(1)}`;
            }
            const mensajeWhatsApp = `¡Hola, ${nombre}! Gracias por tu(s) ${numQuantity} boleto(s) digital(es) para el sorteo del ${sorteoInfo.nombre_premio_display}. ¡Mucha suerte de parte de MOVIL WIN!`;
            linkWhatsApp = `https://wa.me/${numeroFormateado}?text=${encodeURIComponent(mensajeWhatsApp)}`;
        }
        // --- PASO 6: RESPUESTA FINAL DE ÉXITO ---
        res.status(201).json({ 
            message: `¡${numQuantity} boleto(s) digital(es) para ${nombre} añadidos con éxito!`,
            whatsappLink: linkWhatsApp
        });
        
        if (email && transporter) {
             const mailOptions = {
                from: `"MOVIL WIN" <${mailConfig.auth.user}>`,
                to: email,
                subject: `¡Gracias por participar en MOVIL WIN por el ${sorteoInfo.nombre_premio_display}!`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="images/logo.png" alt="MOVIL WIN Logo" style="max-width: 150px; height: auto;">
                        </div>
                        <h2 style="color: #7f5af0; text-align: center;">¡Hola, ${nombre}!</h2>
                        <p>¡Gracias por adquirir tu Mini-Guía y obtener <strong>${numQuantity} boleto(s) digital(es)</strong> para el sorteo del <strong>${sorteoInfo.nombre_premio_display}</strong> en MOVIL WIN!</p>
                        <p>Estamos emocionados de tenerte a bordo. Tu Mini-Guía "${nombreArchivoGuia}" está adjunta a este correo.</p>
                        <p>Recuerda seguirnos en nuestras redes para estar al tanto de todas las novedades y próximos sorteos:</p>
                        <p style="text-align: center; margin: 20px 0;">
                            <a href="https://www.facebook.com/profile.php?id=61576682273505" style="color: #ffffff; background-color: #1877F2; padding: 10px 15px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Facebook</a>
                            <a href="https://www.instagram.com/movilwin" style="color: #ffffff; background-color: #E4405F; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Instagram</a>
                        </p>
                        <p style="text-align: center; margin-top: 25px;">
                            <a href="https://wa.me/593963135510?text=Hola%20MOVIL%20WIN%21%20Quisiera%20adquirir%20m%C3%A1s%20boletos%20digitales." target="_blank" style="display: inline-block; background-color: #25D366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png" alt="WhatsApp" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;">¡Comprar Más Boletos Digitales!
                            </a>
                        </p>
                        <p style="text-align: center; margin-top: 20px;">¡Mucha suerte en el sorteo!</p>
                        <p style="text-align: center; font-size: 0.9em; color: #777;">Atentamente,<br>El equipo de MOVIL WIN</p>
                    </div>
                `,
                attachments: []
            };
            if (fs.existsSync(rutaGuia)) {
                 mailOptions.attachments.push({ filename: nombreArchivoGuia, path: rutaGuia });
             }
             
             // Envolvemos el envío en un try/catch para registrar el error si falla, pero no afectará la respuesta ya enviada.
             try {
                await transporter.sendMail(mailOptions);
                console.log(`-> Email de confirmación enviado exitosamente a ${email}.`);
             } catch (emailError) {
                console.error("⚠️  ERROR EN TAREA DE EMAIL EN SEGUNDO PLANO:", emailError);
             }
        }


    } catch (error) {
        // CAPTURA CUALQUIER ERROR INESPERADO DE LOS PASOS ANTERIORES
        console.error("❌ ERROR FATAL en el endpoint /api/admin/participantes:", error);
        res.status(500).json({ error: "Error interno del servidor", message: error.message });
    }
});


app.delete('/api/admin/participaciones/:orden_id', requireAdminLogin, async (req, res) => {
    try {
        const { orden_id } = req.params;
        const ordenIdNum = parseInt(orden_id, 10);
        if (isNaN(ordenIdNum)) {
            return res.status(400).json({ error: 'ID de orden inválido.' });
        }
        
        const sql = "DELETE FROM participaciones WHERE orden_id = $1";
        const params = [ordenIdNum];

        const result = await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(new Error("Error al eliminar participación de la BD."));
                resolve(this); // 'this' contiene .changes
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: `Participación ${ordenIdNum} no encontrada.` });
        }
        res.json({ message: `Participación (Orden ID: ${ordenIdNum}) eliminada.` });

    } catch (error) {
        console.error(`Error en DELETE /api/admin/participaciones/${req.params.orden_id}:`, error);
        res.status(500).json({ error: "Error interno al eliminar la participación." });
    }
});
// Otras rutas de admin

// REEMPLAZA TU RUTA EXISTENTE CON ESTA VERSIÓN FINAL Y COMPLETA
app.get('/api/admin/dashboard-avanzado', requireAdminLogin, async (req, res) => {
    try {
        const stats = {};

        // --- CÁLCULO DE INGRESOS (LÓGICA MEJORADA) ---
        const priceMap = {
            'Individual ($2 c/u)': 2,
            'Pack Básico (6 x $12)': 12,
            'Combo Ganador (15 x $28)': 28,
            'Fortuna MAX (30 x $55)': 55
        };
        const ticketsPerPackage = {
            'Pack Básico (6 x $12)': 6,
            'Combo Ganador (15 x $28)': 15,
            'Fortuna MAX (30 x $55)': 30
        };

        // 1. Agrupamos los boletos para identificar compras de paquetes
        const purchaseGroups = await new Promise((resolve, reject) => {
            const sql = `
                SELECT paquete_elegido, id_documento, id_sorteo_config_fk, COUNT(*) as num_tickets
                FROM participaciones
                GROUP BY id_documento, id_sorteo_config_fk, paquete_elegido;
            `;
            db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 2. Calculamos el ingreso total basado en los grupos
        stats.totalRevenue = purchaseGroups.reduce((total, group) => {
            const packagePrice = priceMap[group.paquete_elegido];
            if (!packagePrice) return total; // Si el paquete no está en nuestro mapa, lo ignoramos

            if (group.paquete_elegido === 'Individual ($2 c/u)') {
                // Para boletos individuales, sumamos el precio por cada boleto
                return total + (group.num_tickets * packagePrice);
            } else {
                // Para paquetes, calculamos cuántos paquetes completos se compraron
                const numTicketsInPackage = ticketsPerPackage[group.paquete_elegido];
                if (numTicketsInPackage > 0) {
                    const numberOfPackages = Math.floor(group.num_tickets / numTicketsInPackage);
                    return total + (numberOfPackages * packagePrice);
                }
            }
            return total;
        }, 0);

        // --- El resto de las estadísticas (ya estaban correctas) ---
        const participaciones = await new Promise((resolve, reject) => {
             db.all("SELECT paquete_elegido, fecha_creacion, nombre_afiliado FROM participaciones", [], (err, rows) => err ? reject(err) : resolve(rows));
        });
        
        const sqlRendimiento = `
            SELECT s.nombre_premio_display, COUNT(p.orden_id) as participantes_actuales
            FROM sorteos_config s LEFT JOIN participaciones p ON s.id_sorteo = p.id_sorteo_config_fk
            WHERE s.status_sorteo = 'activo' GROUP BY s.id_sorteo ORDER BY participantes_actuales DESC;
        `;
        stats.rendimientoSorteos = await new Promise((resolve, reject) => {
            db.all(sqlRendimiento, [], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const affiliateCounts = {};
        participaciones.forEach(p => {
            if (p.nombre_afiliado && p.nombre_afiliado.trim() !== '') {
                affiliateCounts[p.nombre_afiliado] = (affiliateCounts[p.nombre_afiliado] || 0) + 1;
            }
        });
        stats.topAfiliados = Object.entries(affiliateCounts).map(([name, count]) => ({ nombre_afiliado: name, total_boletos: count })).sort((a, b) => b.total_boletos - a.total_boletos).slice(0, 5);

        const packageCounts = {};
        participaciones.forEach(p => {
            if (p.paquete_elegido && p.paquete_elegido.trim() !== '') {
                packageCounts[p.paquete_elegido] = (packageCounts[p.paquete_elegido] || 0) + 1;
            }
        });
        stats.paquetesPopulares = Object.entries(packageCounts).map(([name, count]) => ({ paquete_elegido: name, count: count }));

        const dailyCounts = {};
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        participaciones.forEach(p => {
            const participationDate = new Date(p.fecha_creacion);
            if (participationDate >= sevenDaysAgo) {
                const day = participationDate.toISOString().split('T')[0];
                dailyCounts[day] = (dailyCounts[day] || 0) + 1;
            }
        });
        stats.participacionesDiarias = Object.entries(dailyCounts).map(([day, count]) => ({ dia: day, count: count })).sort((a, b) => new Date(a.dia) - new Date(b.dia));

        res.json({ success: true, stats });

    } catch (error) {
        console.error("Error obteniendo estadísticas avanzadas del dashboard:", error.message);
        res.status(500).json({ success: false, error: 'Error interno al obtener estadísticas.' });
    }
});
app.get('/api/admin/sorteo-participantes/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    const sql = `SELECT * FROM participaciones WHERE id_sorteo_config_fk = ? ORDER BY orden_id ASC`;
    db.all(sql, [id_sorteo], (err, rows) => {
        if (err) res.status(500).json({ error: 'Error al obtener la lista.' });
        else res.json(rows);
    });
});

app.post('/api/admin/realizar-sorteo', requireAdminLogin, (req, res) => {
    const { sorteo_id, premio_actual } = req.body;
    if (!sorteo_id) {
        return res.status(400).json({ error: 'No se especificó un ID de sorteo para realizar.' });
    }
    const sqlSelect = "SELECT orden_id, id_documento, nombre, ciudad FROM participaciones WHERE id_sorteo_config_fk = ?";
    db.all(sqlSelect, [sorteo_id], (err, participaciones) => {
        if (err) return res.status(500).json({ error: 'Error al obtener participantes.' });
        if (!participaciones || participaciones.length === 0) {
            return res.status(400).json({ error: 'No hay participantes para este sorteo.' });
        }
        const ganador = participaciones[Math.floor(Math.random() * participaciones.length)];
        const fechaSorteo = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
        
        const sqlInsert = `INSERT INTO ganadores (nombre, ciudad, id_participante, orden_id_participacion, premio, fecha, id_sorteo_config_fk) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sqlInsert, [ganador.nombre, ganador.ciudad || "N/A", ganador.id_documento, ganador.orden_id, premio_actual, fechaSorteo, sorteo_id], function(errIns) {
            if (errIns) console.error("Error guardando ganador:", errIns.message);
            res.json({ success: true, ganador: ganador, message: `¡Sorteo realizado!` });
        });
    });
});


// =============================
// --- RUTAS DE GESTIÓN DE GANADORES ---
// =============================

// OBTENER TODOS LOS GANADORES
app.get('/api/admin/ganadores', requireAdminLogin, (req, res) => {
    const sql = "SELECT id, nombre, premio, fecha, imagenUrl FROM ganadores ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error al obtener la lista de ganadores." });
        res.json(rows);
    });
});

// ACTUALIZAR LA URL DE LA IMAGEN DE UN GANADOR
app.put('/api/admin/ganadores/:id', requireAdminLogin, (req, res) => {
    const { id } = req.params;
    const { imagenUrl } = req.body;

    const sql = "UPDATE ganadores SET imagenUrl = ? WHERE id = ?";
    db.run(sql, [imagenUrl, id], function(err) {
        if (err) return res.status(500).json({ error: "Error al actualizar el ganador." });
        if (this.changes === 0) return res.status(404).json({ error: "Ganador no encontrado." });
        res.json({ message: "Foto del ganador actualizada con éxito." });
    });
});
// --- Rutas HTML ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/faq.html', (req, res) => { res.sendFile(path.join(__dirname, 'faq.html')); });
app.get('/bases.html', (req, res) => { res.sendFile(path.join(__dirname, 'bases.html')); });
app.get('/ganadores.html', (req, res) => { res.sendFile(path.join(__dirname, 'ganadores.html')); });


// --- 6. ARRANQUE DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor iniciado y escuchando en el puerto ${PORT}`);
});