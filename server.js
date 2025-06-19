// 1. Importar librerías necesarias
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
require('dotenv').config();

const app = express();
const port = 3000;
const DB_FILE = path.join(__dirname, 'sorteo.db');
const ADMIN_PASSWORD_HASH = '$2b$10$smI5GakSdpfQretertretrtetw994hu.NZe'; // <<<--- PEGA TU HASH AQUÍ
const SESSION_SECRET = 'supeertertertertespialidoso'; // ¡CAMBIA ESTO!

// Esta línea es importante para que Render confíe en la conexión segura (HTTPS)
app.set('trust proxy', 1); 
app.use(helmet());


const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://127.0.0.1:5500", // Permite pruebas locales
  credentials: true
};
app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(express.urlencoded({ extended: true }));
// 4. Middlewares y Autenticación
app.use(cors());
app.use(express.static('.'));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        // secure: true es OBLIGATORIO para SameSite: 'none'
        // Solo funcionará si tu backend en Render usa HTTPS (lo cual hace por defecto)
        secure: true, 

        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 2, // 2 horas

        // Permite que la cookie se envíe en peticiones de sitios cruzados
        sameSite: 'none' 
    }
}));






// 2. Configuración Inicial y Variables Globales
// Configuración del limitador de peticiones para el login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de tiempo: 15 minutos
    max: 10, // Máximo de 10 intentos de login por IP dentro de la ventana de tiempo
    standardHeaders: true, // Envía información del límite en las cabeceras de la respuesta
    legacyHeaders: false, // Deshabilita cabeceras antiguas
    message: { error: 'Demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo en 15 minutos.' }
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

app.get('/api/sorteos-visibles', (req, res) => {
    const sql = `
        SELECT s.*, (SELECT COUNT(*) FROM participaciones p WHERE p.id_sorteo_config_fk = s.id_sorteo) as participantes_actuales
        FROM sorteos_config s WHERE s.status_sorteo != 'completado'
        ORDER BY CASE s.status_sorteo WHEN 'activo' THEN 1 WHEN 'programado' THEN 2 ELSE 3 END, s.id_sorteo DESC;
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: "Error interno." });
        res.json({ success: true, sorteos: rows });
    });
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

// **ENDPOINT CORREGIDO / AÑADIDO**
app.get('/api/top-participantes', (req, res) => {
    const sorteoIdQuery = req.query.sorteoId;
    if (!sorteoIdQuery) {
        return res.status(400).json({ error: 'Se requiere un ID de sorteo.' });
    }
    const limit = 5; // Devolver el top 5
    const sql = `
        SELECT 
            nombre, 
            id_documento, 
            COUNT(*) as total_participaciones 
        FROM 
            participaciones 
        WHERE 
            id_sorteo_config_fk = ? 
        GROUP BY 
            id_documento, nombre 
        ORDER BY 
            total_participaciones DESC, 
            MIN(orden_id) ASC -- Tie-breaker: el primero en entrar gana
        LIMIT ?`;
    db.all(sql, [sorteoIdQuery, limit], (err, rows) => {
        if (err) { 
            console.error("Error fetching top participants:", err.message);
            return res.status(500).json({ error: 'Error interno del servidor.' }); 
        }
        // El frontend espera 'name' y 'id'
        res.json(rows.map(row => ({ 
            name: row.nombre, 
            id: row.id_documento, 
            total_participaciones: row.total_participaciones 
        })));
    });
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
app.post('/api/admin/sorteos', requireAdminLogin, (req, res) => {
    // Añadimos 'imagen_url' a la lista de variables
    const { nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, activo } = req.body;
    if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
        return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
    }
    const statusInicial = activo ? 'activo' : 'programado';
    // Actualizamos la consulta SQL para incluir la nueva columna
    const sql = `INSERT INTO sorteos_config (nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, status_sorteo) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [nombre_premio_display, imagen_url, nombre_base_archivo_guia, parseInt(meta_participaciones) || 200, statusInicial], async function(err) {
        if (err) return res.status(500).json({ error: "Error DB al añadir."});
        const nuevoSorteoId = this.lastID;
        if (activo) {
            // ... El resto de la función se queda igual ...
        } else {
            res.status(201).json({ message: "Sorteo añadido.", id_sorteo: nuevoSorteoId });
        }
    });
});

app.put('/api/admin/sorteos/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    // Añadimos 'imagen_url' a la lista de variables
    const { nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones } = req.body;
    if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
        return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
    }
    // Actualizamos la consulta SQL para incluir la nueva columna
    const sql = `UPDATE sorteos_config SET nombre_premio_display = ?, imagen_url = ?, nombre_base_archivo_guia = ?, meta_participaciones = ? WHERE id_sorteo = ?`;
    db.run(sql, [nombre_premio_display, imagen_url, nombre_base_archivo_guia, parseInt(meta_participaciones) || 200, id_sorteo], async function(err) {
        if (err) { return res.status(500).json({ error: "Error al editar." }); }
        if (this.changes === 0) return res.status(404).json({ error: "Sorteo no encontrado."});
        // La lógica de recargar la config ya no es necesaria aquí
        res.json({ message: "Sorteo actualizado." });
    });
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
app.post('/api/admin/afiliados', requireAdminLogin, (req, res) => {
    const { nombre_completo, telefono } = req.body;
    if (!nombre_completo) {
        return res.status(400).json({ error: "El nombre completo es requerido." });
    }
    const sql = "INSERT INTO afiliados (nombre_completo, telefono) VALUES (?, ?)";
    db.run(sql, [nombre_completo.trim(), telefono], function(err) {
        if (err) {
            // El código de error 'SQLITE_CONSTRAINT' usualmente significa que el nombre ya existe (por la regla UNIQUE)
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ error: `El afiliado '${nombre_completo}' ya existe.` });
            }
            return res.status(500).json({ error: "Error al guardar el afiliado." });
        }
        res.status(201).json({ message: "Afiliado añadido con éxito.", id: this.lastID });
    });
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


app.delete('/api/admin/participaciones/:orden_id', requireAdminLogin, (req, res) => {
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

// --- Inicialización DB y Servidor ---
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
        status_sorteo TEXT DEFAULT 'programado',
        meta_participaciones INTEGER DEFAULT 200,
        imagen_url TEXT
    );

    CREATE TABLE IF NOT EXISTS participaciones (
        orden_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_documento TEXT NOT NULL,
        nombre TEXT NOT NULL,
        ciudad TEXT,
        celular TEXT,
        email TEXT,
        paquete_elegido TEXT,
        nombre_afiliado TEXT,
        id_sorteo_config_fk INTEGER,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_sorteo_config_fk) REFERENCES sorteos_config(id_sorteo)
    );

    CREATE TABLE IF NOT EXISTS datos_unicos_participantes (
        id_documento TEXT PRIMARY KEY,
        nombre TEXT,
        ciudad TEXT,
        celular TEXT,
        email TEXT
    );

    CREATE TABLE IF NOT EXISTS ganadores (
        id INTEGER PRIMARY KEY,
        nombre TEXT NOT NULL,
        ciudad TEXT,
        id_participante TEXT,
        orden_id_participacion INTEGER,
        imagenUrl TEXT,
        premio TEXT,
        fecha TEXT,
        id_sorteo_config_fk INTEGER,
        FOREIGN KEY (id_sorteo_config_fk) REFERENCES sorteos_config(id_sorteo)
    );

    CREATE TABLE IF NOT EXISTS afiliados (
        id_afiliado INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_completo TEXT NOT NULL UNIQUE,
        telefono TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`;

    const { Pool } = require('pg');
    let db;

    if (process.env.DATABASE_URL) {
        // --- Conexión para Producción (Render) ---
        console.log("Detectado entorno de producción. Conectando a PostgreSQL...");
        const dbClient = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        db = {
            run: (sql, params = [], callback = () => {}) => dbClient.query(sql, params).then(res => callback.call({ changes: res.rowCount }, null)).catch(err => callback(err)),
            get: (sql, params = [], callback) => dbClient.query(sql, params).then(res => callback(null, res.rows[0])).catch(err => callback(err, null)),
            all: (sql, params = [], callback) => dbClient.query(sql, params).then(res => callback(null, res.rows)).catch(err => callback(err, null)),
            prepare: (sql) => ({
                run: (params = [], callback = () => {}) => dbClient.query(sql, params, (err, res) => callback(err, res?.rowCount)),
                finalize: (callback = () => {}) => callback()
            }),
            serialize: (callback) => callback() // Simulación para mantener la estructura
        };
    } else {
        // --- Conexión para Desarrollo (Tu Computadora) ---
        console.log("Detectado entorno local. Conectando a SQLite...");
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database('./sorteo.db');
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
});
