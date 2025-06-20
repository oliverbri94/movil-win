    // Archivo: generar_hash.js
    const bcrypt = require('bcrypt');
    const saltRounds = 10;

    // IMPORTANTE: Reemplaza esto con la contraseña que deseas usar.
    const miContrasenaAdmin = 'Carlosraul23@';

    if (miContrasenaAdmin === 'tu_contraseña_real_aqui' || !miContrasenaAdmin) {
        console.error("POR FAVOR, edita este archivo y establece una contraseña real en 'miContrasenaAdmin'.");
        process.exit(1);
    }

    bcrypt.hash(miContrasenaAdmin, saltRounds, function(err, hash) {
        if (err) {
            console.error("Error al generar el hash:", err);
            return;
        }
        console.log('--------------------------------------------------------------------');
        console.log('Contraseña Original (NO GUARDAR EN CÓDIGO):', miContrasenaAdmin);
        console.log('HASH GENERADO (COPIAR Y PEGAR EN server.js):');
        console.log(hash);
        console.log('--------------------------------------------------------------------');
    });
    